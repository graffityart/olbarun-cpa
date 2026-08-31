CREATE UNIQUE INDEX IF NOT EXISTS advertiser_ledger_conversion_unique
ON advertiser_ledger(conversion_id)
WHERE conversion_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS earnings_conversion_unique
ON earnings(conversion_id)
WHERE conversion_id IS NOT NULL;
