# Dedicated synthetic payout DB setup

The test project is `mypickup-payout-test` (`orange-salad-93665842`), with database `mypickup_payout_test`. It is independent of the live `olbarun-cpa` Neon project. Do not copy customer data or connect an existing shared Vercel Preview to it.

## Read-only verification

Configure `PAYOUT_TEST_DATABASE_URL` with the **dedicated test project's** connection string and `sslmode=require`. Keep credentials out of commits and logs. Set `PAYOUT_TEST_PROJECT_ID=orange-salad-93665842`, `PAYOUT_TEST_ISOLATION_CONFIRMED=yes`, and `NODE_ENV=test`.

Run `npm run db:check-payout-test`. The script checks DB identity and public table count and sets the connection to read-only before querying. It does not migrate, seed, or trigger payments.

## Migration and synthetic seeding gates

1. Inspect the current Drizzle schema in `db/schema/*.ts` and migrations in `db/migrations`; check migration dependencies and any migration that writes data.
2. Never use the current `scripts/seed-test-users.mjs` unchanged: it inserts fixed `@olbarunad.kr` email addresses. Build a synthetic-only seed using non-deliverable `.invalid` emails and randomly generated credentials.
3. Keep production `DATABASE_URL`, shared Preview variables, and external notification, email, SMS, payment, and postback endpoints untouched. Use a separate isolated test runtime with its own secrets.
4. Verify application migration status and backup/rollback plan before **any** schema write, even to the dedicated test database.
5. Only then exercise partner login, earnings availability, request creation, admin review, paid confirmation, concurrent requests, and audit logs using synthetic records. No real transfers.
6. Never promote this test DB or synthetic credentials into production.

## Current verified status (2026-11-11)

- Dedicated Neon project `orange-salad-93665842`, branch `br-royal-cherry-bemnl5l2`, database `mypickup_payout_test`. Production project is different.
- Six minimum payout migrations were applied in a single transaction (47 individual statements), creating 22 tables. All 11 required payout tables and the `settlement_items_settlement_earning_unique` index were verified.
- Three `@synthetic.invalid` identities (ADMIN, ADVERTISER, PARTNER) were inserted, with a single advertiser-user link and a single partner-user link. Their `password_hash` values start with `disabled$` and **cannot authenticate** using the app's scrypt password verifier.
- Two synthetic earnings were inserted for the synthetic partner, 12,000 + 8,000 KRW, both AVAILABLE. No settlement records remain.
- SQL-level request → approve → paid and request → reject → retry state transitions were exercised inside rollback-only PL/pgSQL blocks. These are **not HTTP API E2E tests**.
- Read-only fixture integrity preflight is available with `npm run db:check-payout-fixtures`. It needs the dedicated database credentials and environment gates and has not yet been executed from a connected Node runtime.
- A **dedicated application runtime** has not been provisioned. Existing shared Vercel Preview is not authorized for synthetic testing; its environment may include production credentials. No actual authenticated HTTP payout E2E has been executed.
- All four GitHub Actions workflows succeeded at commit `352a9cb`.

## HTTP E2E isolation prerequisites

1. Provision a separate application deployment or other disposable Node runtime. Do **not** reuse the existing production Vercel project/Preview without proving complete isolation.
2. Set that runtime's `DATABASE_URL` to the **dedicated** Neon test database only, and verify `select current_database()` returns `mypickup_payout_test`. Do not display connection strings.
3. Use separate session secrets and a test-only hostname. Disable external email, SMS, payment, postback, and webhook integrations **in their actual runtime implementations**, not merely with a declaration flag.
4. Use synthetic identities only. If testing real login, replace their disabled hashes with fresh scrypt hashes and strong, ephemeral credentials through an isolated test setup; never expose credentials in logs or commits.
5. Exercise unauthorized/other-partner requests, duplicate requests, admin approve/reject, explicit paid confirmation, notification/audit records, and rejection retry. No real bank transfers.
6. Reset synthetic sessions and settlement records after the test, verify the remaining fixtures, and never promote this environment to production.


## Initial migration static review (2026-11-11)

