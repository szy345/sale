import { Router } from 'express';
import { asyncHandler, parseOrThrow } from '../lib/errors.js';
import { createReturnSchema, updateReturnSchema } from '../lib/validators.js';
import { authRequired, requireAdmin, requirePasswordChanged } from '../middleware/auth.js';
import {
  createReturn,
  deleteReturn,
  getReturnDetail,
  listReturns,
  updateReturn,
} from '../services/returns.js';

const router = Router();

router.use(authRequired, requirePasswordChanged);

router.get('/', (req, res) => {
  res.json(listReturns(req.query));
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parseOrThrow(createReturnSchema, req.body);
    const item = createReturn(data, req.user, req.ip);
    res.status(201).json(item);
  }),
);

router.get('/:id', (req, res) => {
  res.json(getReturnDetail(Number(req.params.id)));
});

router.patch('/:id', (req, res) => {
  const data = parseOrThrow(updateReturnSchema, req.body);
  const item = updateReturn(Number(req.params.id), data, req.user, req.ip);
  res.json(item);
});

router.delete('/:id', requireAdmin, (req, res) => {
  const result = deleteReturn(Number(req.params.id), req.user, req.ip);
  res.json(result);
});

export default router;
