import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { localDate, localTime } from './lib/date.js';
import { logger } from './lib/logger.js';

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');
db.exec('PRAGMA synchronous = NORMAL;');

function backupBeforeMigration(currentVersion, pendingVersions) {
  const backupDir = path.join(config.dataDir, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const stamp = `${localDate().replaceAll('-', '')}-${localTime().replaceAll(':', '')}`;
  let name = `pre-migration-v${currentVersion}-${stamp}.db`;
  let file = path.join(backupDir, name);
  let suffix = 2;
  while (fs.existsSync(file)) {
    name = `pre-migration-v${currentVersion}-${stamp}-${suffix}.db`;
    file = path.join(backupDir, name);
    suffix += 1;
  }

  const sqlPath = file.replaceAll('\\', '/').replaceAll("'", "''");
  db.exec(`VACUUM INTO '${sqlPath}'`);
  logger.info('数据库升级前备份已创建', {
    file: name,
    fromVersion: currentVersion,
    pendingVersions,
  });
}

function migrate() {
  const current = Number(db.prepare('PRAGMA user_version').get().user_version || 0);
  const files = fs
    .readdirSync(migrationsDir)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();

  const pending = files
    .map((file) => ({ file, version: Number(file.split('_')[0]) }))
    .filter(({ version }) => Number.isFinite(version) && version > current);

  if (!pending.length) return;

  if (current > 0) {
    backupBeforeMigration(
      current,
      pending.map(({ version }) => version),
    );
  }

  for (const { file, version } of pending) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${version};`);
      db.exec('COMMIT;');
      logger.info('数据库迁移完成', { file, version });
    } catch (error) {
      db.exec('ROLLBACK;');
      logger.error('数据库迁移失败', { file, version, message: error.message });
      throw error;
    }
  }
}

migrate();

export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // Ignore rollback errors so the original error is preserved.
    }
    throw error;
  }
}

export function closeDb() {
  try {
    db.close();
  } catch {
    // Ignore close errors during shutdown.
  }
}

export { db };
