import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { config, rootDir } from '../config.js';
import { writeAudit } from '../lib/audit.js';
import { localDate, localTime, nowIso, } from '../lib/date.js';
import { AppError } from '../lib/errors.js';

const UPGRADE_HELPER = path.join(rootDir, 'scripts', 'common', 'upgrade-helper.mjs');
const RESTORE_MANIFEST = path.join(config.dataDir, 'restore-request.json');
const RESULT_FILE = path.join(config.dataDir, 'upgrade-result.json');
let upgradeInProgress = false;

function versionParts(value) {
  return String(value || '0')
    .replace(/^v/i, '')
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersions(a, b) {
  const left = versionParts(a);
  const right = versionParts(b);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function normalizedForCompare(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isInside(parent, child) {
  const relative = path.relative(normalizedForCompare(parent), normalizedForCompare(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function readNewVersion(newRoot) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(newRoot, 'package.json'), 'utf8'));
    return String(pkg.version || '');
  } catch {
    return '';
  }
}

function resolveNodeRuntime(newRoot) {
  const candidates = [];
  if (process.platform === 'win32') {
    candidates.push(path.join(newRoot, 'node', 'node.exe'));
  } else {
    candidates.push(path.join(newRoot, 'node', 'bin', 'node'));
    candidates.push(path.join(newRoot, 'node', 'node'));
  }

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const result = spawnSync(candidate, ['-v'], { encoding: 'utf8', windowsHide: true });
    const version = String(result.stdout || '').trim();
    const major = Number(version.replace(/^v/, '').split('.')[0]);
    if (result.status !== 0 || major < 24) {
      throw new Error(`新系统自带 Node.js 版本不支持：${version || '未知'}`);
    }
    return { nodeExe: candidate, nodeVersion: version };
  }

  const currentMajor = Number(process.versions.node.split('.')[0]);
  if (currentMajor < 24) {
    throw new Error(`当前 Node.js 版本 ${process.versions.node} 过低，需要 24 或更高版本`);
  }
  return { nodeExe: process.execPath, nodeVersion: `v${process.versions.node}` };
}

export function validateUpgrade(newPath) {
  const errors = [];
  const warnings = [];
  const input = String(newPath || '').trim();
  const currentVersion = config.appVersion;

  if (!input) {
    return {
      valid: false,
      errors: ['请输入新系统所在的绝对路径'],
      warnings,
      currentVersion,
    };
  }

  if (process.platform === 'win32' && /^\\\\/.test(input)) {
    return {
      valid: false,
      errors: ['不支持网络共享路径，请解压到本机磁盘目录'],
      warnings,
      currentVersion,
    };
  }

  if (!path.isAbsolute(input)) {
    return {
      valid: false,
      errors: ['请输入绝对路径，例如 D:\\yearcon-sale-v1.1'],
      warnings,
      currentVersion,
    };
  }

  const newRoot = path.resolve(input);
  if (!fs.existsSync(newRoot) || !fs.statSync(newRoot).isDirectory()) {
    return {
      valid: false,
      errors: ['新系统目录不存在或不是文件夹'],
      warnings,
      currentVersion,
    };
  }

  if (isInside(rootDir, newRoot) || isInside(newRoot, rootDir)) {
    errors.push('新系统目录不能与当前运行目录相同，也不能互相包含');
  }

  const requiredFiles = [
    ['package.json', 'package.json'],
    ['server/index.js', '服务端程序 server/index.js'],
    ['public/index.html', '前端页面 public/index.html'],
    ['node_modules/express/package.json', '生产依赖 node_modules'],
  ];
  for (const [file, label] of requiredFiles) {
    if (!fs.existsSync(path.join(newRoot, file))) {
      errors.push(`新系统缺少 ${label}`);
    }
  }

  const newDataDir = path.join(newRoot, 'data');
  if (fs.existsSync(newDataDir)) {
    try {
      if (!fs.statSync(newDataDir).isDirectory()) {
        errors.push('新系统 data 不是文件夹');
      } else if (fs.readdirSync(newDataDir).length > 0) {
        errors.push('新系统的 data 目录不是空的，请使用全新的解压目录');
      }
    } catch (error) {
      errors.push(`无法检查新系统 data 目录：${error.message}`);
    }
  }

  let nodeExe = process.execPath;
  let nodeVersion = `v${process.versions.node}`;
  try {
    const runtime = resolveNodeRuntime(newRoot);
    nodeExe = runtime.nodeExe;
    nodeVersion = runtime.nodeVersion;
  } catch (error) {
    errors.push(error.message);
  }

  const newVersion = readNewVersion(newRoot);
  if (!newVersion) {
    errors.push('无法读取新系统版本号');
  } else {
    const comparison = compareVersions(newVersion, currentVersion);
    if (comparison < 0) {
      errors.push(`新系统版本 ${newVersion} 低于当前版本 ${currentVersion}，不能降级`);
    } else if (comparison === 0) {
      warnings.push(`新旧版本相同（${newVersion}），将按相同版本重新部署`);
    }
  }

  const oldConfigPath = path.join(rootDir, 'config.json');
  if (!fs.existsSync(oldConfigPath)) {
    warnings.push('当前系统没有 config.json，升级后将使用新系统自带的配置');
  }

  try {
    fs.accessSync(newRoot, fs.constants.R_OK | fs.constants.W_OK);
  } catch {
    errors.push('新系统目录没有读写权限，请更换目录或调整权限');
  }

  if (!fs.existsSync(UPGRADE_HELPER)) {
    errors.push('当前系统缺少升级 helper，请先完成一次手工升级');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    currentRoot: rootDir,
    currentVersion,
    newRoot,
    newVersion,
    nodeExe,
    nodeVersion,
    newDataDir,
    oldConfigPath,
    dataEmpty: !fs.existsSync(newDataDir) || fs.readdirSync(newDataDir).length === 0,
  };
}

function readLastResult() {
  try {
    if (!fs.existsSync(RESULT_FILE)) return null;
    return JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'));
  } catch {
    return null;
  }
}

export function getUpgradeInfo() {
  return {
    currentRoot: rootDir,
    currentVersion: config.appVersion,
    dataDir: config.dataDir,
    platform: process.platform,
    nodeVersion: process.version,
    lastResult: readLastResult(),
  };
}

export function prepareUpgrade(newPath, user, ip) {
  if (upgradeInProgress || fs.existsSync(RESTORE_MANIFEST)) {
    throw new AppError(409, '已有恢复或升级任务正在执行，请稍后再试');
  }

  const validation = validateUpgrade(newPath);
  if (!validation.valid) {
    throw new AppError(400, '新系统检查未通过', {
      code: 'UPGRADE_INVALID',
      details: validation.errors.map((message) => ({ message })),
    });
  }

  if (!fs.existsSync(UPGRADE_HELPER)) {
    throw new AppError(500, '缺少升级 helper，请先完成一次手工升级');
  }

  const stamp = `${localDate().replaceAll('-', '')}-${localTime().replaceAll(':', '')}`;
  const manifestPath = path.join(os.tmpdir(), `yearcon-upgrade-${process.pid}-${stamp}.json`);
  const logPath = path.join(os.tmpdir(), `yearcon-upgrade-${process.pid}-${stamp}.log`);
  const manifest = {
    pid: process.pid,
    oldRoot: rootDir,
    newRoot: validation.newRoot,
    oldDataDir: config.dataDir,
    newDataDir: path.join(validation.newRoot, 'data'),
    oldConfigPath: validation.oldConfigPath,
    newConfigPath: path.join(validation.newRoot, 'config.json'),
    oldVersion: config.appVersion,
    newVersion: validation.newVersion,
    port: Number(config.port),
    nodeExe: validation.nodeExe,
    taskName: 'YearconSaleService',
    serviceScript: path.join(
      validation.newRoot,
      'scripts',
      'windows',
      'update-service-path.ps1',
    ),
    logPath,
    resultPathNew: path.join(validation.newRoot, 'data', 'upgrade-result.json'),
    resultPathOld: path.join(config.dataDir, 'upgrade-result.json'),
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  try {
    const child = spawn(process.execPath, [UPGRADE_HELPER, manifestPath], {
      cwd: rootDir,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: process.env,
    });
    child.unref();
  } catch {
    fs.rmSync(manifestPath, { force: true });
    throw new AppError(500, '无法启动升级进程，请检查服务器日志');
  }

  upgradeInProgress = true;
  writeAudit({
    userId: user.id,
    username: user.username,
    action: 'system_upgrade',
    entityType: 'system',
    entityId: null,
    detail: {
      old_root: rootDir,
      new_root: validation.newRoot,
      old_version: config.appVersion,
      new_version: validation.newVersion,
      started_at: nowIso(),
    },
    ip,
  });

  return {
    restarting: true,
    oldRoot: rootDir,
    newRoot: validation.newRoot,
    oldVersion: config.appVersion,
    newVersion: validation.newVersion,
    warnings: validation.warnings,
    message: '升级已开始，系统即将停止并启动新版本',
  };
}
