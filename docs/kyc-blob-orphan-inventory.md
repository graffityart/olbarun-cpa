# Private KYC blob orphan inventory: safe rollout specification

Status: DESIGN ONLY. No Blob listing, deletion, or worker is enabled by this document.

## Scope
- Only list objects under `payout-verifications/` in the dedicated, non-production private Blob store.
- Require admin authentication, an explicit inventory-only feature flag (default OFF), and a separate isolated test environment.
- Never return filenames, blob paths, partner identifiers, document content, or raw storage errors to the browser. Return aggregate counts and a completion flag.
- Do not infer that a missing database reference authorizes deletion.

## Candidate selection
1. Page through the complete Blob listing using the provider cursor; cap per-run pages and objects. If the scan is truncated, return `complete:false` and do not report a definitive orphan total.
2. Only consider paths with the exact expected prefix and known extension. Unknown or malformed paths are excluded from automated actions and counted for manual review.
3. Exclude objects younger than a configurable conservative grace window. Blob creation time must be verified from provider metadata; unknown timestamps are excluded.
4. Batch-check both `bank_document_blob_path` and `identity_document_blob_path` against the database. Treat any reference as active regardless of verification status.
5. A blob missing from the DB is a **candidate** only. Account for upload-before-commit, failed cleanup, DB/Blob eventual consistency, pending retries and concurrent resubmissions.
6. Re-scan candidates after the grace window; any eventual deletion requires a separately approved retention policy, legal-hold review, active payout check, admin authorization, audit trail, and exact-path recheck.

## Failure safety
- On Blob list failure, DB timeout, partial pagination, or inconsistent results: fail closed, mark `complete:false`, and never delete.
- Avoid per-object personal identifiers in logs. Log only aggregate counts and opaque run ID.
- Never use the production `DATABASE_URL` with a test Blob token or vice versa.
- Keep `PAYOUT_KYC_DOCUMENT_UPLOAD` disabled in production until end-to-end verification is approved.

## Verification checklist
- Empty storage; referenced objects; recently uploaded unreferenced objects; aged unreferenced objects.
- Partial listing and cursor failures; DB failures; malformed path; missing timestamp.
- Concurrent submission/resubmission during scan; mismatched DB/storage environment.
- Unauthorized access; no-store headers; no PII in response or logs.
- Zero deletion calls for every inventory-only test.

## Existing read-only DB inventory
`/api/admin/payout-verifications/retention-preview?before=YYYY-MM-DD` counts rejected records and partial document references. It does **not** list Blob objects; `orphanBlobScanPerformed:false` must remain truthful until an actual isolated storage scan is implemented.
