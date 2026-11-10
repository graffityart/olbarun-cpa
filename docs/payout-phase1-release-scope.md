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

## Release verification update (2026-11-11)

- Commit `f85543c9`: all four GitHub Actions workflows passed, and Vercel Preview succeeded after adapting settlement response tests for no-store headers.
- The phase-one branch now adds no-store headers to partner settlement submission/history and administrator review/status responses. These changes have source-level regression assertions, but **authenticated HTTP behavior is still unverified**.
- The disposable PostgreSQL suite already includes a simulated audit-persistence failure test that checks settlement `APPROVED`, earning `HOLD`, and zero audit rows after rollback. A redundant follow-up test was removed; do not count duplicate tests as extra independent coverage.
- Later commits have a successful Vercel Preview, but GitHub Actions results for the latest branch head must be independently confirmed before release.
- No production merge, deployment, schema migration, environment-variable change, or live payout is authorized by these checks.

## Isolated authenticated testing: mandatory preflight

Neon branch inventory checked on 2026-11-11: `production` is the default branch; `payout-kyc-migration-validation-20261106` is a separate branch but was created from production data. **A database branch is not automatically a synthetic-data environment.** Do not create test partners or trigger notification flows in a production-data clone without first confirming safe data isolation and disabling external effects.

Before any authenticated HTTP test:
1. Provision a **new empty** PostgreSQL database (or independently scrub all cloned personal/customer records); never reuse production or the shared Preview `DATABASE_URL`.
2. Provision synthetic partner and administrator identities, synthetic earnings, and an isolated notification sink. Verify email, SMS, webhooks, postbacks, and payout providers cannot contact real recipients.
3. Deploy a dedicated nonproduction application whose `DATABASE_URL` points only to the synthetic database; confirm the effective runtime value without logging credentials. Use separate storage or disable upload paths.
4. Confirm all KYC feature flags remain off for phase 1. Do not connect the KYC Blob store or migrate KYC tables as part of this release.
5. Only then execute the 15 authenticated acceptance checks above, capture redacted evidence, and stop immediately if any external effect or shared-resource connection is detected.

**Status:** The existing Neon validation branch is **not approved** as an isolated synthetic test target. No authenticated HTTP test has been performed. The green CI tests use a disposable localhost PostgreSQL service and do not exercise live application authentication.
