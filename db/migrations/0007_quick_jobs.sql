-- Run explicitly after inspecting the production schema. Never run during a build.
BEGIN;
CREATE TABLE IF NOT EXISTS quick_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title varchar(200) NOT NULL,
 category varchar(40) NOT NULL, description text NOT NULL, instructions text NOT NULL,
 notice text NOT NULL, target_url text NOT NULL, reward integer NOT NULL CHECK(reward > 0),
 capacity integer NOT NULL CHECK(capacity > 0), status varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','OPEN','CLOSED')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS quick_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL REFERENCES quick_jobs(id),
 partner_id uuid NOT NULL REFERENCES partners(id), reward_snapshot integer NOT NULL CHECK(reward_snapshot > 0),
 status varchar(16) NOT NULL DEFAULT 'APPLIED' CHECK(status IN ('APPLIED','SUBMITTED','APPROVED','REJECTED')),
 account varchar(120), worked_at timestamptz, note text, proofs jsonb NOT NULL DEFAULT '[]',
 reason text, reviewer_id uuid REFERENCES users(id), earning_id uuid UNIQUE REFERENCES earnings(id),
 created_at timestamptz NOT NULL DEFAULT now(), submitted_at timestamptz, reviewed_at timestamptz,
 UNIQUE(job_id,partner_id), CHECK(jsonb_typeof(proofs)='array' AND jsonb_array_length(proofs)<=3),
 CHECK((status='APPROVED') = (earning_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS quick_submissions_partner_idx ON quick_submissions(partner_id,created_at DESC);
CREATE INDEX IF NOT EXISTS quick_submissions_review_idx ON quick_submissions(status,submitted_at);
COMMIT;
