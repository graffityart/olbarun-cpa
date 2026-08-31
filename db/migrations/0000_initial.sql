CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE user_role AS ENUM ('PARTNER','ADVERTISER','ADMIN','SUPER_ADMIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE user_status AS ENUM ('PENDING','ACTIVE','SUSPENDED','WITHDRAWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE campaign_type AS ENUM ('CPA','POSTING'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE campaign_status AS ENUM ('DRAFT','REVIEW','ACTIVE','PAUSED','COMPLETED','ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE conversion_status AS ENUM ('RECEIVED','DELIVERED','REVIEWING','APPROVED','REJECTION_REQUESTED','REJECTED','DISPUTED','CANCELLED','TEST'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL,
  password_hash text NOT NULL,
  role user_role NOT NULL,
  status user_status NOT NULL DEFAULT 'PENDING',
  email_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email);

CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  partner_code varchar(40) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  phone varchar(40),
  member_type varchar(30) NOT NULL DEFAULT 'INDIVIDUAL',
  grade varchar(30) NOT NULL DEFAULT 'NEW',
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS advertisers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_code varchar(40) NOT NULL UNIQUE,
  company_name varchar(160) NOT NULL,
  business_number varchar(30),
  representative_name varchar(100),
  website_url text,
  contract_status varchar(30) NOT NULL DEFAULT 'LEAD',
  payment_type varchar(30) NOT NULL DEFAULT 'PREPAID',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_code varchar(50) NOT NULL UNIQUE,
  advertiser_id uuid NOT NULL REFERENCES advertisers(id),
  type campaign_type NOT NULL,
  name varchar(200) NOT NULL,
  slug varchar(220) NOT NULL UNIQUE,
  category varchar(80),
  description text,
  status campaign_status NOT NULL DEFAULT 'DRAFT',
  start_at timestamptz,
  end_at timestamptz,
  daily_conversion_limit integer,
  monthly_conversion_limit integer,
  daily_budget_limit integer,
  monthly_budget_limit integer,
  duplicate_days integer NOT NULL DEFAULT 30,
  review_days integer NOT NULL DEFAULT 7,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id),
  advertiser_rate integer NOT NULL,
  partner_base_rate integer NOT NULL,
  minimum_margin integer NOT NULL DEFAULT 0,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tracking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_code varchar(80) NOT NULL UNIQUE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id),
  partner_id uuid NOT NULL REFERENCES partners(id),
  sub_id varchar(120),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  click_code varchar(80) NOT NULL UNIQUE,
  tracking_link_id uuid NOT NULL REFERENCES tracking_links(id),
  campaign_id uuid NOT NULL REFERENCES campaigns(id),
  partner_id uuid NOT NULL REFERENCES partners(id),
  sub_id varchar(120),
  referrer text,
  landing_url text,
  ip_hash varchar(128),
  user_agent text,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversion_code varchar(80) NOT NULL UNIQUE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id),
  partner_id uuid REFERENCES partners(id),
  tracking_link_id uuid REFERENCES tracking_links(id),
  click_id uuid REFERENCES clicks(id),
  status conversion_status NOT NULL DEFAULT 'RECEIVED',
  advertiser_rate_snapshot integer NOT NULL,
  partner_rate_snapshot integer NOT NULL,
  platform_margin_snapshot integer NOT NULL,
  duplicate_status varchar(30) NOT NULL DEFAULT 'NORMAL',
  fraud_status varchar(30) NOT NULL DEFAULT 'NORMAL',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversion_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversion_id uuid NOT NULL UNIQUE REFERENCES conversions(id),
  customer_name varchar(100),
  customer_phone_encrypted text,
  customer_phone_hash varchar(128),
  region varchar(160),
  form_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  privacy_policy_version varchar(80),
  third_party_policy_version varchar(80),
  privacy_agreed_at timestamptz,
  third_party_agreed_at timestamptz,
  retention_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS advertiser_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL REFERENCES advertisers(id),
  conversion_id uuid REFERENCES conversions(id),
  type varchar(32) NOT NULL,
  amount integer NOT NULL,
  balance_after integer,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id),
  conversion_id uuid REFERENCES conversions(id),
  type varchar(32) NOT NULL,
  amount integer NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'AVAILABLE',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_code varchar(40) NOT NULL UNIQUE,
  partner_id uuid NOT NULL REFERENCES partners(id),
  requested_amount integer NOT NULL,
  deduction_amount integer NOT NULL DEFAULT 0,
  payment_amount integer NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'REQUESTED',
  bank_account_snapshot jsonb,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settlement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES settlements(id),
  earning_id uuid NOT NULL REFERENCES earnings(id),
  conversion_id uuid REFERENCES conversions(id),
  amount integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posting_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL UNIQUE REFERENCES campaigns(id),
  media_type varchar(32) NOT NULL,
  participant_limit integer,
  total_submission_limit integer,
  per_partner_limit integer NOT NULL DEFAULT 1,
  minimum_characters integer,
  minimum_images integer,
  maintenance_days integer,
  review_days integer NOT NULL DEFAULT 3,
  revision_limit integer NOT NULL DEFAULT 2,
  rules jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posting_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_campaign_id uuid NOT NULL REFERENCES posting_campaigns(id),
  partner_id uuid NOT NULL REFERENCES partners(id),
  status varchar(24) NOT NULL DEFAULT 'APPLIED',
  applied_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);

CREATE TABLE IF NOT EXISTS posting_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES posting_applications(id),
  title varchar(300),
  post_url text NOT NULL,
  published_at timestamptz,
  note text,
  status varchar(24) NOT NULL DEFAULT 'SUBMITTED',
  revision_count integer NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE TABLE IF NOT EXISTS posting_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES posting_submissions(id),
  decision varchar(24) NOT NULL,
  reason text,
  checklist jsonb,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  token_hash varchar(128) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  user_agent text,
  ip_hash varchar(128),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaigns_advertiser_id_idx ON campaigns(advertiser_id);
CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns(status);
CREATE INDEX IF NOT EXISTS clicks_campaign_id_idx ON clicks(campaign_id);
CREATE INDEX IF NOT EXISTS clicks_partner_id_idx ON clicks(partner_id);
CREATE INDEX IF NOT EXISTS conversions_campaign_id_idx ON conversions(campaign_id);
CREATE INDEX IF NOT EXISTS conversions_partner_id_idx ON conversions(partner_id);
CREATE INDEX IF NOT EXISTS conversions_status_idx ON conversions(status);
CREATE INDEX IF NOT EXISTS conversion_data_phone_hash_idx ON conversion_data(customer_phone_hash);
CREATE INDEX IF NOT EXISTS earnings_partner_id_idx ON earnings(partner_id);
CREATE INDEX IF NOT EXISTS advertiser_ledger_advertiser_id_idx ON advertiser_ledger(advertiser_id);
CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions(expires_at);
