import { db, transaction } from '../db.js';
import { localDate } from './date.js';

export function generateNumber(prefix, day = localDate(), options = {}) {
  const continuous = options.continuous === true;
  const pad = Number(options.pad) || 3;
  const sequenceDay = continuous ? 'GLOBAL' : day;
  const row = db
    .prepare(
      `INSERT INTO id_sequences (prefix, day, last_no)
       VALUES (?, ?, 1)
       ON CONFLICT(prefix, day) DO UPDATE SET last_no = last_no + 1
       RETURNING last_no`,
    )
    .get(prefix, sequenceDay);

  const sequence = Number(row.last_no);
  return `${prefix}-${day.replaceAll('-', '')}-${String(sequence).padStart(pad, '0')}`;
}

export function createWithNumber(prefix, handler, options = {}) {
  return transaction(() => {
    const number = generateNumber(prefix, localDate(), options);
    return handler(number);
  });
}
