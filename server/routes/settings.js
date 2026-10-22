import { Router } from 'express';
import { parseOrThrow } from '../lib/errors.js';
import { updateSettingsSchema } from '../lib/validators.js';
import { authRequired, requireAdmin, requirePasswordChanged } from '../middleware/auth.js';
import { getSettings, updateSettings } from '../services/settings.js';

const router = Router();

router.get('/public', (req, res) => {
  res.json(getSettings());
});

router.get('/', authRequired, (req, res) => {
  res.json(getSettings());
});

router.patch('/', authRequired, requirePasswordChanged, requireAdmin, (req, res) => {
  const data = parseOrThrow(updateSettingsSchema, req.body);
  const result = updateSettings(data, req.user, req.ip);
  res.json(result);
});

export default router;
