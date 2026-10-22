import { Router } from 'express';
import { closeDb } from '../db.js';
import { parseOrThrow } from '../lib/errors.js';
import { upgradePathSchema } from '../lib/validators.js';
import { authRequired, requireAdmin, requirePasswordChanged } from '../middleware/auth.js';
import { getUpgradeInfo, prepareUpgrade, validateUpgrade } from '../services/upgrade.js';

const router = Router();

router.use(authRequired, requirePasswordChanged, requireAdmin);

router.get('/info', (req, res) => {
  res.json(getUpgradeInfo());
});

router.post('/validate', (req, res) => {
  const data = parseOrThrow(upgradePathSchema, req.body);
  res.json(validateUpgrade(data.new_path));
});

router.post('/', (req, res) => {
  const data = parseOrThrow(upgradePathSchema, req.body);
  const result = prepareUpgrade(data.new_path, req.user, req.ip);
  res.json(result);
  setTimeout(() => {
    closeDb();
    process.exit(0);
  }, 1000);
});

export default router;
