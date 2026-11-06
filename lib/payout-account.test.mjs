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


test("KYC approval requires a separate privacy masking confirmation",()=>{
 const api=read("../app/api/admin/payout-verifications/[partnerId]/review/route.ts");
 const form=read("../components/PayoutVerificationReview.tsx");
 assert.match(api,/body\?\.sensitiveDataMasked!==true/);
 assert.match(api,/PRIVACY_MASK_REVIEW_REQUIRED/);
 assert.match(form,/sensitiveDataMasked:decision==="APPROVED"\?masked:undefined/);
 assert.match(form,/checked=\{masked\}/);
});


test("KYC approval audit records both account match and privacy masking checks",()=>{
 const source=read("../app/api/admin/payout-verifications/[partnerId]/review/route.ts");
 assert.match(source,/action:"PAYOUT_IDENTITY_REVIEW"/);
 assert.match(source,/identityAndBankMatch:decision==="APPROVED",sensitiveDataMasked:decision==="APPROVED"/);
 assert.match(source,/body\?\.sensitiveDataMasked!==true/);
});


test("KYC admin review rejects oversized streamed JSON before parsing",()=>{
 const source=read("../app/api/admin/payout-verifications/[partnerId]/review/route.ts");
 assert.match(source,/const maxReviewBytes=4096/);
 assert.match(source,/request\.body\?\.getReader\(\)/);
 assert.match(source,/size\+=value\.byteLength/);
 assert.match(source,/size>maxReviewBytes/);
 assert.match(source,/REVIEW_PAYLOAD_TOO_LARGE/);
 assert.match(source,/status:413/);
 assert.ok(source.indexOf("size>maxReviewBytes")<source.indexOf(".json().catch"));
});


test("KYC review accepts only JSON object requests",()=>{
 const source=read("../app/api/admin/payout-verifications/[partnerId]/review/route.ts");
 assert.match(source,/request\.headers\.get\("content-type"\)/);
 assert.match(source,/INVALID_CONTENT_TYPE/);
 assert.match(source,/status:415/);
 assert.match(source,/Array\.isArray\(body\)/);
 assert.ok(source.indexOf("INVALID_CONTENT_TYPE")<source.indexOf("getReader()"));
});


test("KYC administrator UI explains privacy and stale review errors",()=>{
 const source=read("../components/PayoutVerificationReview.tsx");
 assert.match(source,/PRIVACY_MASK_REVIEW_REQUIRED:/);
 assert.match(source,/IDENTITY_MATCH_CONFIRMATION_REQUIRED:/);
 assert.match(source,/DOCUMENT_REVIEW_REQUIRED:/);
 assert.match(source,/NOT_PENDING:/);
 assert.match(source,/errors\[result\?\.error\]/);
});


