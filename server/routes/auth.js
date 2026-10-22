import { Router } from 'express';
import { db } from '../db.js';
import { writeAudit } from '../lib/audit.js';
import {
  clearAuthCookie,
  hashPassword,
  publicUser,
  setAuthCookie,
  signToken,
  verifyPassword,
} from '../lib/auth.js';
import { nowIso } from '../lib/date.js';
import { AppError, asyncHandler, parseOrThrow } from '../lib/errors.js';
import { authRequired } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { changePasswordSchema, loginSchema } from '../lib/validators.js';

const router = Router();

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const data = parseOrThrow(loginSchema, req.body);
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(data.username);

    const valid = user ? await verifyPassword(data.password, user.password_hash) : false;
    if (!user || !valid || !user.is_active) {
      writeAudit({
        userId: user?.id ?? null,
        username: data.username,
        action: 'login_failed',
        entityType: 'auth',
        detail: { username: data.username },
        ip: req.ip,
      });
      throw new AppError(401, '账号或密码不正确');
    }

    setAuthCookie(res, signToken(user));
    writeAudit({
      userId: user.id,
      username: user.username,
      action: 'login',
      entityType: 'auth',
      entityId: user.id,
      detail: { username: user.username },
      ip: req.ip,
    });
    res.json({ user: publicUser(user) });
  }),
);

router.get('/me', authRequired, (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(row) });
});

router.post('/logout', authRequired, (req, res) => {
  writeAudit({
    userId: req.user.id,
    username: req.user.username,
    action: 'logout',
    entityType: 'auth',
    entityId: req.user.id,
    ip: req.ip,
  });
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.post(
  '/change-password',
  authRequired,
  asyncHandler(async (req, res) => {
    const data = parseOrThrow(changePasswordSchema, req.body);
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    if (!(await verifyPassword(data.old_password, row.password_hash))) {
      throw new AppError(400, '原密码不正确');
    }
    if (data.old_password === data.new_password) {
      throw new AppError(400, '新密码不能与原密码相同');
    }

    const passwordHash = await hashPassword(data.new_password);
    db.prepare(
      `UPDATE users
       SET password_hash = ?, must_change_password = 0,
           token_version = token_version + 1, updated_at = ?
       WHERE id = ?`,
    ).run(passwordHash, nowIso(), req.user.id);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    setAuthCookie(res, signToken(updated));

    writeAudit({
      userId: req.user.id,
      username: req.user.username,
      action: 'password_change',
      entityType: 'user',
      entityId: req.user.id,
      ip: req.ip,
    });
    res.json({ user: publicUser(updated) });
  }),
);

export default router;
