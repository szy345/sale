CREATE TABLE print_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  layout TEXT NOT NULL DEFAULT 'full' CHECK (layout IN ('full', 'label')),
  paper_width_mm REAL NOT NULL,
  paper_height_mm REAL NOT NULL DEFAULT 0,
  margin_mm REAL NOT NULL DEFAULT 0,
  ticket_font_size INTEGER NOT NULL DEFAULT 24,
  base_font_size INTEGER NOT NULL DEFAULT 11,
  qr_size_mm REAL NOT NULL DEFAULT 18,
  show_qr INTEGER NOT NULL DEFAULT 1,
  show_problem INTEGER NOT NULL DEFAULT 1,
  show_remark INTEGER NOT NULL DEFAULT 0,
  show_events INTEGER NOT NULL DEFAULT 0,
  show_signature INTEGER NOT NULL DEFAULT 0,
  show_shop_address INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_print_templates_default ON print_templates(is_default);

INSERT INTO print_templates
  (name, layout, paper_width_mm, paper_height_mm, margin_mm, ticket_font_size,
   base_font_size, qr_size_mm, show_qr, show_problem, show_remark, show_events,
   show_signature, show_shop_address, is_default, created_at, updated_at)
VALUES
  ('50×30mm 盒贴标签', 'label', 50, 30, 0, 20, 9, 14, 1, 0, 0, 0, 0, 0, 1,
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('40×30mm 盒贴标签', 'label', 40, 30, 0, 16, 8, 12, 1, 0, 0, 0, 0, 0, 0,
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('60×40mm 盒贴标签', 'label', 60, 40, 0, 24, 10, 18, 1, 1, 0, 0, 0, 1, 0,
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('80mm 小票', 'full', 80, 0, 4, 28, 11, 18, 1, 1, 0, 0, 0, 0, 0,
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('58mm 小票', 'full', 58, 0, 2, 20, 9, 14, 1, 1, 0, 0, 0, 0, 0,
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('A4 维修凭证', 'full', 210, 297, 8, 30, 12, 25, 1, 1, 1, 1, 1, 1, 0,
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
