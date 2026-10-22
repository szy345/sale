import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const manifestPath = process.argv[2];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let logPath = null;

function log(message) {
  const file = logPath || path.join(process.env.TEMP || process.env.TMP || '.', 'yearcon-upgrade.log');
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // Logging must not stop the upgrade.
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function cleanEnv() {
  const env = { ...process.env, NODE_ENV: 'production' };
  delete env.YK_DATA_DIR;
  delete env.YK_DB_PATH;
  delete env.YK_PORT;
  delete env.YK_JWT_SECRET;
  return env;
}

function killProcess(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
    } else {
      process.kill(pid, 'SIGTERM');
    }
  } catch (error) {
    log(`failed to stop process ${pid}: ${error.message}`);
  }
}

function stopWindowsTask(manifest) {
  if (process.platform !== 'win32' || !manifest.taskName) return;
  try {
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Stop-ScheduledTask -TaskName '${manifest.taskName.replaceAll("'", "''")}' -ErrorAction SilentlyContinue`,
      ],
      { windowsHide: true, encoding: 'utf8' },
    );
    if (result.status === 0) log('old scheduled task stopped');
  } catch (error) {
    log(`stop scheduled task failed: ${error.message}`);
  }
}

function updateWindowsTask(manifest) {
  if (process.platform !== 'win32') return 'not-supported';
  if (!fs.existsSync(manifest.serviceScript)) return 'missing-script';

  try {
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        manifest.serviceScript,
        '-Root',
        manifest.newRoot,
        '-NodePath',
        manifest.nodeExe,
      ],
      { windowsHide: true, encoding: 'utf8' },
    );
    if (result.status === 0) return 'updated';
    if (result.status === 2) return 'not-installed';
    log(`update scheduled task failed: ${result.stderr || result.stdout || result.status}`);
    return 'failed';
  } catch (error) {
    log(`update scheduled task error: ${error.message}`);
    return 'failed';
  }
}

function startServer(root, nodeExe, env) {
  const child = spawn(nodeExe, [path.join(root, 'server', 'index.js')], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env,
  });
  child.unref();
  log(`server started from ${root}, pid=${child.pid}`);
  return child;
}

async function waitForHealth(port, expectedVersion, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        if (!expectedVersion || !data.version || data.version === expectedVersion) {
          return true;
        }
      }
    } catch {
      // Server is still restarting.
    }
    await sleep(1000);
  }
  return false;
}

function waitForPortFree(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return (async () => {
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
          cache: 'no-store',
        });
        if (!response.ok) return true;
      } catch {
        return true;
      }
      await sleep(500);
    }
    return false;
  })();
}

function writeResult(file, result) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(result, null, 2), 'utf8');
  } catch (error) {
    log(`write result failed: ${error.message}`);
  }
}

function publishLog(dataDir) {
  try {
    const target = path.join(dataDir, 'logs', 'upgrade.log');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (logPath && fs.existsSync(logPath)) fs.copyFileSync(logPath, target);
    return target;
  } catch (error) {
    log(`publish log failed: ${error.message}`);
    return logPath;
  }
}

function verifyCopiedDatabase(dataDir) {
  const file = path.join(dataDir, 'app.db');
  if (!fs.existsSync(file)) throw new Error('复制后未找到 data/app.db');
  const database = new DatabaseSync(file, { readOnly: true });
  try {
    const check = database.prepare('PRAGMA quick_check').get();
    if (!check || Object.values(check)[0] !== 'ok') {
      throw new Error('复制后的数据库校验失败');
    }
  } finally {
    database.close();
  }
}

async function rollback(manifest, reason) {
  log(`rollback: ${reason}`);
  const oldChild = startServer(manifest.oldRoot, process.execPath, process.env);

  const healthy = await waitForHealth(manifest.port, manifest.oldVersion, 60000);
  const result = {
    status: 'failed',
    oldRoot: manifest.oldRoot,
    newRoot: manifest.newRoot,
    oldVersion: manifest.oldVersion,
    newVersion: manifest.newVersion,
    reason,
    oldServerHealthy: healthy,
    serviceUpdated: 'unchanged',
    finishedAt: new Date().toISOString(),
  };

  writeResult(manifest.resultPathOld, result);
  writeResult(manifest.resultPathNew, result);
  result.logFile = publishLog(manifest.oldDataDir);
  log(`rollback completed, old server healthy=${healthy}, pid=${oldChild.pid}`);
}

async function main() {
  if (!manifestPath || !fs.existsSync(manifestPath)) {
    log('upgrade manifest not found');
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  logPath = manifest.logPath;
  log(`upgrade requested: ${manifest.oldRoot} -> ${manifest.newRoot}`);

  const deadline = Date.now() + 35000;
  while (isAlive(manifest.pid) && Date.now() < deadline) {
    await sleep(500);
  }
  if (isAlive(manifest.pid)) {
    await rollback(manifest, '旧系统进程未能在规定时间内停止');
    fs.rmSync(manifestPath, { force: true });
    return;
  }

  stopWindowsTask(manifest);
  const portFree = await waitForPortFree(manifest.port, 15000);
  if (!portFree) {
    await rollback(manifest, '3000 端口仍被占用，无法启动新系统');
    fs.rmSync(manifestPath, { force: true });
    return;
  }

  try {
    fs.mkdirSync(manifest.newDataDir, { recursive: true });
    fs.cpSync(manifest.oldDataDir, manifest.newDataDir, {
      recursive: true,
      force: true,
    });
    fs.rmSync(path.join(manifest.newDataDir, 'restore-request.json'), { force: true });
    fs.rmSync(path.join(manifest.newDataDir, 'upgrade-request.json'), { force: true });

    if (fs.existsSync(manifest.oldConfigPath)) {
      fs.copyFileSync(manifest.oldConfigPath, manifest.newConfigPath);
    }
    verifyCopiedDatabase(manifest.newDataDir);
    log('data and config copied and verified');
  } catch (error) {
    await rollback(manifest, `复制数据失败：${error.message}`);
    fs.rmSync(manifestPath, { force: true });
    return;
  }

  const newChild = startServer(manifest.newRoot, manifest.nodeExe, cleanEnv());
  const healthy = await waitForHealth(manifest.port, manifest.newVersion, 90000);

  if (!healthy) {
    killProcess(newChild.pid);
    await sleep(1000);
    await rollback(manifest, '新系统启动或健康检查失败');
    fs.rmSync(manifestPath, { force: true });
    return;
  }

  const serviceUpdated = updateWindowsTask(manifest);
  const result = {
    status: 'success',
    oldRoot: manifest.oldRoot,
    newRoot: manifest.newRoot,
    oldVersion: manifest.oldVersion,
    newVersion: manifest.newVersion,
    serviceUpdated,
    finishedAt: new Date().toISOString(),
  };
  result.logFile = publishLog(manifest.newDataDir);
  writeResult(manifest.resultPathNew, result);
  log(`upgrade completed, service=${serviceUpdated}`);
  fs.rmSync(manifestPath, { force: true });
}

main().catch((error) => {
  log(`upgrade helper error: ${error.message}`);
});
