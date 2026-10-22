INSERT OR IGNORE INTO id_sequences (prefix, day, last_no)
VALUES ('WX', 'GLOBAL', 0);

UPDATE id_sequences
SET last_no = COALESCE((
  SELECT MAX(CAST(substr(ticket_no, 13) AS INTEGER))
  FROM repair_orders
  WHERE ticket_no LIKE 'WX-%'
), 0)
WHERE prefix = 'WX'
  AND day = 'GLOBAL'
  AND last_no < COALESCE((
    SELECT MAX(CAST(substr(ticket_no, 13) AS INTEGER))
    FROM repair_orders
    WHERE ticket_no LIKE 'WX-%'
  ), 0);
