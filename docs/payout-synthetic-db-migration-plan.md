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

## Remaining migration dependency review (2026-11-11)

Reviewed source SQL for all remaining files:

| File | Dependencies / constraints | Test DB handling |
| --- | --- | --- |
| `0004_cpa_accounting_guards.sql` | Unique indexes on `advertiser_ledger.conversion_id`, `earnings.conversion_id` | Optional for minimum schema; include for CPA accounting parity after core |
| `0006_login_attempts.sql` | Independent table for login throttling | Include before authenticated HTTP E2E |
| `0007_quick_jobs.sql` | `partners`, `users`, `earnings`; contains its own BEGIN/COMMIT | Optional for payout-only E2E; runner must not blindly nest transactions |
| `0008_customer_support.sql` | Independent support/captcha tables | Not needed for payout-only E2E |
| `0010_customer_notices.sql` | `users` FK | Not needed for payout-only E2E |
| `0011_settlement_item_uniqueness.sql` | `settlement_items`; duplicate check required for populated databases | Include for payout tests after core, with duplicate preflight |
| `0015_posting_materials.sql` | `campaigns` FK with ON DELETE CASCADE | Only needed for posting file E2E |
| `0016_campaign_blob_materials.sql` | `campaigns` FK with ON DELETE CASCADE | Only needed for blob upload E2E |
| `0017_campaign_blob_url_unique.sql` | Depends on `0016_campaign_blob_materials.sql` | Must run after 0016 |
| `20261012_customer_events.sql` | `users` FK; pending production approval comment | Not needed for payout-only E2E |
| `manual_cpa_ledger_reviews.sql` | `conversions` and `users` FKs | Not needed for payout-only E2E |

**Proposed minimum isolated payout schema set:** `0000` → `0001` → `0005` → `0006` → `0011`. Add `0002` only if the isolated app needs notification storage, with actual delivery disabled. Add `0003` and `0004` if posting/CPA accounting integration tests require them. **Exclude `0009` from all automated synthetic setup.** Confirm schema compatibility with app routes before executing anything.

The minimum set is a *candidate*, not an executed or proven migration sequence. SQL `CREATE TABLE IF NOT EXISTS` does not validate existing table shape. A successful lexical audit does not prove referential integrity, permissions, application compatibility, or safe data changes.
