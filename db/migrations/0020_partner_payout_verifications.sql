-- Partner payout verification. Do not store document images or identity numbers in PostgreSQL.
-- Run this migration before enabling document submission or settlement verification gates.
create table if not exists partner_payout_verifications (
 id uuid primary key default gen_random_uuid(),
 partner_id uuid not null references partners(id) on delete cascade,
 status varchar(20) not null default 'NOT_SUBMITTED',
 bank_document_blob_path text,
 identity_document_blob_path text,
 document_type varchar(20),
 submitted_at timestamptz,
 reviewed_at timestamptz,
 reviewed_by uuid references users(id),
 rejection_reason text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint payout_verification_status_check check (status in ('NOT_SUBMITTED','PENDING','APPROVED','REJECTED')),
 constraint payout_verification_document_type_check check (document_type is null or document_type in ('PERSONAL_ID','BUSINESS_REGISTRATION')),
 constraint payout_verification_rejection_reason_check check (rejection_reason is null or char_length(rejection_reason)<=2000),
 constraint payout_verification_submission_check check (status not in ('PENDING','APPROVED') or (bank_document_blob_path is not null and identity_document_blob_path is not null and submitted_at is not null)),
 constraint payout_verification_unique_partner unique(partner_id)
);
create index if not exists partner_payout_verifications_status_idx on partner_payout_verifications(status,submitted_at);
comment on table partner_payout_verifications is 'Restricted payout KYC metadata only. Private blob documents are never publicly accessible.';
