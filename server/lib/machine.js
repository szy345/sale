import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

let cachedMachineCode = null;

function readWindowsGuid() {
  try {
    const output = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        '(Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Cryptography" -Name MachineGuid -ErrorAction SilentlyContinue).MachineGuid',
      ],
      { encoding: 'utf8', timeout: 5000, windowsHide: true },
    ).trim();
    if (output) return output;
  } catch {
    // Fall through to reg.exe and generic identifiers.
  }

  try {
    const output = execFileSync(
      'reg',
      ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
      { encoding: 'utf8', timeout: 5000, windowsHide: true },
    );
    const match = output.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/i);
    if (match) return match[1].trim();
  } catch {
    // Fall through.
  }

  return '';
}

function readMacUuid() {
  try {
    const output = execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], {
      encoding: 'utf8',
      timeout: 5000,
    });
    const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
    if (match) return match[1];
  } catch {
    // Fall through.
  }
  return '';
}

function fallbackId() {
  const interfaces = Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && !entry.internal && entry.mac && entry.mac !== '00:00:00:00:00:00');
  return `${os.hostname()}|${interfaces[0]?.mac || 'no-mac'}|${os.platform()}|${os.arch()}`;
}

export function getMachineCode() {
  if (cachedMachineCode) return cachedMachineCode;

  if (process.env.YK_MACHINE_CODE) {
    cachedMachineCode = String(process.env.YK_MACHINE_CODE).trim();
    return cachedMachineCode;
  }

  let raw = '';
  if (process.platform === 'win32') raw = readWindowsGuid();
  else if (process.platform === 'darwin') raw = readMacUuid();
  if (!raw) raw = fallbackId();

  const digest = crypto
    .createHash('sha256')
    .update(`yearcon-sale-license-v1|${raw}`)
    .digest('hex')
    .toUpperCase();

  cachedMachineCode = digest.slice(0, 16).match(/.{4}/g).join('-');
  return cachedMachineCode;
}
