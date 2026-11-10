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

## Verification evidence (2026-11-10)
- Release branch commit `42c0c0fcf71f12a165fb128a65c0a2c5cd72cee9`: Phase 1 payout release safety workflow run [42772664837](https://github.com/graffityart/olbarun-cpa/actions/runs/42772664837) **success**, including disposable PostgreSQL concurrency and rollback tests.
- Same commit: CPA regression and TypeScript run [42772664350](https://github.com/graffityart/olbarun-cpa/actions/runs/42772664350) **success**; CPA checks run [42772664306](https://github.com/graffityart/olbarun-cpa/actions/runs/42772664306) **success**; Vercel Preview **success**.
- Scope: current release branch adds a payout account-privacy instruction, test invariants, CI and documentation. It does **not** yet port the KYC-feature-branch settlement API changes.
- **Unverified:** authenticated partner and administrator HTTP end-to-end behavior against an isolated DB; real settlement notification delivery; live user acceptance; production environment readiness.
- **Decision:** do not merge or deploy to production until those checks and explicit approval are complete. Passing CI is not authorization.

## Authenticated staging acceptance checklist (must be executed before release)

Use dedicated test partner and admin accounts against an **isolated nonproduction database** with synthetic earnings and a disposable notification destination. Do not point this test at production or the shared Preview database.

1. Sign out. Verify partner settlement GET and POST reject unauthenticated requests without revealing account data.
2. Sign in as partner A; verify GET lists only A's last ten settlements, `Cache-Control: no-store`, and does not expose partner B's settlements.
3. Submit invalid bank details and an amount different from the entire available balance. Verify no settlement, HOLD earning, or audit record is created.
4. Submit a valid request. Verify exactly one REQUESTED settlement, its immutable account snapshot, associated settlement items, HOLD earnings, and one audit entry.
5. Retry the same request and concurrently submit another request. Verify no second active settlement or duplicate earning reservation is created.
6. Sign in as an unrelated partner. Verify the first partner's settlement cannot be viewed or changed.
7. Sign in as admin. Verify review preflight, amount and audit checks; approve exactly once. Verify repeated approval is rejected.
8. Attempt PAID without transfer confirmation. Verify rejection and unchanged APPROVED state.
9. With synthetic transfer confirmation, mark PAID once. Verify PAID earnings, paid timestamp, one audit entry, and rejected duplicate processing.
10. In a separate settlement, REJECT a REQUESTED item. Verify HOLD earnings return to AVAILABLE, no payout occurs, and audit is recorded.
11. Simulate a database failure during an item update; verify transaction rollback leaves settlement and all earnings consistent.
12. Simulate a network timeout after a successful request; verify the UI locks repeat submission and offers recent-history verification.
13. Verify admin/partner notification content and delivery in a disposable test channel; do not send to real customers.
14. Verify KYC documents, KYC admin pages and migrations are absent, and all KYC feature flags remain disabled.
15. Capture sanitized HTTP status codes, test account identifiers, database row counts and timestamps as evidence. Never commit personal identity documents, full bank account numbers, credentials or database URLs.

**Gate:** CI and source-level checks do not replace the above authenticated acceptance tests. Do not merge or deploy without explicit operator approval.
