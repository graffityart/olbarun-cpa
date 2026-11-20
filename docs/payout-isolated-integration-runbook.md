# Isolated payout integration test runbook

This runbook is for **synthetic test data only**. It is not a production deployment procedure and must never execute a bank transfer.

## Isolation and current state

- Source repository: `graffityart/olbarun-cpa`, branch `release/payout-phase1-20261110`.
- Dedicated Neon project: `orange-salad-93665842`; database: `mypickup_payout_test`.
- Original test branch: `br-royal-cherry-bemnl5l2` (must remain unchanged).
- Isolated integration branch: `br-falling-sunset-be4st6wz` (`payout-auth-integration-isolated-20261119`).
- The isolated branch initially contains three synthetic users, one **copied** auth-session record, zero settlements, and two AVAILABLE earnings totalling 20,000 KRW.
- The copied session row **does not disclose the raw session token** and is not a usable login credential.
- Production Neon project `soft-mud-72335385` and production domain `mypickup.kr` are strictly out of scope.

## Before any authenticated mutation

1. Create a **separate Vercel test project or isolated environment** that points *only* to the isolated branch's connection string. Do not overwrite `DATABASE_URL` on the existing Preview or production project.
2. Confirm database identity, branch ID, project ID, and dedicated hostname independently; require TLS and keep secrets out of logs.
3. Disable email, SMS, payment providers, real bank transfers, and external postbacks; restrict access to authorized testers.
4. Create **new dedicated test credentials** scoped to the isolated branch only. Do not rotate credentials on the original test branch or invalidate its existing session. Never print passwords or raw session tokens.
5. Do not run `scripts/seed-payout-synthetic-users.mjs` on the original branch: it explicitly rejects existing sessions. Any cleanup of copied session records requires separate review and authorization.
6. Snapshot the isolated branch's users, earnings, settlements, settlement_items, audit logs, and sessions before testing.

## Authenticated test cases (isolated branch only)

| Case | Expected application result | Database assertion |
| --- | --- | --- |
| Partner login | Session cookie; PARTNER ACTIVE | New session belongs to synthetic partner |
| Request full 20,000 KRW | HTTP 201; REQUESTED | Two earnings AVAILABLE → HOLD; exactly two settlement_items; audit request |
| Duplicate request | HTTP 409 | No duplicate settlement or earning reservation |
| Admin approve | APPROVED | Both earnings remain HOLD; one approval audit |
| Repeat approve | HTTP 409 | No additional approval audit |
| Paid without confirmation | HTTP 400 | No status or earning change |
| Paid with explicit synthetic confirmation | PAID | Both earnings HOLD → PAID; payment audit; **no bank transfer** |
| New request after PAID | Requires newly AVAILABLE earnings | No reuse of PAID earnings |
| Separate fixture: request then reject | REJECTED | Both earnings HOLD → AVAILABLE; rejection audit |
| Repeat reject | HTTP 409 | No additional rejection audit |
| Wrong role / missing Origin / forged cookie | HTTP 403 or 401 | No settlement, earning, or audit mutation |

Use separate disposable branch snapshots for the PAID and REJECTED paths so the same 20,000 KRW fixture can be tested independently. Confirm audit ordering and the requested/payment/item sums in each case. Do not infer real transfer completion from a PAID status; this API only records an administrator's confirmation.

## Completion criteria

- Automated build and source-level tests pass.
- HTTP requests execute against the **isolated** authenticated test deployment, not production or the original Preview.
- Database assertions confirm the complete request → approve → paid and request → reject → AVAILABLE lifecycles.
- No external side effects, no changes to the original test branch, and no production changes.
- Record sanitized response codes, transaction IDs, and counts only; never record credentials or bank-account details.
