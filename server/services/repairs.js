import { db, transaction } from '../db.js';
import { writeAudit } from '../lib/audit.js';
import {
  NEXT_STAGE,
  REPAIR_STATUSES,
  REPAIR_STATUS_LABELS,
  REWORK_ALLOWED_STATUSES,
} from '../lib/constants.js';
import { localDate, nowIso } from '../lib/date.js';
import { AppError } from '../lib/errors.js';
import { createWithNumber } from '../lib/sequence.js';
import { generatePublicToken } from '../lib/token.js';
import { dateRange, pagination } from '../lib/validators.js';
import { getProductById } from './products.js';

const UPDATE_FIELDS = [
  'repair_date',
  'customer_name',
  'phone',
  'product_name',
  'item_no',
  'color',
  'size',
  'problem',
  'remark',
];

function clean(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, '\\$&');
}

function getOrderRow(id) {
  return db.prepare('SELECT * FROM repair_orders WHERE id = ?').get(id);
}

function repairProduct(data, existing = null) {
  if (data.product_id === undefined || data.product_id === null) {
    return {
      product_id: null,
      product_name: clean(data.product_name),
      item_no: clean(data.item_no),
      color: clean(data.color),
      size: clean(data.size),
    };
  }

  const product = getProductById(data.product_id);
  const color = clean(Object.hasOwn(data, 'color') ? data.color : existing?.color) ?? '';
  const size = clean(Object.hasOwn(data, 'size') ? data.size : existing?.size) ?? '';
  const unchanged =
    existing &&
    Number(existing.product_id) === Number(product.id) &&
    (clean(existing.color) ?? '') === color &&
    (clean(existing.size) ?? '') === size;

  if (!unchanged && !product.variants.some((variant) => variant.color === color && variant.size === size)) {
    throw new AppError(400, '请选择该商品的有效颜色和尺码');
  }

  return {
    product_id: product.id,
    product_name: product.name,
    item_no: product.item_no,
    color,
    size,
  };
}

export function getRepairDetail(id) {
  const order = db
    .prepare(
      `SELECT r.*, u.display_name AS operator_name, u.username AS operator_username
       FROM repair_orders r
       JOIN users u ON u.id = r.operator_id
       WHERE r.id = ?`,
    )
    .get(id);

  if (!order) throw new AppError(404, '维修单不存在');

  const events = db
    .prepare(
      `SELECT e.*, u.display_name AS operator_name, v.display_name AS voided_by_name
       FROM repair_events e
       JOIN users u ON u.id = e.operator_id
       LEFT JOIN users v ON v.id = e.voided_by
       WHERE e.repair_id = ?
       ORDER BY e.round_no ASC, e.id ASC`,
    )
    .all(id)
    .map((event) => ({
      ...event,
      voided: Boolean(event.voided_at),
      status_label: REPAIR_STATUS_LABELS[event.stage],
    }));

  return { ...order, events };
}

