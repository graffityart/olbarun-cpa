CREATE TABLE IF NOT EXISTS customer_notices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title varchar(160) NOT NULL,
 content text NOT NULL,
 author_user_id uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_notices_created_at_idx ON customer_notices(created_at);
