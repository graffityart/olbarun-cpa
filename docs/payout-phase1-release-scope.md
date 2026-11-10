# Phase 1 payout release staging

Created 2026-11-10 from `main`. This is a **draft-only release branch**; no production deployment is authorized.

## Scope
- Existing partner settlement request and administrator settlement review flows only.
- Do not copy KYC document upload/review endpoints, KYC migration 0020/0021, or the new admin KYC screen into phase 1.
- Examine diffs in `app/api/partner/settlements/route.ts`, `app/api/admin/settlements/[id]/review/route.ts`, `components/SettlementRequest.tsx`, `components/SettlementReview.tsx`, `app/partner/settlements/page.tsx`.
- KYC-gated paths must not be enabled or imported accidentally. The feature branch currently depends on `lib/payout-account.ts`; cherry-picking whole files is not safe without dependency review.

## Release gates
1. Select and port only changes that work with the current production schema.
2. Run TypeScript, CPA and settlement CI, including PostgreSQL concurrency and rollback tests.
3. Run authenticated HTTP tests against isolated nonproduction resources.
4. Verify current production flags and migration state immediately before deployment.
5. Require explicit production deployment approval. Keep KYC flags disabled until the separate privacy/storage/database release.

## Evidence
- Feature branch `feature/partner-payout-verification`: CI workflow `42767801697` passed.
- Production schema currently lacks `partner_payout_verifications` and `partner_payout_upload_limits`.
- Production/Preview environment-variable records for database and Blob are shared; do not run KYC integration tests on Preview before isolation.
