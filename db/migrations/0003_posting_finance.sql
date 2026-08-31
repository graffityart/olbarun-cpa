ALTER TABLE advertiser_ledger ADD COLUMN IF NOT EXISTS posting_submission_id uuid REFERENCES posting_submissions(id);
ALTER TABLE earnings ADD COLUMN IF NOT EXISTS posting_submission_id uuid REFERENCES posting_submissions(id);
CREATE UNIQUE INDEX IF NOT EXISTS advertiser_ledger_posting_submission_unique ON advertiser_ledger(posting_submission_id) WHERE posting_submission_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS earnings_posting_submission_unique ON earnings(posting_submission_id) WHERE posting_submission_id IS NOT NULL;
