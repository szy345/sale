import { Router } from 'express';
import { authRequired, requirePasswordChanged } from '../middleware/auth.js';
import { getDashboard } from '../services/dashboard.js';

const router = Router();

router.get('/', authRequired, requirePasswordChanged, (req, res) => {
  res.json(getDashboard());
});

export default router;
