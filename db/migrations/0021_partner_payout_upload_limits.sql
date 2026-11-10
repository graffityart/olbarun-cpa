-- Apply before enabling PAYOUT_UPLOAD_RATE_LIMIT=enabled.
-- Counts authenticated upload attempts per partner; never stores identity documents or IP addresses.
create table if not exists partner_payout_upload_limits (
 partner_id uuid primary key references partners(id) on delete cascade,
 window_started_at timestamptz not null default now(),
 attempt_count integer not null default 0,
 updated_at timestamptz not null default now(),
 constraint payout_upload_attempt_count_check check (attempt_count >= 0)
);
comment on table partner_payout_upload_limits is 'Per-partner payout document upload attempt throttle. No personal document data.';
