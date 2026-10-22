import { db, transaction } from '../db.js';
import { writeAudit } from '../lib/audit.js';
import { HANDLING_OPTIONS } from '../lib/constants.js';
import { localDate, nowIso } from '../lib/date.js';
import { AppError } from '../lib/errors.js';
import { createWithNumber } from '../lib/sequence.js';
import { dateRange, pagination } from '../lib/validators.js';

const UPDATE_FIELDS = [
  'return_date',
  'customer_name',
  'phone',
  'product_name',
  'item_no',
  'color',
  'size',
  'purchase_date',
  'receipt_no',
  'reason',
  'handling',
  'refund_amount_cents',
  'remark',
];

const handlingValues = HANDLING_OPTIONS.map((item) => item.value);

function clean(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, '\\$&');
}

function getRow(id) {
  return db.prepare('SELECT * FROM return_orders WHERE id = ?').get(id);
}

export function getReturnDetail(id) {
  const row = db
    .prepare(
      `SELECT o.*, u.display_name AS operator_name, u.username AS operator_username
       FROM return_orders o
       JOIN users u ON u.id = o.operator_id
       WHERE o.id = ?`,
    )
    .get(id);
  if (!row) throw new AppError(404, '退货单不存在');
  return row;
}

export function listReturns(query = {}) {
  const { page, pageSize, offset } = pagination(query);
  const where = [];
  const params = [];

  if (query.handling) {
    if (!handlingValues.includes(query.handling)) {
      throw new AppError(400, '处理方式不正确');
    }
    where.push('o.handling = ?');
    params.push(query.handling);
  }

  if (query.keyword) {
    const like = `%${escapeLike(String(query.keyword).trim())}%`;
    where.push(
      `(o.return_no LIKE ? ESCAPE '\\' OR o.customer_name LIKE ? ESCAPE '\\'
        OR o.phone LIKE ? ESCAPE '\\' OR o.product_name LIKE ? ESCAPE '\\'
        OR o.item_no LIKE ? ESCAPE '\\' OR o.receipt_no LIKE ? ESCAPE '\\')`,
    );
    params.push(like, like, like, like, like, like);
  }

  const { from, to } = dateRange(query);
  if (from) {
    where.push('o.return_date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('o.return_date <= ?');
    params.push(to);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number(
    db.prepare(`SELECT COUNT(*) AS count FROM return_orders o ${whereSql}`).get(...params).count,
  );

  const items = db
    .prepare(
      `SELECT o.*, u.display_name AS operator_name
       FROM return_orders o
       JOIN users u ON u.id = o.operator_id
       ${whereSql}
       ORDER BY o.return_date DESC, o.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset);

  return { items, total, page, pageSize };
}

export function createReturn(data, user, ip) {
  return createWithNumber('TH', (returnNo) => {
    const now = nowIso();
    const result = db
      .prepare(
        `INSERT INTO return_orders
           (return_no, return_date, customer_name, phone, product_name, item_no, color, size,
            purchase_date, receipt_no, reason, handling, refund_amount_cents, operator_id,
            remark, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        returnNo,
        data.return_date || localDate(),
        data.customer_name,
        data.phone,
        data.product_name,
        clean(data.item_no),
        clean(data.color),
        clean(data.size),
        clean(data.purchase_date),
        clean(data.receipt_no),
        data.reason,
        data.handling,
        Number(data.refund_amount_cents || 0),
        user.id,
        clean(data.remark),
        now,
        now,
      );

    const id = Number(result.lastInsertRowid);
    writeAudit({
      userId: user.id,
      username: user.username,
      action: 'return_create',
      entityType: 'return',
      entityId: id,
      detail: {
        return_no: returnNo,
        customer_name: data.customer_name,
        handling: data.handling,
        refund_amount_cents: Number(data.refund_amount_cents || 0),
      },
      ip,
    });
    return getReturnDetail(id);
  });
}

export function updateReturn(id, data, user, ip) {
  return transaction(() => {
    const existing = getRow(id);
    if (!existing) throw new AppError(404, '退货单不存在');

    const changes = {};
    const assignments = [];
    const params = [];

    for (const field of UPDATE_FIELDS) {
      if (!Object.hasOwn(data, field) || data[field] === undefined) continue;
      let next;
      if (field === 'refund_amount_cents') next = Number(data[field] || 0);
      else if (field === 'return_date') next = data[field];
      else next = clean(data[field]);

      if (next !== existing[field]) {
        changes[field] = { from: existing[field], to: next };
        assignments.push(`${field} = ?`);
        params.push(next);
      }
    }

    if (!assignments.length) return getReturnDetail(id);

    const now = nowIso();
    assignments.push('updated_at = ?');
    params.push(now, id);
    db.prepare(`UPDATE return_orders SET ${assignments.join(', ')} WHERE id = ?`).run(...params);

    writeAudit({
      userId: user.id,
      username: user.username,
      action: 'return_update',
      entityType: 'return',
      entityId: id,
      detail: { return_no: existing.return_no, changes },
      ip,
    });
    return getReturnDetail(id);
  });
}

export function deleteReturn(id, user, ip) {
  return transaction(() => {
    const existing = getRow(id);
    if (!existing) throw new AppError(404, '退货单不存在');

    writeAudit({
      userId: user.id,
      username: user.username,
      action: 'return_delete',
      entityType: 'return',
      entityId: id,
      detail: {
        return_no: existing.return_no,
        customer_name: existing.customer_name,
        handling: existing.handling,
        refund_amount_cents: existing.refund_amount_cents,
      },
      ip,
    });
    db.prepare('DELETE FROM return_orders WHERE id = ?').run(id);
    return { ok: true };
  });
}