export function listRepairs(query = {}) {
  const { page, pageSize, offset } = pagination(query);
  const where = [];
  const params = [];

  if (query.status) {
    if (!REPAIR_STATUSES.includes(query.status)) {
      throw new AppError(400, '维修状态不正确');
    }
    where.push('r.status = ?');
    params.push(query.status);
  }

  if (query.excludeStatus) {
    if (!REPAIR_STATUSES.includes(query.excludeStatus)) {
      throw new AppError(400, '要屏蔽的维修状态不正确');
    }
    where.push('r.status <> ?');
    params.push(query.excludeStatus);
  }

  if (query.keyword) {
    const like = `%${escapeLike(String(query.keyword).trim())}%`;
    where.push(
      `(r.ticket_no LIKE ? ESCAPE '\\' OR r.customer_name LIKE ? ESCAPE '\\'
        OR r.phone LIKE ? ESCAPE '\\' OR r.product_name LIKE ? ESCAPE '\\'
        OR r.item_no LIKE ? ESCAPE '\\')`,
    );
    params.push(like, like, like, like, like);
  }

  const { from, to } = dateRange(query);
  if (from) {
    where.push('r.repair_date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('r.repair_date <= ?');
    params.push(to);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number(
    db.prepare(`SELECT COUNT(*) AS count FROM repair_orders r ${whereSql}`).get(...params).count,
  );

  const items = db
    .prepare(
      `SELECT r.*, u.display_name AS operator_name
       FROM repair_orders r
       JOIN users u ON u.id = r.operator_id
       ${whereSql}
       ORDER BY r.repair_date DESC, r.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset);

  return { items, total, page, pageSize };
}

export function createRepair(data, user, ip) {
  return createWithNumber('WX', (ticketNo) => {
    const now = nowIso();
    const date = data.repair_date || localDate();
    const product = repairProduct(data);
    const publicToken = generatePublicToken();
    const result = db
      .prepare(
        `INSERT INTO repair_orders
           (ticket_no, repair_date, customer_name, phone, product_id, product_name, item_no,
            color, size, problem, status, current_round, operator_id, remark, public_token,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_factory', 1, ?, ?, ?, ?, ?)`,
      )
      .run(
        ticketNo,
        date,
        data.customer_name,
        data.phone,
        product.product_id,
        product.product_name,
        product.item_no,
        product.color,
        product.size,
        data.problem,
        user.id,
        clean(data.remark),
        publicToken,
        now,
        now,
      );

    const id = Number(result.lastInsertRowid);
    writeAudit({
      userId: user.id,
      username: user.username,
      action: 'repair_create',
      entityType: 'repair',
      entityId: id,
      detail: {
        ticket_no: ticketNo,
        customer_name: data.customer_name,
        repair_date: date,
        item_no: product.item_no,
      },
      ip,
    });
    return getRepairDetail(id);
  }, { continuous: true, pad: 4 });
}

export function updateRepair(id, data, user, ip) {
  return transaction(() => {
    const existing = getOrderRow(id);
    if (!existing) throw new AppError(404, '维修单不存在');

    const changes = {};
    const assignments = [];
    const params = [];

    const hasProductField = Object.hasOwn(data, 'product_id');
    const nextProductId = hasProductField ? data.product_id : existing.product_id;
    const resolvedProduct =
      nextProductId !== null && nextProductId !== undefined
        ? repairProduct(
            {
              ...data,
              product_id: nextProductId,
            },
            existing,
          )
        : null;

    if (hasProductField && data.product_id !== existing.product_id) {
      changes.product_id = { from: existing.product_id, to: data.product_id };
      assignments.push('product_id = ?');
      params.push(data.product_id);
    }

    const fields = new Set(UPDATE_FIELDS);
    if (resolvedProduct) {
      fields.add('product_name');
      fields.add('item_no');
      fields.add('color');
      fields.add('size');
    }

    for (const field of fields) {
      let next;
      if (resolvedProduct && field === 'product_name') next = clean(resolvedProduct.product_name);
      else if (resolvedProduct && field === 'item_no') next = clean(resolvedProduct.item_no);
      else if (resolvedProduct && field === 'color') next = clean(resolvedProduct.color);
      else if (resolvedProduct && field === 'size') next = clean(resolvedProduct.size);
      else {
        if (!Object.hasOwn(data, field) || data[field] === undefined) continue;
        next = field === 'repair_date' ? data[field] : clean(data[field]);
      }

      if (next !== existing[field]) {
        changes[field] = { from: existing[field], to: next };
        assignments.push(`${field} = ?`);
        params.push(next);
      }
    }

    if (!assignments.length) return getRepairDetail(id);

    const now = nowIso();
    assignments.push('updated_at = ?');
    params.push(now, id);
    db.prepare(`UPDATE repair_orders SET ${assignments.join(', ')} WHERE id = ?`).run(...params);

    writeAudit({
      userId: user.id,
      username: user.username,
      action: 'repair_update',
      entityType: 'repair',
      entityId: id,
      detail: { ticket_no: existing.ticket_no, changes },
      ip,
    });
    return getRepairDetail(id);
  });
}

export function advanceRepair(id, data, user, ip) {
  return transaction(() => {
    const order = getOrderRow(id);
    if (!order) throw new AppError(404, '维修单不存在');

    const expected = NEXT_STAGE[order.status];
    if (!expected) {
      throw new AppError(409, '该维修单已全部完成，如需返修请点击“再次返厂”');
    }
    if (data.stage !== expected) {
      throw new AppError(
        409,
        `当前状态只能登记“${REPAIR_STATUS_LABELS[expected]}”，请刷新后重试`,
      );
    }

    const trackingNo = clean(data.tracking_no);
    if (expected === 'sent_factory' && !trackingNo) {
      throw new AppError(400, '请填写返厂运单号');
    }

    const eventDate = data.event_date || localDate();
    const now = nowIso();
    db.prepare(
      `INSERT INTO repair_events
         (repair_id, round_no, stage, operator_id, event_date, tracking_no, remark, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      order.current_round,
      expected,
      user.id,
      eventDate,
      trackingNo,
      clean(data.remark),
      now,
    );

    db.prepare('UPDATE repair_orders SET status = ?, updated_at = ? WHERE id = ?').run(
      expected,
      now,
      id,
    );

    writeAudit({
      userId: user.id,
      username: user.username,
      action: 'repair_status',
      entityType: 'repair',
      entityId: id,
      detail: {
        ticket_no: order.ticket_no,
        from_status: order.status,
        to_status: expected,
        round_no: order.current_round,
        event_date: eventDate,
        tracking_no: trackingNo,
      },
      ip,
    });
    return getRepairDetail(id);
  });
}

export function reworkRepair(id, data, user, ip) {
  return transaction(() => {
    const order = getOrderRow(id);
    if (!order) throw new AppError(404, '维修单不存在');
    if (!REWORK_ALLOWED_STATUSES.includes(order.status)) {
      throw new AppError(409, '当前状态不能发起再次返厂');
    }

    const trackingNo = clean(data.tracking_no);
    if (!trackingNo) throw new AppError(400, '请填写返厂运单号');

    const nextRound = Number(order.current_round) + 1;
    const eventDate = data.event_date || localDate();
    const now = nowIso();

    db.prepare(
      `INSERT INTO repair_events
         (repair_id, round_no, stage, operator_id, event_date, tracking_no, remark, created_at)
       VALUES (?, ?, 'sent_factory', ?, ?, ?, ?, ?)`,
    ).run(id, nextRound, user.id, eventDate, trackingNo, clean(data.remark), now);

    db.prepare(
      `UPDATE repair_orders
       SET status = 'sent_factory', current_round = ?, updated_at = ?
       WHERE id = ?`,
    ).run(nextRound, now, id);

    writeAudit({
      userId: user.id,
      username: user.username,
      action: 'repair_rework',
      entityType: 'repair',
      entityId: id,
      detail: {
        ticket_no: order.ticket_no,
        from_status: order.status,
        to_status: 'sent_factory',
        round_no: nextRound,
        event_date: eventDate,
        tracking_no: trackingNo,
      },
      ip,
    });
    return getRepairDetail(id);
  });
}

export function undoLastEvent(id, user, ip) {
  return transaction(() => {
    const order = getOrderRow(id);
    if (!order) throw new AppError(404, '维修单不存在');

    const latest = db
      .prepare(
        `SELECT * FROM repair_events
         WHERE repair_id = ? AND voided_at IS NULL
         ORDER BY id DESC LIMIT 1`,
      )
      .get(id);

    if (!latest) throw new AppError(409, '没有可撤销的状态记录');

    const now = nowIso();
    db.prepare('UPDATE repair_events SET voided_at = ?, voided_by = ? WHERE id = ?').run(
      now,
      user.id,
      latest.id,
    );

    const previous = db
      .prepare(
        `SELECT * FROM repair_events
         WHERE repair_id = ? AND voided_at IS NULL
         ORDER BY round_no DESC, id DESC LIMIT 1`,
      )
      .get(id);

    const nextStatus = previous ? previous.stage : 'pending_factory';
    const nextRound = previous ? previous.round_no : 1;
    db.prepare(
      'UPDATE repair_orders SET status = ?, current_round = ?, updated_at = ? WHERE id = ?',
    ).run(nextStatus, nextRound, now, id);

    writeAudit({
      userId: user.id,
      username: user.username,
      action: 'repair_undo',
      entityType: 'repair',
      entityId: id,
      detail: {
        ticket_no: order.ticket_no,
        undone_event_id: latest.id,
        undone_stage: latest.stage,
        undone_round: latest.round_no,
        restored_status: nextStatus,
        restored_round: nextRound,
      },
      ip,
    });
    return getRepairDetail(id);
  });
}

export function deleteRepair(id, user, ip) {
  return transaction(() => {
    const order = getOrderRow(id);
    if (!order) throw new AppError(404, '维修单不存在');
    const eventCount = Number(
      db.prepare('SELECT COUNT(*) AS count FROM repair_events WHERE repair_id = ?').get(id).count,
    );

    writeAudit({
      userId: user.id,
      username: user.username,
      action: 'repair_delete',
      entityType: 'repair',
      entityId: id,
      detail: {
        ticket_no: order.ticket_no,
        customer_name: order.customer_name,
        status: order.status,
        current_round: order.current_round,
        event_count: eventCount,
      },
      ip,
    });

    db.prepare('DELETE FROM repair_orders WHERE id = ?').run(id);
    return { ok: true };
  });
}
