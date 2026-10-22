import os from 'node:os';
import { Router } from 'express';
import { config } from '../config.js';
import {
  HANDLING_OPTIONS,
  REPAIR_STAGES,
  REPAIR_STATUSES,
  REPAIR_STATUS_LABELS,
  RETURN_REASON_OPTIONS,
  STAGE_ACTION_LABELS,
} from '../lib/constants.js';
import { authRequired } from '../middleware/auth.js';
import { getSystemName } from '../services/settings.js';

const router = Router();

function publicBaseUrl(req) {
  if (config.publicBaseUrl) return config.publicBaseUrl.replace(/\/+$/, '');
  const host = req.get('host') || '';
  if (host && !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host)) {
    return `${req.protocol}://${host}`;
  }

  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal);
  const ip = addresses[0]?.address || '127.0.0.1';
  return `http://${ip}:${config.port}`;
}

router.get('/', authRequired, (req, res) => {
  res.json({
    systemName: getSystemName(),
    baseUrl: publicBaseUrl(req),
    shop: {
      name: getSystemName(),
      phone: config.shopPhone,
      address: config.shopAddress,
    },
    repairStatuses: REPAIR_STATUSES.map((value) => ({
      value,
      label: REPAIR_STATUS_LABELS[value],
    })),
    repairStages: REPAIR_STAGES.map((value) => ({
      value,
      label: REPAIR_STATUS_LABELS[value],
      action: STAGE_ACTION_LABELS[value],
    })),
    handlings: HANDLING_OPTIONS,
    returnReasons: RETURN_REASON_OPTIONS,
  });
});

export default router;
