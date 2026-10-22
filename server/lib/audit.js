import { db } from '../db.js';
import { nowIso } from './date.js';

export function writeAudit({
  userId = null,
  username = '',
  action,
  entityType = '',
  entityId = null,
  detail = null,
  ip = '',
}) {
  db.prepare(
    `INSERT INTO audit_logs
       (user_id, username, action, entity_type, entity_id, detail, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    userId,
    username,
    action,
    entityType,
    entityId === null ? null : String(entityId),
    detail === null ? null : JSON.stringify(detail),
    ip || '',
    nowIso(),
  );
}
