CREATE TABLE IF NOT EXISTS login_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 key_hash varchar(64) NOT NULL UNIQUE,
 failed_count integer NOT NULL DEFAULT 0,
 window_started_at timestamptz NOT NULL DEFAULT now(),
 blocked_until timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_blocked_until_idx ON login_attempts(blocked_until);
