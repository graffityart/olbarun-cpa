CREATE TABLE IF NOT EXISTS notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id), type varchar(50) NOT NULL,
 title varchar(200) NOT NULL, message text NOT NULL, href text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 is_read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id,is_read,created_at DESC);
