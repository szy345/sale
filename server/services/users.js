import { db } from '../db.js';
import { writeAudit } from '../lib/audit.js';
import { hashPassword, publicUser } from '../lib/auth.js';
import { nowIso } from '../lib/date.js';
import { AppError } from '../lib/errors.js';

function getUserRow(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function activeAdminCount(excludeId = null) {
  const row = excludeId
    ? db
        .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1 AND id <> ?")
        .get(excludeId)
    : db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1").get();
  return Number(row.count);
}

function isUniqueError(error) {
  return String(error?.message || '').includes('UNIQUE constraint failed');
}

export function listUsers() {
  return db
    .prepare(
      `SELECT id, username, display_name, role, is_active, must_change_password,
              created_at, updated_at
       FROM users
       ORDER BY is_active DESC, role ASC, id ASC`,
    )
    .all()
    .map((row) => ({
      ...row,
      is_active: Boolean(row.is_active),
      must_change_password: Boolean(row.must_change_password),
    }));
}

export async function createUser(data, actor, ip) {
  const now = nowIso();
  const passwordHash = await hashPassword(data.password);
  let result;
  try {
    result = db
      .prepare(
        `INSERT INTO users
           (username, password_hash, display_name, role, is_active, must_change_password,
            token_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, 1, 0, ?, ?)`,
      )
      .run(data.username, passwordHash, data.display_name, data.role, now, now);
  } catch (error) {
    if (isUniqueError(error)) throw new AppError(409, '该账号已存在');
    throw error;
  }

  const id = Number(result.lastInsertRowid);
  writeAudit({
    userId: actor.id,
    username: actor.username,
    action: 'user_create',
    entityType: 'user',
    entityId: id,
    detail: { username: data.username, display_name: data.display_name, role: data.role },
    ip,
  });
  return publicUser(getUserRow(id));
}

export function updateUser(id, data, actor, ip) {
  const target = getUserRow(id);
  if (!target) throw new AppError(404, '账号不存在');

  const nextRole = data.role ?? target.role;
  const nextActive = data.is_active === undefined ? Boolean(target.is_active) : data.is_active;
  const nextDisplayName = data.display_name ?? target.display_name;

  if (id === actor.id && (!nextActive || nextRole !== 'admin')) {
    throw new AppError(400, '不能停用自己或取消自己的管理员权限');
  }

  const wasActiveAdmin = target.role === 'admin' && Boolean(target.is_active);
  const willBeActiveAdmin = nextRole === 'admin' && nextActive;
  if (wasActiveAdmin && !willBeActiveAdmin && activeAdminCount(id) === 0) {
    throw new AppError(400, '系统至少需要保留一个启用的管理员');
  }

  const changes = {};
  if (nextDisplayName !== target.display_name) {
    changes.display_name = { from: target.display_name, to: nextDisplayName };
  }
  if (nextRole !== target.role) {
    changes.role = { from: target.role, to: nextRole };
  }
  if (nextActive !== Boolean(target.is_active)) {
    changes.is_active = { from: Boolean(target.is_active), to: nextActive };
  }

  if (Object.keys(changes).length === 0) return publicUser(target);

  const invalidateTokens =
    nextRole !== target.role || nextActive !== Boolean(target.is_active);
  const now = nowIso();
  db.prepare(
    `UPDATE users
     SET display_name = ?, role = ?, is_active = ?,
         token_version = token_version + ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    nextDisplayName,
    nextRole,
    nextActive ? 1 : 0,
    invalidateTokens ? 1 : 0,
    now,
    id,
  );

  writeAudit({
    userId: actor.id,
    username: actor.username,
    action: 'user_update',
    entityType: 'user',
    entityId: id,
    detail: { username: target.username, changes },
    ip,
  });
  return publicUser(getUserRow(id));
}

export async function resetPassword(id, password, actor, ip) {
  const target = getUserRow(id);
  if (!target) throw new AppError(404, '账号不存在');
  if (id === actor.id) {
    throw new AppError(400, '请在个人菜单中修改自己的密码');
  }

  const passwordHash = await hashPassword(password);
  db.prepare(
    `UPDATE users
     SET password_hash = ?, must_change_password = 1,
         token_version = token_version + 1, updated_at = ?
     WHERE id = ?`,
  ).run(passwordHash, nowIso(), id);

  writeAudit({
    userId: actor.id,
    username: actor.username,
    action: 'user_reset_password',
    entityType: 'user',
    entityId: id,
    detail: { username: target.username },
    ip,
  });
  return { ok: true };
}
