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

test("rejected KYC resubmissions have atomic cooldown and clear user errors",()=>{
 const route=read("../app/api/partner/payout-verification/route.ts");
 const ui=read("../components/PayoutVerificationForm.tsx");
 assert.match(route,/RESUBMISSION_COOLDOWN/);
 assert.match(route,/submitted_at<=now\(\)-interval '10 minutes'/);
 assert.match(route,/status='REJECTED'/);
 assert.match(ui,/RESUBMISSION_COOLDOWN/);
});

test("document format detection validates structural markers beyond magic prefixes",()=>{
 const source=read("../app/api/partner/payout-verification/route.ts");
 assert.match(source,/bytes\[4\]===0x2d/);
 assert.match(source,/bytes\[bytes.length-1\]===0xd9/);
 assert.match(source,/\[73,72,68,82\]/);
 assert.match(source,/\[73,69,78,68,174,66,96,130\]/);
});

test("private administrator document responses prevent caching and framing",()=>{
 const source=read("../app/api/admin/payout-verifications/[partnerId]/documents/[kind]/route.ts");
 assert.match(source,/requireAdmin\(/);
 assert.match(source,/Cache-Control":"private, no-store"/);
 assert.match(source,/Referrer-Policy":"no-referrer"/);
 assert.match(source,/X-Frame-Options":"DENY"/);
 assert.match(source,/Content-Security-Policy/);
 assert.match(source,/PAYOUT_IDENTITY_DOCUMENT_VIEW/);
});

test("document upload rejects malformed multipart text fields and content lengths",()=>{
 const source=read("../app/api/partner/payout-verification/route.ts");
 assert.match(source,/Number.isSafeInteger\(Number\(rawLength\)\)/);
 assert.match(source,/typeof bankName!=="string"/);
 assert.match(source,/typeof accountNumber!=="string"/);
 assert.match(source,/typeof accountHolder!=="string"/);
 assert.match(source,/typeof documentType!=="string"/);
});

test("document submission rejects duplicate or unknown multipart fields",()=>{
 const source=read("../app/api/partner/payout-verification/route.ts");
 assert.match(source,/allowedFields=new Set/);
 assert.match(source,/!allowedFields.has\(key\)/);
 assert.match(source,/form.getAll\(key\).length!==1/);
});

test("superseded KYC blobs are cleaned only after committed replacement",()=>{
 const source=read("../app/api/partner/payout-verification/route.ts");
 assert.match(source,/bank_document_blob_path,identity_document_blob_path from partner_payout_verifications/);
 assert.match(source,/const oldPaths=/);
 assert.match(source,/const active=new Set/);
 assert.match(source,/oldPaths.filter\(path=>!active.has\(path\)\)/);
 assert.match(source,/Old payout verification blob cleanup deferred/);
});

test("private document cleanup failures are observable without logging blob paths",()=>{
 const source=read("../app/api/partner/payout-verification/route.ts");
 assert.match(source,/const failedCount=cleanupResults.filter/);
 assert.match(source,/Old payout verification blob cleanup incomplete/);
 assert.match(source,/\{failedCount\}/);
});

test("identity upload requires explicit resident-number masking confirmation",()=>{
 const source=read("../components/PayoutVerificationForm.tsx");
 assert.match(source,/maskedConfirmed/);
 assert.match(source,/주민등록번호 뒷자리 7자리/);
 assert.match(source,/가린 상태로 새 파일을 저장/);
 assert.match(source,/disabled=\{busy\|\|!maskedConfirmed\}/);
});

test("identity privacy instructions change with selected document type",()=>{
 const source=read("../components/PayoutVerificationForm.tsx");
 assert.match(source,/const personalId=documentType==="PERSONAL_ID"/);
 assert.match(source,/setDocumentType\(event.target.value\);setMaskedConfirmed\(false\)/);
 assert.match(source,/personalId\?"신분증 사본":"사업자등록증 사본"/);
 assert.match(source,/사업자등록증에 주민등록번호/);
});
