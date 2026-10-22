import { db } from '../db.js';
import { pagination } from '../lib/validators.js';

function parseDetail(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, '\\$&');
}

export function listAuditLogs(query = {}) {
  const { page, pageSize, offset } = pagination(query);
  const where = [];
  const params = [];

  if (query.action) {
    where.push('a.action = ?');
    params.push(query.action);
  }
  if (query.entityType) {
    where.push('a.entity_type = ?');
    params.push(query.entityType);
  }
  if (query.keyword) {
    const like = `%${escapeLike(String(query.keyword).trim())}%`;
    where.push(
      `(a.username LIKE ? ESCAPE '\\' OR a.action LIKE ? ESCAPE '\\'
        OR a.entity_type LIKE ? ESCAPE '\\' OR a.detail LIKE ? ESCAPE '\\')`,
    );
    params.push(like, like, like, like);
  }
  if (query.dateFrom) {
    where.push("date(a.created_at, 'localtime') >= ?");
    params.push(query.dateFrom);
  }
  if (query.dateTo) {
    where.push("date(a.created_at, 'localtime') <= ?");
    params.push(query.dateTo);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number(
    db.prepare(`SELECT COUNT(*) AS count FROM audit_logs a ${whereSql}`).get(...params).count,
  );

  const items = db
    .prepare(
      `SELECT a.* FROM audit_logs a ${whereSql}
       ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset)
    .map((row) => ({ ...row, detail: parseDetail(row.detail) }));

  return { items, total, page, pageSize };
}

export function getAuditActions() {
  return db
    .prepare('SELECT DISTINCT action FROM audit_logs ORDER BY action ASC')
    .all()
    .map((row) => row.action);
}
