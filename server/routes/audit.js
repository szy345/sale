import { Router } from 'express';
import { authRequired, requireAdmin, requirePasswordChanged } from '../middleware/auth.js';
import { getAuditActions, listAuditLogs } from '../services/auditLogs.js';

const router = Router();

router.use(authRequired, requirePasswordChanged, requireAdmin);

router.get('/actions', (req, res) => {
  res.json({ items: getAuditActions() });
});

router.get('/', (req, res) => {
  res.json(listAuditLogs(req.query));
});

export default router;
