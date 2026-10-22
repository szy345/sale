import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { db } from '../db.js';
import { writeAudit } from '../lib/audit.js';
import { localDate } from '../lib/date.js';
import { AppError } from '../lib/errors.js';
import { getMachineCode } from '../lib/machine.js';

const TRIAL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const LICENSE_FILE = path.join(config.dataDir, 'license.lic');
const DATA_STATE_FILE = path.join(config.dataDir, 'trial-state.json');
const PUBLIC_KEY_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'license-public.pem',
);
const STATE_DIR = process.env.YK_LICENSE_STATE_DIR
  ? path.resolve(process.env.YK_LICENSE_STATE_DIR)
  : process.platform === 'win32'
    ? path.join(process.env.ProgramData || 'C:\\ProgramData', 'YearconSale')
    : path.join(os.homedir(), 'Library', 'Application Support', 'YearconSale');
const STATE_FILE = path.join(STATE_DIR, 'license-state.json');
let lastStateWriteAt = 0;

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function publicKey() {
  if (!fs.existsSync(PUBLIC_KEY_FILE)) return null;
  return fs.readFileSync(PUBLIC_KEY_FILE, 'utf8');
}

function usersCount() {
  return Number(db.prepare('SELECT COUNT(*) AS count FROM users').get().count || 0);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeFile(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, 'utf8');
}

function writeTrialState(state) {
  const text = JSON.stringify(state, null, 2);
  let wrote = false;
  try {
    writeFile(STATE_FILE, text);
    wrote = true;
  } catch {
    // Fall back to the data folder.
  }
  try {
    writeFile(DATA_STATE_FILE, text);
    wrote = true;
  } catch {
    // At least one copy is enough to continue using the system.
  }
  if (wrote) lastStateWriteAt = Date.now();
}

function loadTrialState() {
  let state = readJson(STATE_FILE);
  if (!state) {
    const fallback = readJson(DATA_STATE_FILE);
    if (fallback) {
      state = fallback;
      try {
        writeFile(STATE_FILE, JSON.stringify(fallback, null, 2));
      } catch {
        // Continue with the data-folder copy.
      }
    }
  }
  return state;
}

