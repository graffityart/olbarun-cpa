CREATE TABLE IF NOT EXISTS advertiser_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL REFERENCES advertisers(id),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id),
  role varchar(30) NOT NULL DEFAULT 'OWNER',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advertiser_users_advertiser_id_idx
ON advertiser_users(advertiser_id);
