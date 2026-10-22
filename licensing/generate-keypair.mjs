import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privateFile = path.join(root, 'licensing', 'private-key.pem');
const publicFile = path.join(root, 'server', 'license-public.pem');

if (fs.existsSync(privateFile) && !process.argv.includes('--force')) {
  console.error('私钥已存在，不能重复生成。确需重新生成请加 --force。');
  process.exit(1);
}

const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
fs.mkdirSync(path.dirname(privateFile), { recursive: true });
fs.mkdirSync(path.dirname(publicFile), { recursive: true });
fs.writeFileSync(privateFile, privateKey.export({ type: 'pkcs8', format: 'pem' }), 'utf8');
fs.writeFileSync(publicFile, publicKey.export({ type: 'spki', format: 'pem' }), 'utf8');

console.log(`私钥：${privateFile}`);
console.log(`公钥：${publicFile}`);
console.log('请立即单独备份私钥，丢失后无法再签发授权。');
