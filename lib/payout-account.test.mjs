import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
test("payout creation and admin review both require matching verified account",()=>{
 const partner=read("../app/api/partner/settlements/route.ts");
 const admin=read("../app/api/admin/settlements/[id]/review/route.ts");
 for(const source of [partner,admin]){
  assert.match(source,/PAYOUT_ACCOUNT_MISMATCH/);
  assert.match(source,/payoutAccountMatches/);
  assert.match(source,/verified_account_fingerprint/);
 }
});
test("account reset serializes with settlement requests and rejects pending payouts",()=>{
 const reset=read("../app/api/admin/payout-verifications/[partnerId]/reset/route.ts");
 const settlement=read("../app/api/partner/settlements/route.ts");
 const partnerLock="select id from partners where id=";
 assert.ok(reset.indexOf(partnerLock)>=0);
 assert.ok(reset.indexOf(partnerLock)<reset.indexOf("select id,status from partner_payout_verifications"));
 assert.match(settlement,/select id from \$\{partners\} where id=\$\{user\.partnerId!\} for update/);
 assert.match(reset,/status in \('REQUESTED','APPROVED'\)/);
 assert.match(reset,/PAYOUT_IN_PROGRESS/);
 assert.match(reset,/verified_account_fingerprint=null/);
 assert.match(reset,/PAYOUT_IDENTITY_RESET/);
});
test("approval requires both document review and account binding",()=>{
 const review=read("../app/api/admin/payout-verifications/[partnerId]/review/route.ts");
 assert.match(review,/DOCUMENT_REVIEW_REQUIRED/);
 assert.match(review,/IDENTITY_MATCH_CONFIRMATION_REQUIRED/);
 assert.match(review,/verified_account_fingerprint ~/);
});
