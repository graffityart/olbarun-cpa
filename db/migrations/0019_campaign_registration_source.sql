-- Distinguish administrator-created campaigns from advertiser requests.
-- Existing campaigns are administrator-created by default.
BEGIN;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS registration_source varchar(16) NOT NULL DEFAULT 'ADMIN';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS advertiser_approval_status varchar(16) NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS advertiser_reviewed_by uuid REFERENCES users(id);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS advertiser_reviewed_at timestamptz;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS advertiser_review_note text;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_registration_source_chk CHECK(registration_source IN ('ADMIN','ADVERTISER'));
ALTER TABLE campaigns ADD CONSTRAINT campaigns_advertiser_approval_chk CHECK(
 (registration_source='ADMIN' AND advertiser_approval_status='NOT_REQUIRED')
 OR (registration_source='ADVERTISER' AND advertiser_approval_status IN ('PENDING','APPROVED','REJECTED'))
);
ALTER TABLE campaigns ADD CONSTRAINT campaigns_advertiser_publish_chk CHECK(
 registration_source='ADMIN' OR status NOT IN ('ACTIVE','PAUSED','COMPLETED') OR advertiser_approval_status='APPROVED'
);
CREATE INDEX IF NOT EXISTS campaigns_registration_review_idx ON campaigns(registration_source,advertiser_approval_status,created_at DESC);
COMMIT;
