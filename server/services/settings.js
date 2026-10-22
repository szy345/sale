import { config } from '../config.js';
import { db } from '../db.js';
import { writeAudit } from '../lib/audit.js';
import { nowIso } from '../lib/date.js';
import { AppError } from '../lib/errors.js';

const KEY_SYSTEM_NAME = 'system_name';

function readSetting(key) {
  return db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key)?.value ?? null;
}

export function getSystemName() {
  return (readSetting(KEY_SYSTEM_NAME) || config.shopName || '销售维保系统').trim();
}

export function getSettings() {
  return { systemName: getSystemName(), version: config.appVersion };
}

export function updateSettings(data, user, ip) {
  const systemName = data.system_name.trim();
  if (!systemName) throw new AppError(400, '系统名称不能为空');

  const now = nowIso();
  db.prepare(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(KEY_SYSTEM_NAME, systemName, now);

  writeAudit({
    userId: user.id,
    username: user.username,
    action: 'settings_update',
    entityType: 'settings',
    entityId: KEY_SYSTEM_NAME,
    detail: { system_name: systemName },
    ip,
  });
  return { systemName };
}
