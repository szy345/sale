import { Router } from 'express';
import { getPublicRepairByToken } from '../services/publicRepairs.js';

const router = Router();

router.get('/repairs/:token', (req, res) => {
  res.json(getPublicRepairByToken(req.params.token));
});

export default router;
