import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { config, rootDir } from '../config.js';
import { db } from '../db.js';
import { writeAudit } from '../lib/audit.js';
import { backupType, isSafeBackupName } from '../lib/backupNames.js';
import { localDate, localTime, nowIso } from '../lib/date.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const BACKUP_DIR = path.join(config.dataDir, 'backups');
const RESTORE_MANIFEST = path.join(config.dataDir, 'restore-request.json');
const RESTORE_HELPER = path.join(rootDir, 'scripts', 'common', 'restore-helper.mjs');
const DEFAULT_SETTINGS = { enabled: true, time: '02:00', retention: 30 };

fs.mkdirSync(BACKUP_DIR, { recursive: true });

function readSetting(key, fallback) {
  return db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key)?.value ?? fallback;
}

function writeSetting(key, value) {
  db.prepare(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, String(value), nowIso());
}

function normalizeTime(value) {
  return /^\d{2}:\d{2}$/.test(String(value)) ? String(value) : DEFAULT_SETTINGS.time;
}

export function getBackupSettings() {
  const retention = Number(readSetting('backup_retention', DEFAULT_SETTINGS.retention));
  return {
    enabled: readSetting('backup_enabled', '1') === '1',
    time: normalizeTime(readSetting('backup_time', DEFAULT_SETTINGS.time)),
    retention:
      Number.isInteger(retention) && retention >= 1 && retention <= 365
        ? retention
        : DEFAULT_SETTINGS.retention,
  };
}

function fileInfo(name) {
  const file = path.join(BACKUP_DIR, name);
  const stat = fs.statSync(file);
  return {
    name,
    type: backupType(name),
    size: stat.size,
    createdAt: stat.mtime.toISOString(),
  };
}

export function listBackups() {
  return fs
    .readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.db'))
    .map((entry) => fileInfo(entry.name))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getBackupsOverview() {
  const files = listBackups();
  return {
    settings: getBackupSettings(),
    files,
    lastAutoAt: files.find((file) => file.type === 'auto')?.createdAt || null,
    lastBackupAt: files[0]?.createdAt || null,
    backupDir: BACKUP_DIR,
  };
}

export function createBackup(type, user, ip) {
  const prefix = type === 'auto' ? 'auto' : 'manual';
  const date = localDate();
  const time = localTime().replaceAll(':', '');
  const base = `${prefix}-${date.replaceAll('-', '')}-${time}`;

  let name = `${base}.db`;
  let file = path.join(BACKUP_DIR, name);
  let suffix = 2;
  while (fs.existsSync(file)) {
    name = `${base}-${suffix}.db`;
    file = path.join(BACKUP_DIR, name);
    suffix += 1;
  }

  const sqlPath = file.replaceAll('\\', '/').replaceAll("'", "''");
  db.exec(`VACUUM INTO '${sqlPath}'`);
  const info = fileInfo(name);

  writeAudit({
    userId: user?.id ?? null,
    username: user?.username || '系统自动备份',
    action: 'backup_create',
    entityType: 'backup',
    entityId: name,
    detail: { type: info.type, size: info.size },
    ip,
  });

  if (type === 'auto') {
    pruneAutoBackups(getBackupSettings().retention);
  }
  return info;
}

function pruneAutoBackups(retention) {
  const files = listBackups().filter((file) => file.type === 'auto');
  for (const file of files.slice(retention)) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, file.name));
      logger.info('自动备份清理旧文件', { name: file.name });
    } catch (error) {
      logger.warn('自动备份清理失败', { name: file.name, message: error.message });
    }
  }
}

export function updateBackupSettings(data, user, ip) {
  writeSetting('backup_enabled', data.enabled ? '1' : '0');
  writeSetting('backup_time', data.time);
  writeSetting('backup_retention', data.retention);

  writeAudit({
    userId: user.id,
    username: user.username,
    action: 'backup_settings_update',
    entityType: 'backup',
    entityId: 'settings',
    detail: data,
    ip,
  });
  return getBackupSettings();
}

export function resolveBackupFile(name) {
  if (!isSafeBackupName(name)) throw new AppError(400, '备份文件名不正确');
  const file = path.join(BACKUP_DIR, name);
  if (!fs.existsSync(file)) throw new AppError(404, '备份文件不存在');
  return file;
}

function validateBackupForRestore(file) {
  let source;
  try {
    source = new DatabaseSync(file, { readOnly: true });
    const check = source.prepare('PRAGMA quick_check').get();
    const status = check ? Object.values(check)[0] : null;
    if (status !== 'ok') throw new AppError(400, '备份文件校验失败，无法恢复');

    const backupVersion = Number(source.prepare('PRAGMA user_version').get().user_version);
    const currentVersion = Number(db.prepare('PRAGMA user_version').get().user_version);
    if (backupVersion < 1 || backupVersion > currentVersion) {
      throw new AppError(400, '备份文件版本与当前系统不兼容，无法恢复');
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, '备份文件不是有效的数据库文件，无法恢复');
  } finally {
    try {
      source?.close();
    } catch {
      // Ignore close errors after validation.
    }
  }
}

export function prepareRestore(name, user, ip) {
  if (fs.existsSync(RESTORE_MANIFEST)) {
    throw new AppError(409, '已有恢复任务正在执行，请稍后再试');
  }

  const source = resolveBackupFile(name);
  validateBackupForRestore(source);

  // Always create a safety backup before replacing the live database.
  const safety = createBackup('manual', user, ip);
  const manifest = {
    pid: process.pid,
    source,
    target: config.dbPath,
    root: rootDir,
    logPath: path.join(config.dataDir, 'logs', 'restore.log'),
  };

  fs.writeFileSync(RESTORE_MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
  try {
    const child = spawn(process.execPath, [RESTORE_HELPER, RESTORE_MANIFEST], {
      cwd: rootDir,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: process.env,
    });
    child.unref();
  } catch {
    fs.rmSync(RESTORE_MANIFEST, { force: true });
    throw new AppError(500, '无法启动恢复进程，请检查服务器日志');
  }

  writeAudit({
    userId: user.id,
    username: user.username,
    action: 'backup_restore',
    entityType: 'backup',
    entityId: name,
    detail: { source: name, safety_backup: safety.name },
    ip,
  });

  return { source: name, safetyBackup: safety.name, restarting: true };
}

export function deleteBackup(name, user, ip) {
  const file = resolveBackupFile(name);
  const info = fileInfo(name);
  fs.unlinkSync(file);

  writeAudit({
    userId: user.id,
    username: user.username,
    action: 'backup_delete',
    entityType: 'backup',
    entityId: name,
    detail: { type: info.type, size: info.size },
    ip,
  });
  return { ok: true };
}

export function runAutoBackupIfDue() {
  const settings = getBackupSettings();
  if (!settings.enabled) return;

  const now = localTime().slice(0, 5);
  if (now < settings.time) return;

  const today = localDate().replaceAll('-', '');
  const existing = listBackups().some(
    (file) => file.type === 'auto' && file.name.startsWith(`auto-${today}-`),
  );
  if (existing) return;

  try {
    const file = createBackup('auto', null, '127.0.0.1');
    logger.info('自动备份完成', { name: file.name, size: file.size });
  } catch (error) {
    logger.error('自动备份失败', { message: error.message });
  }
}

let scheduler = null;

export function startBackupScheduler() {
  if (scheduler) return;
  runAutoBackupIfDue();
  scheduler = setInterval(runAutoBackupIfDue, 60 * 1000);
  if (scheduler.unref) scheduler.unref();
}

export function stopBackupScheduler() {
  if (scheduler) {
    clearInterval(scheduler);
    scheduler = null;
  }
}
