-- Read-only retention inventory for payout verification documents.
-- Run only after migration 0020. This script NEVER deletes documents or changes status.
-- Set a legally reviewed retention period before writing any cleanup job.
-- Excludes personal identity numbers and raw account numbers.
select
 status,
 count(*) as verification_records,
 count(*) filter (where bank_document_blob_path is not null) as bank_documents,
 count(*) filter (where identity_document_blob_path is not null) as identity_documents,
 min(submitted_at) as earliest_submission,
 max(submitted_at) as latest_submission,
 count(*) filter (where submitted_at < now() - interval '30 days') as submitted_over_30_days,
 count(*) filter (where submitted_at < now() - interval '90 days') as submitted_over_90_days,
 count(*) filter (where submitted_at < now() - interval '365 days') as submitted_over_365_days
from partner_payout_verifications
group by status
order by status;

-- The age buckets above are planning metrics, NOT automatic deletion deadlines.
-- Do not remove private blobs without verifying settlement holds, legal retention,
-- and references to those paths; delete blob first and clear DB path only on success.
