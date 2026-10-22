CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_no TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  color TEXT,
  size TEXT,
  remark TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_products_item_no ON products(item_no);
CREATE INDEX idx_products_name ON products(name);

ALTER TABLE repair_orders
  ADD COLUMN product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX idx_repair_orders_product ON repair_orders(product_id);
