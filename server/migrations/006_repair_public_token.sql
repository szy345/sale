ALTER TABLE repair_orders ADD COLUMN public_token TEXT;

UPDATE repair_orders
SET public_token = lower(hex(randomblob(16)))
WHERE public_token IS NULL;

CREATE UNIQUE INDEX idx_repair_orders_public_token ON repair_orders(public_token);