function parseDate(value) {
  if (!value || typeof value !== 'string') return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function verifyLicense(license) {
  if (!license || typeof license !== 'object') {
    throw new AppError(400, '授权文件格式不正确');
  }
  const { payload, signature } = license;
  if (!payload || typeof payload !== 'object' || typeof signature !== 'string') {
    throw new AppError(400, '授权文件缺少签名');
  }
  const key = publicKey();
  if (!key) throw new AppError(500, '系统未安装授权公钥');

  const ok = crypto.verify(
    null,
    Buffer.from(canonicalJson(payload)),
    crypto.createPublicKey(key),
    Buffer.from(signature, 'base64'),
  );
  if (!ok) throw new AppError(400, '授权文件签名无效');

  if (payload.format !== 'yearcon-license-v1') {
    throw new AppError(400, '授权文件格式版本不正确');
  }
  if (payload.machine_code !== getMachineCode()) {
    throw new AppError(400, '授权文件与当前电脑机器码不匹配');
  }
  if (!['paid', 'trial'].includes(payload.type)) {
    throw new AppError(400, '授权类型不正确');
  }

  if (payload.expires_at) {
    const expires = parseDate(payload.expires_at);
    if (!expires) throw new AppError(400, '授权到期日期格式不正确');
  }

  return payload;
}

function readLicenseFile() {
  if (!fs.existsSync(LICENSE_FILE)) return null;
  const content = fs.readFileSync(LICENSE_FILE, 'utf8');
  try {
    const license = JSON.parse(content);
    return verifyLicense(license);
  } catch (error) {
    return { error: error.message };
  }
}

function trialStatus() {
  const state = loadTrialState();
  if (!state) {
    if (usersCount() > 0) {
      return {
        allowed: false,
        status: 'unlicensed',
        message: '当前系统尚未导入正式授权，请导入授权文件',
        machine_code: getMachineCode(),
      };
    }
    return {
      allowed: true,
      status: 'pending',
      message: '首次创建管理员后将自动开始 30 天试用',
      machine_code: getMachineCode(),
    };
  }

  if (state.machine_code !== getMachineCode()) {
    return {
      allowed: false,
      status: 'machine_mismatch',
      message: '试用状态与当前电脑不匹配，请导入正式授权',
      machine_code: getMachineCode(),
    };
  }

  const started = new Date(state.trial_started_at);
  if (Number.isNaN(started.getTime())) {
    return {
      allowed: false,
      status: 'tampered',
      message: '试用状态异常，请导入正式授权',
      machine_code: getMachineCode(),
    };
  }

  const now = Date.now();
  const lastSeen = new Date(state.last_seen_at || state.trial_started_at).getTime();
  if (Number.isFinite(lastSeen) && now < lastSeen - 10 * 60 * 1000) {
    return {
      allowed: false,
      status: 'tampered',
      message: '检测到系统时间异常，请导入正式授权',
      machine_code: getMachineCode(),
    };
  }

  if (now - lastStateWriteAt > 60 * 60 * 1000) {
    writeTrialState({
      ...state,
      last_seen_at: new Date(now).toISOString(),
    });
  }

  const trialDays = Number(state.trial_days) || TRIAL_DAYS;
  const expiresAt = new Date(started.getTime() + trialDays * DAY_MS);
  const remaining = Math.max(0, Math.ceil((expiresAt.getTime() - now) / DAY_MS));
  if (now >= expiresAt.getTime()) {
    return {
      allowed: false,
      status: 'expired',
      source: 'trial',
      type: 'trial',
      message: '30 天试用期已到期，请导入正式授权',
      trial_started_at: state.trial_started_at,
      expires_at: expiresAt.toISOString(),
      days_remaining: 0,
      machine_code: getMachineCode(),
    };
  }

  return {
    allowed: true,
    status: 'trial',
    type: 'trial',
    message: '系统试用中',
    trial_started_at: state.trial_started_at,
    expires_at: expiresAt.toISOString(),
    days_remaining: remaining,
    trial_days: trialDays,
    machine_code: getMachineCode(),
  };
}

export function getLicenseStatus() {
  const license = readLicenseFile();
  if (license && !license.error) {
    const expiresAt = license.expires_at || null;
    if (expiresAt && localDate() > expiresAt) {
      return {
        allowed: false,
        status: 'expired',
        source: 'license',
        type: license.type,
        merchant: license.merchant,
        license_id: license.license_id,
        expires_at: expiresAt,
        days_remaining: 0,
        message: '授权已到期，请导入新的授权文件',
        machine_code: getMachineCode(),
      };
    }

    const remaining = expiresAt
      ? Math.max(
          0,
          Math.ceil(
            (parseDate(expiresAt).getTime() + DAY_MS - Date.now()) / DAY_MS,
          ),
        )
      : null;

    return {
      allowed: true,
      status: 'licensed',
      source: 'license',
      type: license.type,
      merchant: license.merchant || '',
      license_id: license.license_id || '',
      expires_at: expiresAt,
      days_remaining: remaining,
      message: '系统已授权',
      machine_code: getMachineCode(),
    };
  }

  if (license?.error) {
    return {
      allowed: false,
      status: 'invalid_license',
      message: `授权文件无效：${license.error}`,
      machine_code: getMachineCode(),
    };
  }

  return trialStatus();
}

export function startTrial(user, ip) {
  const existing = getLicenseStatus();
  if (existing.status === 'licensed') return existing;
  if (existing.status === 'trial' || existing.status === 'expired' || existing.status === 'tampered') {
    return existing;
  }

  const now = new Date();
  const state = {
    version: 1,
    machine_code: getMachineCode(),
    trial_started_at: now.toISOString(),
    last_seen_at: now.toISOString(),
    trial_days: TRIAL_DAYS,
  };
  writeTrialState(state);

  writeAudit({
    userId: user.id,
    username: user.username,
    action: 'license_trial_start',
    entityType: 'license',
    entityId: null,
    detail: { machine_code: state.machine_code, trial_days: TRIAL_DAYS },
    ip,
  });
  return getLicenseStatus();
}

export function importLicense(contentBase64, user, ip) {
  if (!contentBase64) throw new AppError(400, '请选择授权文件');
  if (String(contentBase64).length > 200000) throw new AppError(400, '授权文件过大');

  let text;
  try {
    text = Buffer.from(String(contentBase64), 'base64').toString('utf8');
  } catch {
    throw new AppError(400, '授权文件编码不正确');
  }
  let license;
  try {
    license = JSON.parse(text);
  } catch {
    throw new AppError(400, '授权文件不是有效的 JSON');
  }

  const payload = verifyLicense(license);
  if (payload.expires_at && localDate() > payload.expires_at) {
    throw new AppError(400, '授权文件已过期');
  }
  writeFile(LICENSE_FILE, JSON.stringify(license, null, 2));

  writeAudit({
    userId: user.id,
    username: user.username,
    action: 'license_import',
    entityType: 'license',
    entityId: payload.license_id || null,
    detail: {
      merchant: payload.merchant,
      type: payload.type,
      expires_at: payload.expires_at || null,
      machine_code: payload.machine_code,
    },
    ip,
  });

  return getLicenseStatus();
}
