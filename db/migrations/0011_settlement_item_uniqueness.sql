-- Run only after checking for duplicate earning_id values in settlement_items.
-- SELECT earning_id, COUNT(*) FROM settlement_items GROUP BY earning_id HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS settlement_items_earning_id_unique
ON settlement_items (earning_id);
