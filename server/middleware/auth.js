import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db.js';
import { COOKIE_NAME } from '../lib/auth.js';

export function authRequired(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) throw new Error('missing token');

    const payload = jwt.verify(token, config.jwtSecret);
    const row = db
      .prepare(
        `SELECT id, username, display_name, role, is_active, must_change_password, token_version
         FROM users WHERE id = ?`,
      )
      .get(payload.uid);

    if (!row || !row.is_active || Number(row.token_version) !== Number(payload.tv)) {
      throw new Error('invalid session');
    }

    req.user = {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
      mustChangePassword: Boolean(row.must_change_password),
    };
    next();
  } catch {
    res.status(401).json({ code: 'UNAUTHORIZED', message: '登录已失效，请重新登录' });
  }
}

export function requirePasswordChanged(req, res, next) {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: '请先修改初始密码',
    });
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ code: 'FORBIDDEN', message: '没有权限执行此操作' });
  }
  next();
}
