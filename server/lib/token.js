import crypto from 'node:crypto';

export function generatePublicToken() {
  return crypto.randomBytes(16).toString('hex');
}
