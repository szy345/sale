import os from 'node:os';
import { createApp } from './app.js';
import { config } from './config.js';
import { closeDb } from './db.js';
import { logger } from './lib/logger.js';
import { getSystemName } from './services/settings.js';
import { startBackupScheduler, stopBackupScheduler } from './services/backups.js';

const app = createApp();

const server = app.listen(config.port, config.host, () => {
  const urls = [`http://localhost:${config.port}`];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        urls.push(`http://${entry.address}:${config.port}`);
      }
    }
  }
  logger.info('服务已启动', { urls, db: config.dbPath, systemName: getSystemName() });
  console.log('');
  console.log(`${getSystemName()}销售维保系统已启动，可通过以下地址访问：`);
  for (const url of urls) console.log(`  ${url}`);
  console.log('');
  startBackupScheduler();
});

server.on('error', (error) => {
  logger.error('服务启动失败', { message: error.message });
  process.exit(1);
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('正在关闭服务', { signal });
  stopBackupScheduler();
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  setTimeout(() => {
    closeDb();
    process.exit(1);
  }, 8000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGBREAK', () => shutdown('SIGBREAK'));
