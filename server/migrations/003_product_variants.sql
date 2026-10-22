CREATE TABLE product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(product_id, color, size)
);

CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_product_variants_color ON product_variants(color);
CREATE INDEX idx_product_variants_size ON product_variants(size);

INSERT INTO product_variants (product_id, color, size, created_at, updated_at)
SELECT id, COALESCE(color, ''), COALESCE(size, ''), created_at, updated_at
FROM products;

UPDATE products SET color = NULL, size = NULL;
