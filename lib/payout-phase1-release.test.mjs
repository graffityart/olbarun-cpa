import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const absent = [
  "app/api/partner/payout-verification/route.ts",
  "app/api/admin/payout-verifications/[partnerId]/review/route.ts",
  "app/api/admin/payout-verifications/[partnerId]/documents/[kind]/route.ts",
  "app/admin/payout-verifications/page.tsx",
  "db/migrations/0020_partner_payout_verifications.sql",
  "db/migrations/0021_partner_payout_upload_limits.sql",
];

test("phase-one release excludes KYC document endpoints, UI and migrations", () => {
  for (const file of absent) assert.equal(existsSync(file), false, file);
});

test("phase-one settlement APIs do not query KYC tables or enable enforcement", () => {
  for (const file of ["app/api/partner/settlements/route.ts", "app/api/admin/settlements/[id]/review/route.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /partner_payout_verifications|PAYOUT_KYC_ENFORCEMENT|PAYOUT_KYC_DOCUMENT_UPLOAD/, file);
  }
});

test("phase-one settlement page does not load private-document UI", () => {
  const source = readFileSync("app/partner/settlements/page.tsx", "utf8");
  assert.doesNotMatch(source, /PayoutVerificationForm|PayoutVerificationReview|PayoutVerificationReset/);
});

test("partner payout UI preserves ambiguous-response duplicate submission lock", () => {
  const source = readFileSync("components/SettlementRequest.tsx", "utf8");
  assert.match(source, /if \(inFlight\.current \|\| completed \|\| outcomeUnknown/);
  assert.match(source, /if \(res\.ok \|\| res\.status >= 500/);
  assert.match(source, /setOutcomeUnknown\(true\)/);
  assert.match(source, /res\.status !== 201/);
});

test("admin payout UI rechecks server status and requires transfer confirmation", () => {
  const source = readFileSync("components/SettlementReview.tsx", "utf8");
  assert.match(source, /\/api\/admin\/settlements\/\$\{id\}\/status/);
  assert.match(source, /current\.auditVerified!==true\|\|current\.amountVerified!==true/);
  assert.match(source, /action==="PAID"&&!transferConfirmed/);
  assert.match(source, /reviewSubmitted\?["']?요청 결과가 불확실합니다/);
});
