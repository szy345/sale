CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
  is_active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  token_version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE id_sequences (
  prefix TEXT NOT NULL,
  day TEXT NOT NULL,
  last_no INTEGER NOT NULL,
  PRIMARY KEY (prefix, day)
);

CREATE TABLE repair_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_no TEXT NOT NULL UNIQUE,
  repair_date TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  product_name TEXT,
  item_no TEXT,
  color TEXT,
  size TEXT,
  problem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_factory'
    CHECK (status IN ('pending_factory', 'sent_factory', 'factory_returned', 'customer_notified', 'customer_picked')),
  current_round INTEGER NOT NULL DEFAULT 1 CHECK (current_round >= 1),
  operator_id INTEGER NOT NULL REFERENCES users(id),
  remark TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE repair_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repair_id INTEGER NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  round_no INTEGER NOT NULL CHECK (round_no >= 1),
  stage TEXT NOT NULL CHECK (stage IN ('sent_factory', 'factory_returned', 'customer_notified', 'customer_picked')),
  operator_id INTEGER NOT NULL REFERENCES users(id),
  event_date TEXT NOT NULL,
  tracking_no TEXT,
  remark TEXT,
  voided_at TEXT,
  voided_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX uq_repair_events_active
  ON repair_events(repair_id, round_no, stage)
  WHERE voided_at IS NULL;

CREATE INDEX idx_repair_events_repair ON repair_events(repair_id, round_no, id);
CREATE INDEX idx_repair_orders_status ON repair_orders(status);
CREATE INDEX idx_repair_orders_date ON repair_orders(repair_date);
CREATE INDEX idx_repair_orders_phone ON repair_orders(phone);
CREATE INDEX idx_repair_orders_ticket ON repair_orders(ticket_no);

CREATE TABLE return_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_no TEXT NOT NULL UNIQUE,
  return_date TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  product_name TEXT NOT NULL,
  item_no TEXT,
  color TEXT,
  size TEXT,
  purchase_date TEXT,
  receipt_no TEXT,
  reason TEXT NOT NULL,
  handling TEXT NOT NULL CHECK (handling IN ('refund', 'exchange', 'repair', 'other')),
  refund_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (refund_amount_cents >= 0),
  operator_id INTEGER NOT NULL REFERENCES users(id),
  remark TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_return_orders_date ON return_orders(return_date);
CREATE INDEX idx_return_orders_phone ON return_orders(phone);
CREATE INDEX idx_return_orders_no ON return_orders(return_no);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  username TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT,
  detail TEXT,
  ip TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