test("KYC final approval prompt warns against approving exposed personal data",()=>{
 const source=read("../components/PayoutVerificationReview.tsx");
 assert.match(source,/window\.confirm\("통장·신분확인 서류의 명의 일치와 개인정보 가림을 모두 확인했습니까\?/);
 assert.match(source,/개인정보가 노출된 서류는 승인하지 말고 반려해 주세요/);
});


test("Malformed KYC multipart upload receives 400 instead of internal error",()=>{
 const source=read("../app/api/partner/payout-verification/route.ts");
 assert.match(source,/\.formData\(\)\.catch\(\(\)=>null\)/);
 assert.match(source,/INVALID_MULTIPART_BODY/);
 assert.match(source,/if\(!form\)return privateJson\(\{ok:false,error:"INVALID_MULTIPART_BODY"\},\{status:400\}\)/);
});


test("Partner KYC form explains malformed multipart errors",()=>{
 const source=read("../components/PayoutVerificationForm.tsx");
 assert.match(source,/INVALID_MULTIPART_BODY:/);
 assert.match(source,/INVALID_CONTENT_TYPE:/);
 assert.match(source,/파일을 다시 선택한 후 제출해 주세요/);
});


test("KYC review media type permits only JSON with optional UTF-8 charset",()=>{
 const source=read("../app/api/admin/payout-verifications/[partnerId]/review/route.ts");
 assert.match(source,/charset\\s\*=\\s\*utf-8/);
 assert.match(source,/INVALID_CONTENT_TYPE/);
});


test("KYC multipart boundary header must be complete and unambiguous",()=>{
 const source=read("../app/api/partner/payout-verification/route.ts");
 assert.match(source,/Require one well-formed boundary parameter/);
 assert.match(source,/INVALID_CONTENT_TYPE/);
 assert.match(source,/boundary=/);
 assert.ok(source.indexOf("boundary=")<source.indexOf("formData().catch"));
});

test("KYC multipart boundary validation accepts valid and rejects malformed headers",()=>{
 const source=read("../app/api/partner/payout-verification/route.ts");
 const line=source.split("\n").find(line=>line.includes("boundary=(?:")&&line.includes("INVALID_CONTENT_TYPE"));
 assert.ok(line,"multipart boundary validation must exist");
 const match=line.match(/if\(!\/(.+)\/i\.test\(contentType\)\)/);
 assert.ok(match,"multipart boundary validation must use anchored case-insensitive pattern");
 const pattern=new RegExp(match[1],"i");
 for(const value of ["multipart/form-data; boundary=----WebKitFormBoundaryAbCd1234","multipart/form-data; boundary=\"abc123\"","MULTIPART/FORM-DATA; boundary=abc-123"]){
  assert.equal(pattern.test(value),true,value);
 }
 for(const value of ["multipart/form-data","multipart/form-data; boundary=","multipart/form-data; boundary=a; boundary=b","multipart/form-data; boundary=abc; charset=utf-8","multipart/form-data; boundary=\"unclosed","text/plain; boundary=abc","multipart/form-data; boundary="+("x".repeat(71))]){
  assert.equal(pattern.test(value),false,value);
 }
});

test("KYC review JSON media type validation accepts only supported headers",()=>{
 const source=read("../app/api/admin/payout-verifications/[partnerId]/review/route.ts");
 const line=source.split("\n").find(line=>line.includes("INVALID_CONTENT_TYPE")&&line.includes("application"));
 assert.ok(line,"review content type validation must exist");
 const match=line.match(/if\(!\/(.+)\/i\.test\(request\.headers\.get\("content-type"\)/);
 assert.ok(match,"review content type validation must use a regex");
 const pattern=new RegExp(match[1],"i");
 for(const value of ["application/json","application/json; charset=utf-8","APPLICATION/JSON; CHARSET=UTF-8"]){
  assert.equal(pattern.test(value),true,value);
 }
 for(const value of ["application/json; charset=iso-8859-1","application/json; foo=bar","application/json; charset=utf-8; foo=bar","text/json","application/jsonx","application/json;"]){
  assert.equal(pattern.test(value),false,value);
 }
});

test("KYC review only accepts documented request fields",()=>{
 const source=read("../app/api/admin/payout-verifications/[partnerId]/review/route.ts");
 assert.match(source,/const allowedReviewFields=new Set\(\["decision","reason","identityAndBankMatch","sensitiveDataMasked"\]\)/);
 assert.match(source,/Object\.keys\(body\)\.some\(key=>!allowedReviewFields\.has\(key\)\)/);
 assert.ok(source.indexOf("allowedReviewFields")<source.indexOf("getDb().transaction"));
});

test("KYC review failures do not log raw exception objects",()=>{
 const source=read("../app/api/admin/payout-verifications/[partnerId]/review/route.ts");
 assert.doesNotMatch(source,/console\.error\("Payout identity review failed",\s*error\)/);
 assert.match(source,/console\.error\("Payout identity review failed",\{code:"REVIEW_FAILED"\}\)/);
});

test("Private KYC document responses restrict cross-origin resource loading",()=>{
 const source=read("../app/api/admin/payout-verifications/[partnerId]/documents/[kind]/route.ts");
 assert.match(source,/Cross-Origin-Resource-Policy":"same-origin"/);
 assert.match(source,/Permissions-Policy":"camera=\(\), microphone=\(\), geolocation=\(\)"/);
 assert.match(source,/Content-Disposition/);
 assert.match(source,/Cache-Control":"private, no-store"/);
});

test("KYC review requires distinct bank and identity document blob paths",()=>{
 const source=read("../app/api/admin/payout-verifications/[partnerId]/review/route.ts");
 assert.match(source,/\(\$\{decision\}=\x27REJECTED\x27 or bank_document_blob_path <> identity_document_blob_path\)/);
 assert.match(source,/\(\$\{decision\}=\x27REJECTED\x27 or \(bank_document_blob_path is not null and identity_document_blob_path is not null\)\)/);
});

test("KYC audit logs do not duplicate free-text rejection reasons",()=>{
 const source=read("../app/api/admin/payout-verifications/[partnerId]/review/route.ts");
 const audit=source.split('action:"PAYOUT_IDENTITY_REVIEW"')[1];
 assert.ok(audit,"review audit log must exist");
 assert.doesNotMatch(audit.split("return {status:decision}")[0],/reason:decision/);
 assert.match(source,/rejection_reason=\$\{decision==="REJECTED"\?reason:null\}/);
});
