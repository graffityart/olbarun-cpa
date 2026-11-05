-- Separate internally operated quick jobs from advertiser-submitted jobs.
-- Apply manually after review; do not run during builds.
BEGIN;
ALTER TABLE quick_jobs ADD COLUMN IF NOT EXISTS registration_source varchar(16) NOT NULL DEFAULT 'ADMIN';
ALTER TABLE quick_jobs ADD COLUMN IF NOT EXISTS advertiser_id uuid REFERENCES advertisers(id);
ALTER TABLE quick_jobs ADD COLUMN IF NOT EXISTS approval_status varchar(16) NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE quick_jobs ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id);
ALTER TABLE quick_jobs ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE quick_jobs ADD COLUMN IF NOT EXISTS review_note text;
ALTER TABLE quick_jobs ADD CONSTRAINT quick_jobs_registration_source_chk CHECK (registration_source IN ('ADMIN','ADVERTISER'));
ALTER TABLE quick_jobs ADD CONSTRAINT quick_jobs_approval_status_chk CHECK (approval_status IN ('NOT_REQUIRED','PENDING','APPROVED','REJECTED'));
ALTER TABLE quick_jobs ADD CONSTRAINT quick_jobs_owner_approval_chk CHECK (
 (registration_source='ADMIN' AND advertiser_id IS NULL AND approval_status='NOT_REQUIRED')
 OR (registration_source='ADVERTISER' AND advertiser_id IS NOT NULL AND approval_status IN ('PENDING','APPROVED','REJECTED'))
);
ALTER TABLE quick_jobs ADD CONSTRAINT quick_jobs_advertiser_publication_chk CHECK (
 registration_source='ADMIN' OR status<>'OPEN' OR approval_status='APPROVED'
);
CREATE INDEX IF NOT EXISTS quick_jobs_advertiser_idx ON quick_jobs(advertiser_id,created_at DESC);
COMMIT;
