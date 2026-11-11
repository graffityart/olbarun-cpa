# Payout synthetic DB migration plan (review-only)

Target: Neon project `orange-salad-93665842`, database `mypickup_payout_test` only. **This document does not authorize or execute SQL.** Do not use the production Neon project or shared Vercel Preview environment.

## Verified dependency order

1. `0000_initial.sql` creates the core `users`, `partners`, `advertisers`, `earnings`, `settlements`, `settlement_items`, `auth_sessions` and other core tables, enums and indexes.
2. `0001_advertiser_users.sql` creates `advertiser_users` and requires the `users` and `advertisers` tables from step 1.
3. `0002_notifications.sql` creates `notifications` referencing `users`. Before authenticated HTTP testing, notification delivery must be explicitly disabled.
4. `0003_posting_finance.sql` alters `advertiser_ledger` and `earnings`, referencing `posting_submissions` from step 1. Requires a manual DDL review.
5. `0005_audit_logs.sql` creates `audit_logs`, required by the later partner signup migration.
6. `0009_partner_instant_signup.sql` **HOLD**: modifies existing pending users and inserts audit logs. Not needed to create three already-active synthetic accounts. Do not execute in a blanket migration batch.

Other migrations (`0004`, `0006`-`0008`, `0010`, `0011`, `0015`-`0017`, `20261012_*`, and `manual_*`) must be inspected for dependencies and application requirements before inclusion. Filename sorting is **not** an approved migration plan.

## Safe execution prerequisites

- Confirm project ID, database name, endpoint, branch, and distinct production connection host; never log passwords or connection strings.
- Review the complete SQL for every selected migration, including extension privileges, foreign keys, indexes, and functions. The regex audit is not a SQL parser.
- Use a dedicated test-only migration runner with an explicit allowlist, no production credentials, and an execution log. Do not run `drizzle-kit push` or blanket `db/migrations/*.sql` against any environment.
- Run read-only `db:check-payout-test` and `db:check-payout-schema` after the schema is created.
- Confirm external email, SMS, payment, and postbacks are disabled in the **actual test runtime**, not just asserted by an environment variable.
- Only then run the guarded `db:seed-payout-synthetic` command with non-deliverable `.invalid` emails. Use disposable credentials.
- Verify the synthetic accounts and transactions in the dedicated DB, and never connect production or an existing shared Preview deployment to it.

## Current status

As of 2026-11-11, the dedicated test database was checked and contained **zero tables**. No migration or seed has been executed. The plan is intentionally staged pending further dependency review and isolated runtime configuration.
