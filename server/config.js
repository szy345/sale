import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaults = {
  port: 3000,
  host: '0.0.0.0',
  shopName: 'xxx',
  shopPhone: '',
  shopAddress: '',
  publicBaseUrl: '',
  tokenDays: 7,
};

function loadFileConfig() {
  const file = path.join(rootDir, 'config.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`[config] 读取 config.json 失败: ${error.message}`);
    }
    return {};
  }
}

const packageInfo = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const config = { ...defaults, ...loadFileConfig() };
config.appVersion = packageInfo.version || '1.0.0';

config.port = Number(process.env.YK_PORT || config.port);
config.host = process.env.YK_HOST || config.host;
config.tokenDays = Number(process.env.YK_TOKEN_DAYS || config.tokenDays || 7);
config.dataDir = process.env.YK_DATA_DIR
  ? path.resolve(process.env.YK_DATA_DIR)
  : path.join(rootDir, 'data');
config.dbPath = process.env.YK_DB_PATH || path.join(config.dataDir, 'app.db');
config.logDir = path.join(config.dataDir, 'logs');
config.publicDir = path.join(rootDir, 'public');

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(config.logDir, { recursive: true });

function loadJwtSecret() {
  if (process.env.YK_JWT_SECRET) return process.env.YK_JWT_SECRET;

  const secretFile = path.join(config.dataDir, 'secret.key');
  if (fs.existsSync(secretFile)) {
    return fs.readFileSync(secretFile, 'utf8').trim();
  }

  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(secretFile, secret, { mode: 0o600 });
  return secret;
}

config.jwtSecret = loadJwtSecret();

export { config, rootDir };
