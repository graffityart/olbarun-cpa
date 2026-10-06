-- Add missing customer support storage without changing existing data.
CREATE TABLE IF NOT EXISTS customer_qna (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname varchar(40) NOT NULL,
  password_hash text NOT NULL,
  title varchar(160) NOT NULL,
  content text NOT NULL,
  is_secret boolean NOT NULL DEFAULT true,
  status varchar(20) NOT NULL DEFAULT 'WAITING',
  answer text,
  answered_at timestamptz,
  ip_hash varchar(64) NOT NULL,
  user_agent varchar(500),
  spam_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_qna_created_at_idx ON customer_qna(created_at);
CREATE INDEX IF NOT EXISTS customer_qna_ip_hash_idx ON customer_qna(ip_hash);
CREATE TABLE IF NOT EXISTS customer_captcha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_hash varchar(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
