import { Router } from 'express';
import { asyncHandler, parseOrThrow } from '../lib/errors.js';
import { createUserSchema, resetPasswordSchema, updateUserSchema } from '../lib/validators.js';
import { authRequired, requireAdmin, requirePasswordChanged } from '../middleware/auth.js';
import {
  createUser,
  listUsers,
  resetPassword,
  updateUser,
} from '../services/users.js';

const router = Router();

router.use(authRequired, requirePasswordChanged, requireAdmin);

router.get('/', (req, res) => {
  res.json({ items: listUsers() });
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parseOrThrow(createUserSchema, req.body);
    const user = await createUser(data, req.user, req.ip);
    res.status(201).json(user);
  }),
);

router.patch('/:id', (req, res) => {
  const data = parseOrThrow(updateUserSchema, req.body);
  const user = updateUser(Number(req.params.id), data, req.user, req.ip);
  res.json(user);
});

router.post(
  '/:id/reset-password',
  asyncHandler(async (req, res) => {
    const data = parseOrThrow(resetPasswordSchema, req.body);
    const result = await resetPassword(Number(req.params.id), data.password, req.user, req.ip);
    res.json(result);
  }),
);

export default router;
