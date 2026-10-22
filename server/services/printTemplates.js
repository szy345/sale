import { db, transaction } from '../db.js';
import { writeAudit } from '../lib/audit.js';
import { nowIso } from '../lib/date.js';
import { AppError } from '../lib/errors.js';

const BOOLEAN_FIELDS = [
  'show_qr',
  'show_problem',
  'show_remark',
  'show_events',
  'show_signature',
  'show_shop_address',
  'is_default',
];

const UPDATE_FIELDS = [
  'name',
  'layout',
  'paper_width_mm',
  'paper_height_mm',
  'margin_mm',
  'ticket_font_size',
  'base_font_size',
  'qr_size_mm',
  'copies',
  ...BOOLEAN_FIELDS,
];

function getRow(id) {
  return db.prepare('SELECT * FROM print_templates WHERE id = ?').get(id);
}

function toApi(row) {
  if (!row) return null;
  const result = { ...row };
  for (const field of BOOLEAN_FIELDS) result[field] = Boolean(result[field]);
  return result;
}

function ensureDefault() {
  const count = Number(
    db.prepare('SELECT COUNT(*) AS count FROM print_templates WHERE is_default = 1').get().count,
  );
  if (count > 0) return;

  const first = db
    .prepare('SELECT id FROM print_templates ORDER BY id ASC LIMIT 1')
    .get();
  if (first) {
    db.prepare('UPDATE print_templates SET is_default = 1 WHERE id = ?').run(first.id);
  }
}

export function listPrintTemplates() {
  return db
    .prepare('SELECT * FROM print_templates ORDER BY is_default DESC, id ASC')
    .all()
    .map(toApi);
}

export function createPrintTemplate(data, user, ip) {
  return transaction(() => {
    const now = nowIso();
    if (data.is_default) {
      db.prepare('UPDATE print_templates SET is_default = 0').run();
    }

    const result = db
      .prepare(
        `INSERT INTO print_templates
           (name, layout, paper_width_mm, paper_height_mm, margin_mm,
            ticket_font_size, base_font_size, qr_size_mm, copies,
            show_qr, show_problem, show_remark, show_events, show_signature,
            show_shop_address, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        data.name,
        data.layout,
        data.paper_width_mm,
        data.paper_height_mm,
        data.margin_mm,
        data.ticket_font_size,
        data.base_font_size,
        data.qr_size_mm,
        data.copies,
        data.show_qr ? 1 : 0,
        data.show_problem ? 1 : 0,
        data.show_remark ? 1 : 0,
        data.show_events ? 1 : 0,
        data.show_signature ? 1 : 0,
        data.show_shop_address ? 1 : 0,
        data.is_default ? 1 : 0,
        now,
        now,
      );

    const id = Number(result.lastInsertRowid);
    ensureDefault();
    const row = toApi(getRow(id));

    writeAudit({
      userId: user.id,
      username: user.username,
      action: 'print_template_create',
      entityType: 'print_template',
      entityId: id,
      detail: {
        name: row.name,
        layout: row.layout,
        paper: `${row.paper_width_mm}×${row.paper_height_mm || 'auto'}mm`,
      },
      ip,
    });
    return toApi(getRow(id));
  });
}

export function updatePrintTemplate(id, data, user, ip) {
  return transaction(() => {
    const existing = getRow(id);
    if (!existing) throw new AppError(404, '打印模板不存在');

    const changes = {};
    const assignments = [];
    const params = [];

    for (const field of UPDATE_FIELDS) {
      if (!Object.hasOwn(data, field) || data[field] === undefined) continue;
      const next = BOOLEAN_FIELDS.includes(field) ? (data[field] ? 1 : 0) : data[field];
      if (next !== existing[field]) {
        changes[field] = { from: existing[field], to: next };
        assignments.push(`${field} = ?`);
        params.push(next);
      }
    }

    if (data.is_default) {
      db.prepare('UPDATE print_templates SET is_default = 0 WHERE id <> ?').run(id);
      if (!changes.is_default) {
        changes.is_default = { from: existing.is_default, to: 1 };
        assignments.push('is_default = ?');
        params.push(1);
      }
    }

    if (assignments.length) {
      const now = nowIso();
      assignments.push('updated_at = ?');
      params.push(now, id);
      db.prepare(`UPDATE print_templates SET ${assignments.join(', ')} WHERE id = ?`).run(...params);
    }

    ensureDefault();
    const row = toApi(getRow(id));

    writeAudit({
      userId: user.id,
      username: user.username,
      action: 'print_template_update',
      entityType: 'print_template',
      entityId: id,
      detail: { name: row.name, changes },
      ip,
    });
    return toApi(getRow(id));
  });
}

export function deletePrintTemplate(id, user, ip) {
  return transaction(() => {
    const existing = getRow(id);
    if (!existing) throw new AppError(404, '打印模板不存在');

    writeAudit({
      userId: user.id,
      username: user.username,
      action: 'print_template_delete',
      entityType: 'print_template',
      entityId: id,
      detail: {
        name: existing.name,
        layout: existing.layout,
        paper: `${existing.paper_width_mm}×${existing.paper_height_mm || 'auto'}mm`,
      },
      ip,
    });

    db.prepare('DELETE FROM print_templates WHERE id = ?').run(id);
    ensureDefault();
    return { ok: true };
  });
}
