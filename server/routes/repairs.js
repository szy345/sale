import { Router } from 'express';
import { asyncHandler, parseOrThrow } from '../lib/errors.js';
import {
  createRepairSchema,
  repairReworkSchema,
  repairStatusSchema,
  updateRepairSchema,
} from '../lib/validators.js';
import { authRequired, requireAdmin, requirePasswordChanged } from '../middleware/auth.js';
import {
  advanceRepair,
  createRepair,
  deleteRepair,
  getRepairDetail,
  listRepairs,
  reworkRepair,
  undoLastEvent,
  updateRepair,
} from '../services/repairs.js';

const router = Router();

router.use(authRequired, requirePasswordChanged);

router.get('/', (req, res) => {
  res.json(listRepairs(req.query));
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parseOrThrow(createRepairSchema, req.body);
    const repair = createRepair(data, req.user, req.ip);
    res.status(201).json(repair);
  }),
);

router.get('/:id', (req, res) => {
  res.json(getRepairDetail(Number(req.params.id)));
});

router.patch('/:id', (req, res) => {
  const data = parseOrThrow(updateRepairSchema, req.body);
  const repair = updateRepair(Number(req.params.id), data, req.user, req.ip);
  res.json(repair);
});

router.post('/:id/status', (req, res) => {
  const data = parseOrThrow(repairStatusSchema, req.body);
  const repair = advanceRepair(Number(req.params.id), data, req.user, req.ip);
  res.json(repair);
});

router.post('/:id/rework', (req, res) => {
  const data = parseOrThrow(repairReworkSchema, req.body);
  const repair = reworkRepair(Number(req.params.id), data, req.user, req.ip);
  res.json(repair);
});

router.post('/:id/undo-last', requireAdmin, (req, res) => {
  const repair = undoLastEvent(Number(req.params.id), req.user, req.ip);
  res.json(repair);
});

router.delete('/:id', requireAdmin, (req, res) => {
  const result = deleteRepair(Number(req.params.id), req.user, req.ip);
  res.json(result);
});

export default router;
