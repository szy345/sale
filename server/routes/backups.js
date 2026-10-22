import { Router } from 'express';
import { closeDb } from '../db.js';
import { parseOrThrow } from '../lib/errors.js';
import { backupSettingsSchema } from '../lib/validators.js';
import { authRequired, requireAdmin, requirePasswordChanged } from '../middleware/auth.js';
import {
  createBackup,
  deleteBackup,
  getBackupsOverview,
  prepareRestore,
  resolveBackupFile,
  updateBackupSettings,
} from '../services/backups.js';

const router = Router();

router.use(authRequired, requirePasswordChanged, requireAdmin);

router.get('/', (req, res) => {
  res.json(getBackupsOverview());
});

router.post('/', (req, res) => {
  const backup = createBackup('manual', req.user, req.ip);
  res.status(201).json(backup);
});

router.patch('/settings', (req, res) => {
  const data = parseOrThrow(backupSettingsSchema, req.body);
  res.json(updateBackupSettings(data, req.user, req.ip));
});

router.get('/:name/download', (req, res) => {
  const file = resolveBackupFile(req.params.name);
  res.download(file, req.params.name);
});

router.post('/:name/restore', (req, res) => {
  const result = prepareRestore(req.params.name, req.user, req.ip);
  res.json({
    ...result,
    message: `恢复已开始。当前数据已备份为 ${result.safetyBackup}，系统即将重启。`,
  });
  setTimeout(() => {
    closeDb();
    process.exit(0);
  }, 1000);
});

router.delete('/:name', (req, res) => {
  const result = deleteBackup(req.params.name, req.user, req.ip);
  res.json(result);
});

export default router;
