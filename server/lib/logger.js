import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { localDate } from './date.js';

function write(level, message, meta) {
  const timestamp = new Date().toISOString();
  const line = meta
    ? `[${timestamp}] [${level}] ${message} ${JSON.stringify(meta)}`
    : `[${timestamp}] [${level}] ${message}`;

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);

  try {
    const file = path.join(config.logDir, `app-${localDate()}.log`);
    fs.appendFileSync(file, `${line}\n`);
  } catch {
    // Logging must never interrupt a request.
  }
}

export const logger = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
};
