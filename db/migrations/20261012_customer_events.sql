-- Migration pending production approval.
CREATE TABLE IF NOT EXISTS customer_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title varchar(160) NOT NULL,
 content text NOT NULL,
 status varchar(12) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','OPEN','ENDED')),
 author_user_id uuid NOT NULL REFERENCES users(id),
 starts_at timestamptz,
 ends_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT customer_events_valid_dates CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX IF NOT EXISTS customer_events_public_idx ON customer_events(status,created_at DESC);
