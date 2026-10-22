import { Router } from 'express';
import { db, transaction } from '../db.js';
import { writeAudit } from '../lib/audit.js';
import { hashPassword, publicUser, setAuthCookie, signToken } from '../lib/auth.js';
import { nowIso } from '../lib/date.js';
import { AppError, asyncHandler, parseOrThrow } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { setupSchema } from '../lib/validators.js';
import { startTrial } from '../services/license.js';

const router = Router();

function userCount() {
  return Number(db.prepare('SELECT COUNT(*) AS count FROM users').get().count);
}

router.get('/status', (req, res) => {
  res.json({ needsSetup: userCount() === 0 });
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parseOrThrow(setupSchema, req.body);
    const passwordHash = await hashPassword(data.password);

    const user = transaction(() => {
      if (userCount() > 0) {
        throw new AppError(409, '系统已经初始化，不能重复创建管理员');
      }

      const now = nowIso();
      const result = db
        .prepare(
          `INSERT INTO users
             (username, password_hash, display_name, role, is_active,
              must_change_password, token_version, created_at, updated_at)
           VALUES (?, ?, ?, 'admin', 1, 0, 0, ?, ?)`,
        )
        .run(data.username, passwordHash, data.display_name, now, now);

      const id = Number(result.lastInsertRowid);
      writeAudit({
        userId: id,
        username: data.username,
        action: 'system_setup',
        entityType: 'user',
        entityId: id,
        detail: { username: data.username, display_name: data.display_name },
        ip: req.ip,
      });
      return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    });

    try {
      startTrial(user, req.ip);
    } catch (error) {
      logger.error('试用初始化失败', { message: error.message });
    }

    setAuthCookie(res, signToken(user));
    res.status(201).json({ user: publicUser(user) });
  }),
);

export default router;
