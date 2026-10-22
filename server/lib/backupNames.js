import path from 'node:path';

export const BACKUP_FILE_PATTERN = /^(auto|manual)-\d{8}-\d{6}(?:-\d+)?\.db$/;

export function backupType(name) {
  if (name.startsWith('auto-')) return 'auto';
  if (name.startsWith('manual-')) return 'manual';
  return 'upgrade';
}

export function isSafeBackupName(name) {
  return (
    typeof name === 'string' &&
    name === path.basename(name) &&
    name.endsWith('.db') &&
    !name.includes('..') &&
    !name.includes('/') &&
    !name.includes('\\')
  );
}
