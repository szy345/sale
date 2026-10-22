import { Router } from 'express';
import { parseOrThrow } from '../lib/errors.js';
import { licenseImportSchema } from '../lib/validators.js';
import { authRequired, requireAdmin, requirePasswordChanged } from '../middleware/auth.js';
import { getLicenseStatus, importLicense } from '../services/license.js';

const router = Router();

router.get('/status', authRequired, (req, res) => {
  res.json(getLicenseStatus());
});

router.post(
  '/import',
  authRequired,
  requirePasswordChanged,
  requireAdmin,
  (req, res) => {
    const data = parseOrThrow(licenseImportSchema, req.body);
    res.json(importLicense(data.content_base64, req.user, req.ip));
  },
);

export default router;
