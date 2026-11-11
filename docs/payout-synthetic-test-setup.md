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

## Status

The new database was verified empty (0 public tables). Schema migrations, synthetic account seeding, dedicated test runtime, and authenticated HTTP E2E have **not** been performed. Passing unit tests and a read-only probe does not imply that the end-to-end release gate passed.

## Initial migration static review (2026-11-11)

Inspected `db/migrations/0000_initial.sql` on the release branch. It contains 18 `CREATE TABLE IF NOT EXISTS` statements for `users`, `partners`, `advertisers`, `campaigns`, `campaign_rates`, `tracking_links`, `clicks`, `conversions`, `conversion_data`, `advertiser_ledger`, `earnings`, `settlements`, `settlement_items`, `posting_campaigns`, `posting_applications`, `posting_submissions`, `posting_reviews`, and `auth_sessions`. It also enables `pgcrypto` and creates supporting enums/indexes. No `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `DROP`, or `ALTER TABLE` statements were found in this file.

**This is a review of the initial migration only**, not approval to run the entire migration set. Later migrations, enum changes, schema drift and notification dependencies still need review. No DDL has been applied to the synthetic DB.
