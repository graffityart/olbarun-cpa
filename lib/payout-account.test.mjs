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
test("account reset blocks resident registration numbers and avoids raw error logging",()=>{
 const source=read("../app/api/admin/payout-verifications/[partnerId]/reset/route.ts");
 assert.match(source,/SENSITIVE_REASON_DATA/);
 assert.match(source,/reason\.normalize\("NFKC"\)/);
 assert.doesNotMatch(source,/console\.error\("Payout verification reset failed",error\)/);
 assert.match(source,/metadata:\{verificationId:updated\[0\]\.id\}/);
 assert.doesNotMatch(source,/metadata:\{verificationId:updated\[0\]\.id,reason\}/);
});

test("account reset bounds JSON request size and rejects unexpected fields",()=>{
 const source=read("../app/api/admin/payout-verifications/[partnerId]/reset/route.ts");
 assert.match(source,/maxBodyBytes=4096/);
 assert.match(source,/RESET_PAYLOAD_TOO_LARGE/);
 assert.match(source,/INVALID_CONTENT_TYPE/);
 assert.match(source,/reader\.cancel\(\)/);
 assert.match(source,/Object\.keys\(body\)\.some\(key=>key!=="reason"\)/);
});

test("retention inventory is read-only, admin-only and excludes active payouts",()=>{
 const source=read("../app/api/admin/payout-verifications/retention-preview/route.ts");
 assert.match(source,/requireAdmin\(\)/);
 assert.match(source,/PAYOUT_KYC_DOCUMENT_UPLOAD/);
 assert.match(source,/datePattern/);
 assert.match(source,/status='REJECTED'/);
 assert.match(source,/not exists\(/);
 assert.match(source,/exists\(/);
 assert.match(source,/active_payout_excluded_count/);
 assert.match(source,/activePayoutExcludedCount/);
 assert.match(source,/candidateCount/);
 assert.match(source,/documentsDeleted:0/);
 assert.match(source,/retentionPolicyApproved:false/);
 assert.match(source,/deletionAllowed:false/);
 assert.match(source,/LEGAL_HOLD_REVIEW/);
 assert.match(source,/AUDITED_DELETE_WORKER/);
 assert.doesNotMatch(source,/\bdelete\s+from\b/i);
 assert.doesNotMatch(source,/\bupdate\s+partner_payout_verifications\b/i);
 assert.doesNotMatch(source,/\bdel\(/);
});

test("private KYC document access is audited per verification without personal data",()=>{
 const source=read("../app/api/admin/payout-verifications/[partnerId]/documents/[kind]/route.ts");
 assert.match(source,/requireAdmin\(\)/);
 assert.match(source,/status='PENDING'/);
 assert.match(source,/metadata:\{verificationId:rows\[0\]\.id,documentKind:kind\}/);
 assert.match(source,/Cache-Control":"private, no-store"/);
 assert.ok(source.indexOf("insert(auditLogs)")<source.indexOf("return new Response(file.stream"));
 assert.doesNotMatch(source,/metadata:\{[^}]*blob_path/);
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

test("KYC review rejects invalid field types before database writes",()=>{
 const source=read("../app/api/admin/payout-verifications/[partnerId]/review/route.ts");
 for(const field of ["reason","identityAndBankMatch","sensitiveDataMasked"]){
  assert.match(source,new RegExp('typeof body\\.'+field+'!=='));
 }
 assert.ok(source.indexOf('typeof body.reason!=="string"')<source.indexOf("getDb().transaction"));
 assert.ok(source.indexOf('typeof body.identityAndBankMatch!=="boolean"')<source.indexOf("getDb().transaction"));
});

test("KYC approval rejects unnecessary free-text reason",()=>{
 const source=read("../app/api/admin/payout-verifications/[partnerId]/review/route.ts");
 assert.match(source,/decision==="APPROVED"&&reason\.length>0/);
 assert.match(source,/decision==="REJECTED"&&!reason/);
 assert.ok(source.indexOf('decision==="APPROVED"&&reason.length>0')<source.indexOf("getDb().transaction"));
});

test("KYC review UI sends reason only for rejection",()=>{
 const source=read("../components/PayoutVerificationReview.tsx");
 assert.match(source,/reason:decision==="REJECTED"\?reason\.trim\(\):undefined/);
 assert.match(source,/identityAndBankMatch:decision==="APPROVED"\?matched:undefined/);
 assert.match(source,/sensitiveDataMasked:decision==="APPROVED"\?masked:undefined/);
});

test("KYC review UI resets confirmations only after successful response",()=>{
 const source=read("../components/PayoutVerificationReview.tsx");
 const success=source.indexOf('setReason("");setMatched(false);setMasked(false);');
 assert.ok(success>source.indexOf("if(!res.ok)"),"reset must occur after failed response guard");
 assert.ok(success<source.indexOf("router.refresh()"),"reset must occur before refresh");
 assert.match(source,/setMessage\(decision==="APPROVED"\?"승인되었습니다\."/);
});

test("KYC rejection requires explicit confirmation before sending request",()=>{
 const source=read("../components/PayoutVerificationReview.tsx");
 const confirm=source.indexOf('decision==="REJECTED"&&!window.confirm(');
 const submit=source.indexOf('setBusy(true);setMessage("")');
 assert.ok(confirm>=0&&confirm<submit,"rejection confirmation must precede submission");
 assert.match(source,/if\(decision==="REJECTED"&&!reason\.trim\(\)\)/);
});

test("KYC rejection form warns admins not to include sensitive personal data",()=>{
 const source=read("../components/PayoutVerificationReview.tsx");
 assert.match(source,/반려 사유에는 주민등록번호·계좌번호 등 개인정보를 입력하지 마세요/);
 assert.match(source,/주민등록번호 뒷자리를 가린 서류로 다시 제출해 주세요/);
 assert.match(source,/maxLength=\{2000\}/);
});

test("KYC review UI explains invalid input errors",()=>{
 const source=read("../components/PayoutVerificationReview.tsx");
 assert.match(source,/INVALID_INPUT:"검수 입력 내용을 확인해 주세요/);
 assert.match(source,/반려 사유는 2,000자 이내로 작성해야 합니다/);
});

test("KYC review rejects full resident registration numbers before DB write",()=>{
 const route=read("../app/api/admin/payout-verifications/[partnerId]/review/route.ts");
 const guard=route.indexOf('error:"SENSITIVE_REASON_DATA"');
 assert.ok(guard>0&&guard<route.indexOf("getDb().transaction"));
 assert.match(route,/\\d\{6\}/);
 assert.match(route,/\\d\{7\}/);
 const ui=read("../components/PayoutVerificationReview.tsx");
 assert.match(ui,/SENSITIVE_REASON_DATA:"반려 사유에 주민등록번호 전체를 입력할 수 없습니다/);
});

test("KYC private document download only permits pending verification",()=>{
 const source=read("../app/api/admin/payout-verifications/[partnerId]/documents/[kind]/route.ts");
 assert.match(source,/and status='PENDING' limit 1/);
 assert.doesNotMatch(source,/status in \('PENDING','APPROVED','REJECTED'\)/);
 assert.match(source,/if\(rows\.length!==1\)return privateError\(404\)/);
});

test("KYC admin routes do not swallow auth redirects in generic error handlers",()=>{
 for(const path of [
  "../app/api/admin/payout-verifications/[partnerId]/review/route.ts",
  "../app/api/admin/payout-verifications/[partnerId]/documents/[kind]/route.ts"
 ]){
  const source=read(path);
  const auth=source.indexOf("const admin=await requireAdmin()");
  const handler=source.indexOf("try{",source.indexOf("export async function"));
  assert.ok(auth>=0&&handler>=0&&auth<handler,`admin auth must precede catch in ${path}`);
 }
});

test("KYC rejection resident ID filter handles hyphenated and unhyphenated numbers",()=>{
 const source=read("../app/api/admin/payout-verifications/[partnerId]/review/route.ts");
 const pattern=source.match(/decision==="REJECTED"&&\/(.*?)\/\.test\(reason\.normalize\("NFKC"\)\)/);
 assert.ok(pattern,"review route must check rejection reason with a regular expression");
 const residentId=new RegExp(pattern[1]);
 for(const value of ["900101-1234567","9001011234567","900101 - 1234567","확인: 900101–1234567","900101‑1234567","900101−1234567","900101—1234567"]){
  assert.ok(residentId.test(value.normalize("NFKC")),`must reject ${value}`);
 }
 for(const value of ["주민등록번호 뒷자리를 가려 주세요","서류를 다시 제출해 주세요","900101-*******"]){
  assert.equal(residentId.test(value),false,`must permit ${value}`);
 }
});

test("KYC rejection reason normalizes fullwidth resident numbers",()=>{
 const source=read("../app/api/admin/payout-verifications/[partnerId]/review/route.ts");
 assert.match(source,/reason\.normalize\("NFKC"\)/);
 const pattern=source.match(/decision==="REJECTED"&&\/(.*?)\/\.test\(reason\.normalize\("NFKC"\)\)/);
 assert.ok(pattern);
 const residentId=new RegExp(pattern[1]);
 assert.ok(residentId.test("９００１０１－１２３４５６７".normalize("NFKC")));
});

test("KYC PNG uploads reject oversized image dimensions before storage",()=>{
 const source=read("../app/api/partner/payout-verification/route.ts");
 const guard=source.indexOf("width*height>25000000");
 const upload=source.indexOf("const bankBlob=await put(");
 assert.ok(guard>0 && upload>guard);
 assert.ok(source.includes("view.getUint32(16),height=view.getUint32(20)"));
 assert.ok(source.includes("width>10000||height>10000"));
});

test("KYC PNG header rejects malformed IHDR and unsupported encoding",()=>{
 const source=read("../app/api/partner/payout-verification/route.ts");
 assert.ok(source.includes("view.getUint32(8)!==13"));
 assert.ok(source.includes("bytes.length<45"));
 assert.ok(source.includes("allowedDepths[color]?.includes(depth)"));
 assert.ok(source.includes("bytes[26]!==0||bytes[27]!==0||bytes[28]>1"));
});

test("KYC PDF upload checks a terminal EOF marker before private storage",()=>{
 const source=read("../app/api/partner/payout-verification/route.ts");
 const guard=source.indexOf("Reject truncated PDFs lacking a terminal EOF marker");
 const upload=source.indexOf("const bankBlob=await put(");
 assert.ok(guard>0&&upload>guard);
 assert.ok(source.includes("bytes.length-1024"));
 assert.ok(source.includes("%%EOF"));
 assert.ok(source.includes(String.raw`/%%EOF(?:\r?\n|\r|[ \t])*$/i`));
 const eof=/%%EOF(?:\r?\n|\r|[ \t])*$/i;
 assert.equal(eof.test("%PDF-1.7\n%%EOF\n"),true);
 assert.equal(eof.test("%PDF-1.7\ntruncated"),false);
 assert.equal(eof.test("%PDF-1.7\n%%EOF\ntrailing payload"),false);
});

test("KYC JPEG upload requires a bounded frame header",()=>{
 const source=read("../app/api/partner/payout-verification/route.ts");
 const guard=source.indexOf("let offset=2,validFrame=false");
 const upload=source.indexOf("const bankBlob=await put(");
 assert.ok(guard>0&&upload>guard);
 assert.ok(source.includes("if(validFrame&&validScan)return {ext:\"jpg\",mime:\"image/jpeg\"}"));
 assert.ok(source.includes("width*height>25000000"));
 assert.ok(source.includes("if(length<2||offset+length>bytes.length)break"));
});

test("KYC JPEG scan segment is required before storing documents",()=>{
 const source=read("../app/api/partner/payout-verification/route.ts");
 assert.ok(source.includes("validFrame=false,validScan=false"));
 assert.ok(source.includes("marker===0xda"));
 assert.ok(source.includes("validScan=true"));
 assert.ok(source.includes("if(validFrame&&validScan)return"));
});

test("KYC JPEG frame requires a valid component count and exact segment length",()=>{
 const source=read("../app/api/partner/payout-verification/route.ts");
 assert.ok(source.includes("const components=bytes[offset+7]"));
 assert.ok(source.includes("components<1||components>4||length!==8+3*components"));
 assert.ok(source.indexOf("components<1||components>4")<source.indexOf("if(validFrame&&validScan)return"));
});

test("KYC PNG checks IHDR CRC before accepting dimensions",()=>{
 const source=read("../app/api/partner/payout-verification/route.ts");
 assert.ok(source.includes("for(let i=12;i<29;i++)"));
 assert.ok(source.includes("0xedb88320"));
 assert.ok(source.includes("view.getUint32(29)"));
 assert.ok(source.indexOf("view.getUint32(29)")<source.indexOf("const width=view.getUint32(16)"));
});

test("KYC file detector accepts valid PNG and rejects corrupt IHDR using real bytes",async()=>{
 const ts=await import("typescript");
 const source=read("../app/api/partner/payout-verification/route.ts");
 const start=source.indexOf("function detect(bytes:Uint8Array){");
 const end=source.indexOf("export async function POST(",start);
 assert.ok(start>=0&&end>start);
 const extracted=source.slice(start,end)+"\nexport {detect};";
 const compiled=ts.transpileModule(extracted,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const {detect}=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
 const bytes=Buffer.alloc(57);
 Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes,0);
 bytes.writeUInt32BE(13,8);
 bytes.write("IHDR",12,"ascii");
 bytes.writeUInt32BE(1,16);
 bytes.writeUInt32BE(1,20);
 bytes[24]=8;bytes[25]=2;
 let crc=0xffffffff;
 for(let i=12;i<29;i++){
  crc^=bytes[i];
  for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
 }
 bytes.writeUInt32BE((crc^0xffffffff)>>>0,29);
 // Synthetic zero-length IDAT chunk: sufficient for structure-only detector tests,
 // not a decodable image. Full image decoding remains a separate requirement.
 bytes.writeUInt32BE(0,33);
 bytes.write("IDAT",37,"ascii");
 let idatCrc=0xffffffff;
 for(let i=37;i<41;i++){
  idatCrc^=bytes[i];
  for(let j=0;j<8;j++)idatCrc=(idatCrc>>>1)^((idatCrc&1)?0xedb88320:0);
 }
 bytes.writeUInt32BE((idatCrc^0xffffffff)>>>0,41);
 Buffer.from([0,0,0,0,73,69,78,68,174,66,96,130]).copy(bytes,45);
 const missingIdat=Buffer.concat([bytes.subarray(0,33),bytes.subarray(45)]);
 assert.equal(detect(missingIdat),null,"PNG without IDAT must be rejected");
 assert.deepEqual(detect(bytes),{ext:"png",mime:"image/png"});
 const badIendLength=Buffer.from(bytes);
 badIendLength.writeUInt32BE(1,badIendLength.length-12);
 assert.equal(detect(badIendLength),null,"IEND chunk must declare zero data length");
 const oversizedChunk=Buffer.concat([
  bytes.subarray(0,33),
  Buffer.from([0xff,0xff,0xff,0xff,73,68,65,84,0,0,0,0]),
  bytes.subarray(33)
 ]);
 assert.equal(detect(oversizedChunk),null,"PNG chunk cannot extend past terminal IEND");
 const invalidChunkType=Buffer.concat([
  bytes.subarray(0,33),
  Buffer.from([0,0,0,0,49,68,65,84,0,0,0,0]),
  bytes.subarray(33)
 ]);
 assert.equal(detect(invalidChunkType),null,"PNG chunk type must use ASCII letters");
 const repeatedHeader=Buffer.concat([
  bytes.subarray(0,33),
  Buffer.from([0,0,0,0,73,72,68,82,0,0,0,0]),
  bytes.subarray(33)
 ]);
 assert.equal(detect(repeatedHeader),null,"PNG cannot repeat IHDR chunk");
 const ancillaryChunk=Buffer.from([0,0,0,1,116,69,88,116,65,0,0,0,0]);
 let ancillaryCrc=0xffffffff;
 for(let i=4;i<9;i++){
  ancillaryCrc^=ancillaryChunk[i];
  for(let j=0;j<8;j++)ancillaryCrc=(ancillaryCrc>>>1)^((ancillaryCrc&1)?0xedb88320:0);
 }
 ancillaryChunk.writeUInt32BE((ancillaryCrc^0xffffffff)>>>0,9);
 const validAncillary=Buffer.concat([bytes.subarray(0,33),ancillaryChunk,bytes.subarray(33)]);
 assert.deepEqual(detect(validAncillary),{ext:"png",mime:"image/png"},"valid intermediate PNG CRC must be accepted");
 const corruptAncillary=Buffer.from(validAncillary);
 corruptAncillary[41]^=1;
 assert.equal(detect(corruptAncillary),null,"corrupt intermediate PNG CRC must be rejected");
 const noncontiguousIdat=Buffer.concat([
  bytes.subarray(0,45),ancillaryChunk,bytes.subarray(33)
 ]);
 assert.equal(detect(noncontiguousIdat),null,"IDAT chunks must be contiguous");
 const plte=Buffer.from([0,0,0,3,80,76,84,69,255,0,0,0,0,0,0]);
 let plteCrc=0xffffffff;
 for(let i=4;i<11;i++){
  plteCrc^=plte[i];
  for(let j=0;j<8;j++)plteCrc=(plteCrc>>>1)^((plteCrc&1)?0xedb88320:0);
 }
 plte.writeUInt32BE((plteCrc^0xffffffff)>>>0,11);
 const validPlte=Buffer.concat([bytes.subarray(0,33),plte,bytes.subarray(33)]);
 assert.deepEqual(detect(validPlte),{ext:"png",mime:"image/png"},"PLTE before IDAT is structurally permitted");
 const latePlte=Buffer.concat([bytes.subarray(0,45),plte,bytes.subarray(45)]);
 assert.equal(detect(latePlte),null,"PLTE after IDAT must be rejected");
 const duplicatePlte=Buffer.concat([bytes.subarray(0,33),plte,plte,bytes.subarray(33)]);
 assert.equal(detect(duplicatePlte),null,"duplicate PLTE must be rejected");
 const unknownCritical=Buffer.from(ancillaryChunk);
 unknownCritical[4]=84; // tEXt -> TEXt: unrecognized critical chunk
 let criticalCrc=0xffffffff;
 for(let i=4;i<9;i++){
  criticalCrc^=unknownCritical[i];
  for(let j=0;j<8;j++)criticalCrc=(criticalCrc>>>1)^((criticalCrc&1)?0xedb88320:0);
 }
 unknownCritical.writeUInt32BE((criticalCrc^0xffffffff)>>>0,9);
 const badCriticalPng=Buffer.concat([bytes.subarray(0,33),unknownCritical,bytes.subarray(33)]);
 assert.equal(detect(badCriticalPng),null,"unknown critical PNG chunk must be rejected even with valid CRC");
 const corrupt=Buffer.from(bytes);corrupt[20]^=1;
 assert.equal(detect(corrupt),null);
 const huge=Buffer.from(bytes);huge.writeUInt32BE(10001,16);
 let hugeCrc=0xffffffff;
 for(let i=12;i<29;i++){
  hugeCrc^=huge[i];
  for(let j=0;j<8;j++)hugeCrc=(hugeCrc>>>1)^((hugeCrc&1)?0xedb88320:0);
 }
 huge.writeUInt32BE((hugeCrc^0xffffffff)>>>0,29);
 assert.equal(detect(huge),null,"valid CRC must not bypass image width limit");
 const badDepth=Buffer.from(bytes);badDepth[24]=7;
 let depthCrc=0xffffffff;
 for(let i=12;i<29;i++){
  depthCrc^=badDepth[i];
  for(let j=0;j<8;j++)depthCrc=(depthCrc>>>1)^((depthCrc&1)?0xedb88320:0);
 }
 badDepth.writeUInt32BE((depthCrc^0xffffffff)>>>0,29);
 assert.equal(detect(badDepth),null,"valid CRC must not bypass bit-depth validation");
 const tooManyPixels=Buffer.from(bytes);
 tooManyPixels.writeUInt32BE(6000,16);
 tooManyPixels.writeUInt32BE(6000,20);
 let pixelCrc=0xffffffff;
 for(let i=12;i<29;i++){
  pixelCrc^=tooManyPixels[i];
  for(let j=0;j<8;j++)pixelCrc=(pixelCrc>>>1)^((pixelCrc&1)?0xedb88320:0);
 }
 tooManyPixels.writeUInt32BE((pixelCrc^0xffffffff)>>>0,29);
 assert.equal(detect(tooManyPixels),null,"valid CRC must not bypass total pixel limit");
 const zeroWidth=Buffer.from(bytes);
 zeroWidth.writeUInt32BE(0,16);
 let zeroCrc=0xffffffff;
 for(let i=12;i<29;i++){
  zeroCrc^=zeroWidth[i];
  for(let j=0;j<8;j++)zeroCrc=(zeroCrc>>>1)^((zeroCrc&1)?0xedb88320:0);
 }
 zeroWidth.writeUInt32BE((zeroCrc^0xffffffff)>>>0,29);
 assert.equal(detect(zeroWidth),null,"valid CRC must not bypass positive dimension check");
});

test("KYC detector checks actual PDF and JPEG byte fixtures",async()=>{
 const ts=await import("typescript");
 const source=read("../app/api/partner/payout-verification/route.ts");
 const start=source.indexOf("function detect(bytes:Uint8Array){");
 const end=source.indexOf("export async function POST(",start);
 assert.ok(start>=0&&end>start);
 const compiled=ts.transpileModule(source.slice(start,end)+"\nexport {detect};",{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const {detect}=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
 const pdf=Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n","latin1");
 assert.deepEqual(detect(pdf),{ext:"pdf",mime:"application/pdf"});
 assert.equal(detect(Buffer.from("%PDF-1.7\n1 0 obj\ntruncated")),null);
 assert.equal(detect(Buffer.from("%PDF-1.7\n%%EOF\nEXTRA")),null);
 const jpeg=Buffer.from([
  0xff,0xd8,
  0xff,0xc0,0x00,0x0b,0x08,0x00,0x01,0x00,0x01,0x01,0x01,0x11,0x00,
  0xff,0xda,0x00,0x08,0x01,0x01,0x00,0x00,0x3f,0x00,
  0x00,0xff,0xd9
 ]);
 assert.deepEqual(detect(jpeg),{ext:"jpg",mime:"image/jpeg"});
 const noScan=Buffer.concat([jpeg.subarray(0,15),Buffer.from([0xff,0xd9])]);
 assert.equal(detect(noScan),null);
 const malformed=Buffer.from(jpeg);malformed[6]=0x09;
 assert.equal(detect(malformed),null);
 const badScanComponents=Buffer.from(jpeg);
 badScanComponents[19]=2;
 assert.equal(detect(badScanComponents),null,"SOS component count must match its segment length");
 const zeroScanComponents=Buffer.from(jpeg);
 zeroScanComponents[19]=0;
 assert.equal(detect(zeroScanComponents),null,"SOS must declare at least one component");
 const badScanLength=Buffer.from(jpeg);
 badScanLength[18]=7;
 assert.equal(detect(badScanLength),null,"SOS length must match its component count");
 const scanExceedsFrame=Buffer.from([
  0xff,0xd8,
  0xff,0xc0,0x00,0x0b,0x08,0x00,0x01,0x00,0x01,0x01,0x01,0x11,0x00,
  0xff,0xda,0x00,0x0a,0x02,0x01,0x00,0x02,0x00,0x00,0x3f,0x00,
  0x00,0xff,0xd9
 ]);
 assert.equal(detect(scanExceedsFrame),null,"scan components cannot exceed frame components");
 const unknownScanId=Buffer.from(jpeg);
 unknownScanId[20]=2;
 assert.equal(detect(unknownScanId),null,"scan component ID must exist in frame");
 const duplicateFrameIds=Buffer.from([
  0xff,0xd8,
  0xff,0xc0,0x00,0x0e,0x08,0x00,0x01,0x00,0x01,0x02,0x01,0x11,0x00,0x01,0x11,0x00,
  0xff,0xda,0x00,0x08,0x01,0x01,0x00,0x00,0x3f,0x00,
  0x00,0xff,0xd9
 ]);
 assert.equal(detect(duplicateFrameIds),null,"frame component IDs must be unique");
 const duplicateFrame=Buffer.concat([
  jpeg.subarray(0,15),
  jpeg.subarray(2,15),
  jpeg.subarray(15)
 ]);
 assert.equal(detect(duplicateFrame),null,"duplicate JPEG SOF must be rejected");
});
