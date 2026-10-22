import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privateFile = path.join(root, 'licensing', 'private-key.pem');

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

function parseArgs(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = args[index + 1];
    if (next && !next.startsWith('--')) {
      result[key] = next;
      index += 1;
    } else {
      result[key] = true;
    }
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));
const machine = String(args.machine || '').trim();
const merchant = String(args.merchant || '').trim();
const type = String(args.type || 'paid').trim();
const expires = args.expires ? String(args.expires).trim() : null;
const out = args.out ? path.resolve(String(args.out)) : '';

if (!machine || !merchant || !out) {
  console.error(
    '用法：node licensing/issue-license.mjs --machine 机器码 --merchant 商户名 --type paid --expires 2027-10-21 --out 输出.lic',
  );
  console.error('永久授权可省略 --expires。');
  process.exit(1);
}

if (!fs.existsSync(privateFile)) {
  console.error(`找不到私钥：${privateFile}`);
  process.exit(1);
}

if (!['paid', 'trial'].includes(type)) {
  console.error('授权类型只能是 paid 或 trial。');
  process.exit(1);
}

const now = new Date();
const issuedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const payload = {
  format: 'yearcon-license-v1',
  license_id: `LIC-${Date.now()}`,
  merchant,
  machine_code: machine,
  type,
  issued_at: issuedAt,
  expires_at: expires,
  features: ['repair', 'return', 'product', 'print', 'upgrade'],
};

const privateKey = crypto.createPrivateKey(fs.readFileSync(privateFile, 'utf8'));
const signature = crypto
  .sign(null, Buffer.from(canonicalJson(payload)), privateKey)
  .toString('base64');

const license = { payload, signature };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(license, null, 2), 'utf8');

console.log(`授权文件已生成：${out}`);
console.log(`商户：${merchant}`);
console.log(`机器码：${machine}`);
console.log(`类型：${type}`);
console.log(`到期：${expires || '永久'}`);
