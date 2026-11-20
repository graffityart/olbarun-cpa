import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const partner = readFileSync("app/api/partner/settlements/route.ts", "utf8");
const review = readFileSync("app/api/admin/settlements/[id]/review/route.ts", "utf8");
test("payout mutations enforce same-origin and authenticated roles", () => {
  for (const source of [partner, review]) {
    assert.match(source, /requirePayoutSameOrigin\(request\)/);
    assert.match(source, /getCurrentUser\(\)/);
    assert.match(source, /getDb\(\)\.transaction\(async tx=>/);
    assert.match(source, /for update/i);
  }
  assert.match(partner, /user\.role!=="PARTNER"/);
  assert.match(review, /admin\.role!=="ADMIN"&&admin\.role!=="SUPER_ADMIN"/);
});
test("partner request locks earnings and rejects partial and duplicate payouts", () => {
  assert.match(partner, /SETTLEMENT_ALREADY_PENDING/);
  assert.match(partner, /REQUEST_FULL_AVAILABLE_AMOUNT/);
  assert.match(partner, /eq\(earnings\.status,"AVAILABLE"\)/);
  assert.match(partner, /status:"HOLD"/);
  assert.match(partner, /"SETTLEMENT_REQUEST"/);
});
test("admin review checks transitions and earning ownership", () => {
  assert.match(review, /canReviewSettlement\(/);
  assert.match(review, /settlementAuditMatches\(/);
  assert.match(review, /hasUniqueSettlementEarnings\(/);
  assert.match(review, /settlementAmountsMatch\(/);
  assert.match(review, /earning\.partnerId!==row\.settlement\.partnerId/);
  assert.match(review, /status:"REJECTED"/);
  assert.match(review, /status:"AVAILABLE"/);
});
test("PAID requires explicit confirmation and has no direct transfer call", () => {
  assert.match(review, /body\.transferConfirmed!==true/);
  assert.match(review, /TRANSFER_CONFIRMATION_REQUIRED/);
  assert.match(review, /status:"PAID"/);
  assert.doesNotMatch(review, /fetch\(|axios\.|bankTransfer\(|transferFunds\(/);
});
