import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const manifestPath = process.argv[2];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(message) {
  try {
    const file = restoreLogPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const line = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(file, line);
  } catch {
    // Ignore restore log failures.
  }
}

function restoreLogPath() {
  const dataDir = path.dirname(manifestPath);
  return path.join(dataDir, 'logs', 'restore.log');
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function startServer(manifest) {
  const child = spawn(process.execPath, [path.join(manifest.root, 'server', 'index.js')], {
    cwd: manifest.root,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: process.env,
  });
  child.unref();
  log(`server restarted, pid=${child.pid}`);
}

async function main() {
  if (!manifestPath || !fs.existsSync(manifestPath)) {
    log('restore manifest not found');
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  log(`restore requested: source=${manifest.source} target=${manifest.target} pid=${manifest.pid}`);

  const deadline = Date.now() + 30000;
  while (isAlive(manifest.pid) && Date.now() < deadline) {
    await sleep(500);
  }
  if (isAlive(manifest.pid)) {
    log('old server is still running; restore aborted');
    fs.rmSync(manifestPath, { force: true });
    return;
  }

  await sleep(500);
  let copied = false;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      fs.copyFileSync(manifest.source, manifest.target);
      fs.rmSync(`${manifest.target}-wal`, { force: true });
      fs.rmSync(`${manifest.target}-shm`, { force: true });
      copied = true;
      break;
    } catch (error) {
      log(`copy attempt ${attempt} failed: ${error.message}`);
      await sleep(500);
    }
  }

  if (!copied) log('restore copy failed; starting server with existing database');
  else log('database file replaced');

  startServer(manifest);
  fs.rmSync(manifestPath, { force: true });
}

main().catch((error) => {
  log(`restore helper error: ${error.message}`);
});
