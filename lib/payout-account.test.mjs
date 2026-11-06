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
 assert.match(source,/disabled=\{busy\|\|!maskedConfirmed\|\|!identityFileName\}/);
});

test("identity privacy instructions change with selected document type",()=>{
 const source=read("../components/PayoutVerificationForm.tsx");
 assert.match(source,/const personalId=documentType==="PERSONAL_ID"/);
 assert.match(source,/setDocumentType\(event.target.value\);setMaskedConfirmed\(false\)/);
 assert.match(source,/personalId\?"신분증 사본":"사업자등록증 사본"/);
 assert.match(source,/사업자등록증에 주민등록번호/);
});

test("changing identity file resets privacy confirmation",()=>{
 const source=read("../components/PayoutVerificationForm.tsx");
 assert.match(source,/setIdentityFileName\(event.target.files\?\.\[0\]\?\.name\?\?""\)/);
 assert.match(source,/onChange=\{event=>\{setMaskedConfirmed\(false\);setIdentityFileName/);
 assert.match(source,/선택한 서류:/);
});

test("identity type switch clears stale file and upload requires a selected document",()=>{
 const source=read("../components/PayoutVerificationForm.tsx");
 assert.match(source,/key=\{documentType\} name="identityDocument"/);
 assert.match(source,/disabled=\{busy\|\|!maskedConfirmed\|\|!identityFileName\}/);
 assert.match(source,/가림 예시:/);
});

test("identity form prevents document changes during upload",()=>{
 const source=read("../components/PayoutVerificationForm.tsx");
 assert.match(source,/select name="documentType" disabled=\{busy\}/);
 assert.match(source,/name="identityDocument" type="file"[^>]*disabled=\{busy\}/);
 assert.match(source,/type="checkbox" disabled=\{busy\}/);
});

test("KYC API requires explicit privacy masking acknowledgement",()=>{
 const api=read("../app/api/partner/payout-verification/route.ts");
 const form=read("../components/PayoutVerificationForm.tsx");
 assert.match(api,/form.get\("privacyMaskConfirmed"\)!=="true"/);
 assert.match(api,/PRIVACY_MASK_CONFIRMATION_REQUIRED/);
 assert.match(form,/data.set\("privacyMaskConfirmed",maskedConfirmed\?"true":"false"\)/);
});

test("Content-Length validator uses digit class rather than escaped backslash",()=>{
 const source=read("../app/api/partner/payout-verification/route.ts");
 assert.ok(source.includes(String.raw`/^\d+$/`));
 assert.ok(!source.includes(String.raw`/^\\d+$/`));
});

test("rejected KYC cooldown returns remaining Retry-After seconds",()=>{
 const source=read("../app/api/partner/payout-verification/route.ts");
 assert.match(source,/const remainingMs=10\*60\*1000-\(Date\.now\(\)-submittedAt\)/);
 assert.match(source,/String\(Math\.ceil\(remainingMs\/1000\)\)/);
 assert.doesNotMatch(source,/headers:\{"Retry-After":"600"\}/);
});

test("KYC form displays server-provided remaining cooldown time",()=>{
 const source=read("../components/PayoutVerificationForm.tsx");
 assert.match(source,/response.headers.get\("Retry-After"\)/);
 assert.match(source,/result\?\.error==="RESUBMISSION_COOLDOWN"/);
 assert.match(source,/Math.ceil\(seconds\/60\)/);
 assert.match(source,/Number.isSafeInteger\(seconds\)/);
});

test("KYC upload reports document-specific size and extension errors",()=>{
 const source=read("../components/PayoutVerificationForm.tsx");
 assert.match(source,/\["bankDocument","통장 사본"\]/);
 assert.match(source,/\["pdf","jpg","jpeg","png"\]\.includes\(ext\)/);
 assert.match(source,/파일만 제출할 수 있습니다/);
 assert.match(source,/INVALID_CONTENT_LENGTH:/);
});


test("all KYC admin APIs require authentication and stay disabled before rollout",()=>{
 const paths=[
  "../app/api/admin/payout-verifications/[partnerId]/review/route.ts",
  "../app/api/admin/payout-verifications/[partnerId]/reset/route.ts",
  "../app/api/admin/payout-verifications/[partnerId]/documents/[kind]/route.ts"
 ];
 for(const path of paths){
  const source=read(path);
  const authIndex=source.indexOf("await requireAdmin()");
  const gateIndex=source.indexOf('process.env.PAYOUT_KYC_DOCUMENT_UPLOAD!=="enabled"');
  assert.ok(authIndex>=0, `${path} must authenticate admin`);
  assert.ok(gateIndex>authIndex, `${path} must check rollout flag after authentication`);
  assert.match(source,/503/);
  assert.match(source,/no-store/);
 }
});


test("KYC upload enforces streaming payload cap before multipart parsing",()=>{
 const source=read("../app/api/partner/payout-verification/route.ts");
 assert.match(source,/const maxRequestBytes=MAX_BYTES\*2\+1024\*1024/);
 assert.match(source,/request\.body\.getReader\(\)/);
 assert.match(source,/totalBytes\+=value\.byteLength/);
 assert.match(source,/totalBytes>maxRequestBytes/);
 assert.match(source,/reader\.cancel\(\)\.catch/);
 assert.match(source,/status:413/);
 assert.ok(source.indexOf("totalBytes>maxRequestBytes")<source.indexOf(".formData()"));
});


test("KYC upload requires DB-backed rate limiting before reading the request body",()=>{
 const source=read("../app/api/partner/payout-verification/route.ts");
 const featureGate=source.indexOf('process.env.PAYOUT_KYC_DOCUMENT_UPLOAD!=="enabled"');
 const limiterGate=source.indexOf('process.env.PAYOUT_UPLOAD_RATE_LIMIT!=="enabled"');
 const limiterQuery=source.indexOf("insert into partner_payout_upload_limits");
 const parseBody=source.indexOf("request.body.getReader()");
 assert.ok(featureGate>=0);
 assert.ok(limiterGate>featureGate);
 assert.ok(limiterQuery>limiterGate);
 assert.ok(parseBody>limiterQuery);
 assert.match(source,/UPLOAD_RATE_LIMIT_UNAVAILABLE/);
 assert.match(source,/status:503/);
 assert.match(source,/UPLOAD_RATE_LIMITED/);
 assert.match(source,/status:429/);
});


test("KYC form explains disabled document uploads and missing mandatory limiter",()=>{
 const source=read("../components/PayoutVerificationForm.tsx");
 assert.match(source,/UPLOAD_RATE_LIMIT_UNAVAILABLE:"안전한 서류 접수를 위한 요청 횟수 제한 설정이 준비되지 않았습니다/);
 assert.match(source,/DOCUMENT_UPLOAD_UNAVAILABLE:"현재 본인확인 서류 접수 기능은 준비 중입니다/);
});


test("KYC admin review never caches success or error responses",()=>{
 const source=read("../app/api/admin/payout-verifications/[partnerId]/review/route.ts");
 assert.match(source,/const privateJson:typeof Response\.json=/);
 assert.match(source,/"Cache-Control":"no-store"/);
 assert.doesNotMatch(source,/return Response\.json\(/);
 assert.match(source,/return privateJson\(\{ok:false,error:"REVIEW_FAILED"\}/);
});
