import { db, transaction } from '../db.js';
import { writeAudit } from '../lib/audit.js';
import { nowIso } from '../lib/date.js';
import { AppError } from '../lib/errors.js';
import { pagination } from '../lib/validators.js';

function clean(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, '\\$&');
}

function isUniqueError(error) {
  return String(error?.message || '').includes('UNIQUE constraint failed');
}

function variantKey(color, size) {
  return `${color}\u0000${size}`;
}

function normalizeVariants(variants) {
  const list = Array.isArray(variants) && variants.length ? variants : [{ color: '', size: '' }];
  const seen = new Set();
  const result = [];

  for (const item of list) {
    const color = clean(item?.color) ?? '';
    const size = clean(item?.size) ?? '';
    const key = variantKey(color, size);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ color, size });
  }

  return result.length ? result : [{ color: '', size: '' }];
}

function sortVariants(variants) {
  return variants.sort(
    (a, b) =>
      String(a.color).localeCompare(String(b.color), 'zh-CN', { numeric: true }) ||
      String(a.size).localeCompare(String(b.size), 'zh-CN', { numeric: true }),
  );
}

function variantsForProducts(productIds) {
  if (!productIds.length) return new Map();
  const placeholders = productIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT id, product_id, color, size
       FROM product_variants
       WHERE product_id IN (${placeholders})
       ORDER BY id ASC`,
    )
    .all(...productIds);

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.product_id)) map.set(row.product_id, []);
    map.get(row.product_id).push({ id: row.id, color: row.color, size: row.size });
  }
  for (const variants of map.values()) sortVariants(variants);
  return map;
}

function withVariants(products) {
  const map = variantsForProducts(products.map((product) => product.id));
  return products.map((product) => ({
    ...product,
    variants: map.get(product.id) || [],
  }));
}

function getRow(id) {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
}

function insertVariants(productId, variants, now) {
  const statement = db.prepare(
    `INSERT INTO product_variants (product_id, color, size, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const variant of variants) {
    statement.run(productId, variant.color, variant.size, now, now);
  }
}

export function getProductById(id) {
  const row = getRow(id);
  if (!row) throw new AppError(400, '选择的产品不存在或已被删除');
  return withVariants([row])[0];
}

export function listProducts(query = {}) {
  const { page, pageSize, offset } = pagination(query);
  const where = [];
  const params = [];

  if (query.keyword) {
    const like = `%${escapeLike(String(query.keyword).trim())}%`;
    where.push(
      `(p.item_no LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\'
        OR p.remark LIKE ? ESCAPE '\\'
        OR EXISTS (
          SELECT 1 FROM product_variants v
          WHERE v.product_id = p.id
            AND (v.color LIKE ? ESCAPE '\\' OR v.size LIKE ? ESCAPE '\\')
        ))`,
    );
    params.push(like, like, like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number(
    db.prepare(`SELECT COUNT(*) AS count FROM products p ${whereSql}`).get(...params).count,
  );
  const items = db
    .prepare(
      `SELECT p.* FROM products p ${whereSql}
       ORDER BY p.item_no COLLATE NOCASE ASC, p.id ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset);

  return { items: withVariants(items), total, page, pageSize };
}

export function listProductOptions() {
  const rows = db
    .prepare(
      `SELECT id, item_no, name
       FROM products
       ORDER BY item_no COLLATE NOCASE ASC, id ASC`,
    )
    .all();

  return withVariants(rows).map((product) => ({
    id: product.id,
    item_no: product.item_no,
    name: product.name,
    variants: product.variants.map((variant) => ({
      color: variant.color,
      size: variant.size,
    })),
  }));
}

export function createProduct(data, user, ip) {
  return transaction(() => {
    const variants = normalizeVariants(
      data.variants ?? [{ color: data.color, size: data.size }],
    );
    const now = nowIso();
    let result;
    try {
      result = db
        .prepare(
          `INSERT INTO products (item_no, name, remark, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(data.item_no, data.name, clean(data.remark), now, now);
    } catch (error) {
      if (isUniqueError(error)) throw new AppError(409, '该货号已存在，请检查后重试');
      throw error;
    }

    const id = Number(result.lastInsertRowid);
    insertVariants(id, variants, now);
    const product = getProductById(id);

    writeAudit({
      userId: user.id,
      username: user.username,
      action: 'product_create',
      entityType: 'product',
      entityId: id,
      detail: {
        item_no: product.item_no,
        name: product.name,
        variant_count: variants.length,
        variants,
      },
      ip,
    });
    return product;
  });
}

export function updateProduct(id, data, user, ip) {
  return transaction(() => {
    const existing = getProductById(id);
    const now = nowIso();
    const changes = {};
    const assignments = [];
    const params = [];

    for (const field of ['item_no', 'name', 'remark']) {
      if (!Object.hasOwn(data, field) || data[field] === undefined) continue;
      const next = field === 'remark' ? clean(data[field]) : data[field];
      if (next !== existing[field]) {
        changes[field] = { from: existing[field], to: next };
        assignments.push(`${field} = ?`);
        params.push(next);
      }
    }

    const shouldUpdateVariants =
      data.variants !== undefined || data.color !== undefined || data.size !== undefined;
    const nextVariants = shouldUpdateVariants
      ? normalizeVariants(data.variants ?? [{ color: data.color, size: data.size }])
      : null;

    if (assignments.length) {
      assignments.push('updated_at = ?');
      params.push(now, id);
      try {
        db.prepare(`UPDATE products SET ${assignments.join(', ')} WHERE id = ?`).run(...params);
      } catch (error) {
        if (isUniqueError(error)) throw new AppError(409, '该货号已存在，请检查后重试');
        throw error;
      }
    }

    if (nextVariants) {
      const before = existing.variants.map(({ color, size }) => ({ color, size }));
      const changed =
        before.length !== nextVariants.length ||
        nextVariants.some(
          (variant) =>
            !before.some(
              (item) => item.color === variant.color && item.size === variant.size,
            ),
        );

      if (changed) {
        db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(id);
        insertVariants(id, nextVariants, now);
        changes.variants = { from: before, to: nextVariants };
      }
    }

    if (Object.keys(changes).length) {
      const product = getProductById(id);
      writeAudit({
        userId: user.id,
        username: user.username,
        action: 'product_update',
        entityType: 'product',
        entityId: id,
        detail: { item_no: product.item_no, changes },
        ip,
      });
      return product;
    }

    return existing;
  });
}

export function deleteProduct(id, user, ip) {
  return transaction(() => {
    const row = getRow(id);
    if (!row) throw new AppError(404, '商品不存在');
    const existing = withVariants([row])[0];

    writeAudit({
      userId: user.id,
      username: user.username,
      action: 'product_delete',
      entityType: 'product',
      entityId: id,
      detail: {
        item_no: existing.item_no,
        name: existing.name,
        variant_count: existing.variants.length,
      },
      ip,
    });
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return { ok: true };
  });
}
