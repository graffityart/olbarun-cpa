-- CPA ledger reconciliation review history. Run only after confirming the target Neon database.
CREATE TABLE IF NOT EXISTS "cpa_ledger_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversion_id" uuid NOT NULL REFERENCES "conversions"("id"),
  "reviewer_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "status" varchar(24) NOT NULL,
  "note" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "cpa_ledger_reviews_status_check" CHECK ("status" IN ('IN_REVIEW', 'RESOLVED', 'REOPENED'))
);
CREATE INDEX IF NOT EXISTS "cpa_ledger_reviews_conversion_created_idx" ON "cpa_ledger_reviews" ("conversion_id", "created_at");