Inspected `db/migrations/0000_initial.sql` on the release branch. It contains 18 `CREATE TABLE IF NOT EXISTS` statements for `users`, `partners`, `advertisers`, `campaigns`, `campaign_rates`, `tracking_links`, `clicks`, `conversions`, `conversion_data`, `advertiser_ledger`, `earnings`, `settlements`, `settlement_items`, `posting_campaigns`, `posting_applications`, `posting_submissions`, `posting_reviews`, and `auth_sessions`. It also enables `pgcrypto` and creates supporting enums/indexes. No `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `DROP`, or `ALTER TABLE` statements were found in this file.

**This is a review of the initial migration only**, not approval to run the entire migration set. Later migrations, enum changes, schema drift and notification dependencies still need review. No DDL has been applied to the synthetic DB.

## Full migration inventory reviewed from CI (2026-11-11)

The successful payout release safety job at commit `b76b910` enumerated **17 SQL files**. The read-only lexical audit flagged two files for human review:

- `0003_posting_finance.sql`: two `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements adding posting submission references to `advertiser_ledger` and `earnings`, followed by unique indexes. This is schema-altering but not a data migration in the reviewed file.
- `0009_partner_instant_signup.sql`: `UPDATE users u SET status='ACTIVE'` for matching pending partners, then `INSERT INTO audit_logs` from the updated rows. **This is a data-changing migration** and must never run against production as part of synthetic test setup.

The audit is regex-based and is **not** a full SQL parser. Other statements, triggers, or dependency issues may still require manual review. CI passing means the audit ran successfully, not that all migrations were approved. The dedicated Neon synthetic database remains unmodified. Before applying SQL there, validate migration order, schema dependencies, test-project connection isolation, and any required extension/permissions.


## Verified isolated deployment and next HTTP E2E gate (2026-11-11)

This section supersedes the earlier statement that no dedicated application runtime had been provisioned.

- Isolated Vercel project: `mypickup-payout-test` (`prj_EQz60bBZESUlWzxXgD9EU5HyQDia`), separate from the live `olbarun-cpa` project.
- The first deployment unexpectedly resolved to target `production` and was canceled (`dpl_7FdbnPUjNXiYGR7UQfQnNs1tnJ2S`). A second deployment (`dpl_HHw6yANtbwCZoc8BEwv61vNuhNi7`) reached READY with `target: null` using release commit `3539c22`.
- The isolated deployment's `GET /api/health/db` returned HTTP 200 with `database: connected`. This is a live database connectivity check, **not** proof of authenticated payout E2E or of every outbound integration being disabled.
- The dedicated Neon test database still had three synthetic users, two earnings and zero settlements at the last read-only check.
- Preview/development environment variables include the dedicated test `DATABASE_URL` and isolation markers. The isolated project's production environment has **no DATABASE_URL** and includes `PAYOUT_TEST_PROJECT_ID` to fail closed if unexpectedly targeted.
- The synthetic runtime guard in `db/index.ts` rejects production Vercel environment, unexpected database name/host and missing SSL. The CPA postback and both Vercel Blob upload/finalize endpoints return 503 for the isolated test project.
- **Important limitation:** `PAYOUT_EXTERNAL_EFFECTS_DISABLED=yes` is an assertion, not a universal runtime egress firewall. Verify all relevant integrations before creating login-capable synthetic accounts.
- Synthetic identities still use disabled password hashes. The authenticated HTTP flow has **not** been run. Never paste a password, database URL, or session token into a GitHub commit, issue, build log, or public endpoint.
- A source-level regression test was added in commit `657a874`; its GitHub Actions status must be verified separately.

### Remaining test sequence

1. Verify the newest commit's four CI jobs and confirm the deployed commit matches the intended tested revision.
2. Inventory outbound integration paths (including file/blob, postback, email, payment and webhook) and confirm actual isolation.
3. Prepare short-lived synthetic-only login credentials using an isolated secret-handling workflow; avoid a publicly documented static test password.
4. Run authenticated partner request and admin review tests against the isolated hostname; verify negative cases and duplicate-request rejection, then reset test records.
5. Confirm zero real transfers and no production deployment, then record test results and only propose production release after explicit approval.


## Protected Preview API verification checkpoint (2026-11-12)

- Latest verified isolated Preview deployment: `dpl_28akfamzcARvkn4rMLN4zGe2fkbi`, commit `589f552`, `target: null`, READY.
- `GET /api/health/db` returned HTTP 200 with `database: connected`.
- A protected `GET /api/partner/settlements` request via the deployment fetch integration failed at Vercel's authentication layer with `deployment_authentication_required`. **This is not an application-level payout authorization result**.
- Read-only SQL verified three synthetic users (ADMIN, ADVERTISER, PARTNER) all retain `disabled$` password hashes; the isolated DB has two AVAILABLE earnings, zero settlements, and zero auth sessions.
- Keep Deployment Protection enabled. For authenticated HTTP tests, use an authorized `vercel curl` session scoped to this test project (or a short-lived same-project Trusted Sources development token); do not create a public protection bypass or weaken project access.
- Only after protection-layer access works, enable temporary synthetic credentials through a secret-safe procedure and execute isolated API E2E. Do not mistake a 401 from Vercel SSO for a 401 from the application.
