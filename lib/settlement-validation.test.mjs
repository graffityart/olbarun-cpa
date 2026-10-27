import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const source = readFileSync(new URL("./settlement-validation.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(js, { exports });
const { isValidSettlementAmount, sumSettlementItems, settlementAmountsMatch, canReviewSettlement, isValidSettlementReviewRequest, canStartSettlement, isSettlementPending, settlementAuditMatches, settlementAuditIssue } = exports;

test("accepts valid integer amounts and rejects invalid amounts", () => {
  for (const value of [1, 1000, 2147483647]) assert.equal(isValidSettlementAmount(value), true);
  for (const value of [0, -1, 1.5, NaN, Infinity, "100", 2147483648]) assert.equal(isValidSettlementAmount(value), false);
});

test("sums valid earnings without number precision loss", () => {
  assert.equal(sumSettlementItems([100, 200, 300]), 600n);
  assert.equal(sumSettlementItems([2147483647]), 2147483647n);
  assert.equal(sumSettlementItems([]), null);
  assert.equal(sumSettlementItems([2147483647, 1]), null);
  assert.equal(sumSettlementItems([100, -1]), null);
});

test("requires exact requested, paid and deduction amounts", () => {
  assert.equal(settlementAmountsMatch([100, 200], 300, 300, 0), true);
  assert.equal(settlementAmountsMatch([100, 200], 300, 270, 30), true);
  assert.equal(settlementAmountsMatch([100, 200], 301, 300, 0), false);
  assert.equal(settlementAmountsMatch([100, 200], 300, 301, 0), false);
  assert.equal(settlementAmountsMatch([100, 200], 300, 200, -1), false);
  assert.equal(settlementAmountsMatch([], 300, 300, 0), false);
});

test("allows only expected settlement state transitions", () => {
  const statuses = ["REQUESTED", "APPROVED", "PAID", "REJECTED"];
  const actions = ["APPROVE", "PAID", "REJECT"];
  for (const status of statuses) for (const action of actions) {
    const expected = status === "REQUESTED" && (action === "APPROVE" || action === "REJECT") ||
      status === "APPROVED" && action === "PAID";
    assert.equal(canReviewSettlement(status, action), expected, `${status} / ${action}`);
  }
});

test("requires explicit confirmation only for paid settlement requests", () => {
  for (const action of ["APPROVE", "REJECT"]) assert.equal(isValidSettlementReviewRequest({action}), true);
  assert.equal(isValidSettlementReviewRequest({action:"PAID",transferConfirmed:true}), true);
  for (const value of [
    null, [], {}, {action:"UNKNOWN"}, {action:"PAID"}, {action:"PAID",transferConfirmed:false},
    {action:"PAID",transferConfirmed:"true"}, {action:"PAID",transferConfirmed:1},
  ]) assert.equal(isValidSettlementReviewRequest(value), false);
});

test("blocks a new settlement while another request is pending", () => {
  assert.equal(canStartSettlement([]), true);
  assert.equal(canStartSettlement(["PAID", "REJECTED"]), true);
  assert.equal(canStartSettlement(["REQUESTED"]), false);
  assert.equal(canStartSettlement(["APPROVED"]), false);
  assert.equal(canStartSettlement(["PAID", "APPROVED"]), false);
  assert.equal(isSettlementPending("REQUESTED"), true);
  assert.equal(isSettlementPending("APPROVED"), true);
  assert.equal(isSettlementPending("PAID"), false);
  assert.equal(isSettlementPending("REJECTED"), false);
});

test("completed settlements allow a new request", () => {
  assert.equal(canStartSettlement(["PAID", "REJECTED"]), true);
});

test("rejects fractional, overflowing and inconsistent payout breakdowns", () => {
  assert.equal(settlementAmountsMatch([100, 200], 300, 299, 1), true);
  assert.equal(settlementAmountsMatch([100, 200], 300, 299.5, 0.5), false);
  assert.equal(settlementAmountsMatch([100, 200], 300, 300, 1), false);
  assert.equal(settlementAmountsMatch([2147483647, 1], 2147483647, 2147483647, 0), false);
});

test("prevents repeating completed settlement actions", () => {
  for (const status of ["PAID", "REJECTED"]) {
    for (const action of ["APPROVE", "PAID", "REJECT"]) {
      assert.equal(canReviewSettlement(status, action), false);
    }
  }
});

test("rejects invalid review actions regardless of confirmation flag", () => {
  for (const action of ["", "PAY", "DELETE", null, 1]) {
    assert.equal(isValidSettlementReviewRequest({action,transferConfirmed:true}), false);
  }
});

test("settlement sums reject nonfinite and noninteger earning values", () => {
  for (const value of [NaN, Infinity, -Infinity, 1.5, 0, -1, 2147483648]) {
    assert.equal(sumSettlementItems([100, value]), null);
  }
});

test("a request cannot be approved twice or paid before approval", () => {
  assert.equal(canReviewSettlement("REQUESTED", "PAID"), false);
  assert.equal(canReviewSettlement("REQUESTED", "APPROVE"), true);
  assert.equal(canReviewSettlement("APPROVED", "APPROVE"), false);
  assert.equal(canReviewSettlement("APPROVED", "REJECT"), false);
  assert.equal(canReviewSettlement("APPROVED", "PAID"), true);
  assert.equal(canReviewSettlement("PAID", "PAID"), false);
});

test("amount validation rejects unsafe integers and empty earnings", () => {
  assert.equal(isValidSettlementAmount(Number.MAX_SAFE_INTEGER), false);
  assert.equal(sumSettlementItems([Number.MAX_SAFE_INTEGER]), null);
  assert.equal(sumSettlementItems([]), null);
  assert.equal(settlementAmountsMatch([100], 100, 0, 100), false);
});

test("settlement audit history must match its current status", () => {
 assert.equal(settlementAuditMatches("REQUESTED",[]),true);
 assert.equal(settlementAuditMatches("REQUESTED",["SETTLEMENT_REQUEST"]),true);
 assert.equal(settlementAuditMatches("REQUESTED",["SETTLEMENT_APPROVE"]),false);
 assert.equal(settlementAuditMatches("APPROVED",["SETTLEMENT_APPROVE"]),true);
 assert.equal(settlementAuditMatches("APPROVED",[]),false);
 assert.equal(settlementAuditMatches("APPROVED",["SETTLEMENT_REJECT"]),false);
 assert.equal(settlementAuditMatches("PAID",["SETTLEMENT_APPROVE","SETTLEMENT_PAID"]),true);
 assert.equal(settlementAuditMatches("PAID",["SETTLEMENT_APPROVE"]),false);
 assert.equal(settlementAuditMatches("REJECTED",["SETTLEMENT_REJECT"]),true);
 assert.equal(settlementAuditMatches("REJECTED",[]),false);
});

test("rejects duplicate, contradictory, or out-of-order settlement review audits",()=>{
 assert.equal(settlementAuditMatches("APPROVED",["SETTLEMENT_APPROVE","SETTLEMENT_APPROVE"]),false);
 assert.equal(settlementAuditMatches("APPROVED",["SETTLEMENT_APPROVE","SETTLEMENT_PAID"]),false);
 assert.equal(settlementAuditMatches("PAID",["SETTLEMENT_PAID","SETTLEMENT_APPROVE"]),false);
 assert.equal(settlementAuditMatches("PAID",["SETTLEMENT_APPROVE","SETTLEMENT_PAID","SETTLEMENT_PAID"]),false);
 assert.equal(settlementAuditMatches("PAID",["SETTLEMENT_APPROVE","SETTLEMENT_REJECT","SETTLEMENT_PAID"]),false);
 assert.equal(settlementAuditMatches("REJECTED",["SETTLEMENT_REJECT","SETTLEMENT_REJECT"]),false);
 assert.equal(settlementAuditMatches("REJECTED",["SETTLEMENT_APPROVE","SETTLEMENT_REJECT"]),false);
 assert.equal(settlementAuditMatches("PAID",["SETTLEMENT_REQUEST","SETTLEMENT_APPROVE","SETTLEMENT_PAID"]),true);
});

test("audit issue explains why admin settlement processing is blocked", () => {
 assert.equal(settlementAuditIssue("REQUESTED",[]),null);
 assert.equal(settlementAuditIssue("APPROVED",["SETTLEMENT_APPROVE"]),null);
 assert.match(settlementAuditIssue("APPROVED",[]),/승인 처리 기록/);
 assert.match(settlementAuditIssue("REQUESTED",["SETTLEMENT_APPROVE"]),/검토대기/);
 assert.match(settlementAuditIssue("PAID",["SETTLEMENT_PAID"]),/승인 기록/);
 assert.match(settlementAuditIssue("PAID",["SETTLEMENT_PAID","SETTLEMENT_APPROVE"]),/먼저/);
 assert.match(settlementAuditIssue("PAID",["SETTLEMENT_APPROVE","SETTLEMENT_PAID","SETTLEMENT_PAID"]),/중복/);
 assert.match(settlementAuditIssue("REJECTED",["SETTLEMENT_APPROVE","SETTLEMENT_REJECT"]),/충돌/);
 assert.match(settlementAuditIssue("REJECTED",[]),/반려 처리 기록/);
});

test("admin SQL audit rules stay aligned with review API validation", () => {
 const adminSql=readFileSync(new URL("./settlement-audit-sql.ts",import.meta.url),"utf8");
 const reviewApi=readFileSync(new URL("../app/api/admin/settlements/[id]/review/route.ts",import.meta.url),"utf8");
 const listPage=readFileSync(new URL("../app/admin/settlements/page.tsx",import.meta.url),"utf8");
 for(const [status,expected] of Object.entries({
  REQUESTED:"ARRAY[]::text[]",
  APPROVED:"ARRAY['SETTLEMENT_APPROVE']::text[]",
  PAID:"ARRAY['SETTLEMENT_APPROVE','SETTLEMENT_PAID']::text[]",
  REJECTED:"ARRAY['SETTLEMENT_REJECT']::text[]",
 })){
  assert.ok(adminSql.includes("status}='"+status+"' then"),"SQL includes "+status);
  assert.ok(adminSql.includes("="+expected),"SQL expected sequence "+status);
 }
 assert.match(adminSql,/order by \$\{auditLogs\.createdAt\}, \$\{auditLogs\.id\}/);
 assert.match(reviewApi,/settlementAuditMatches\(row\.settlement\.status/);
 assert.match(reviewApi,/throw new Error\("SETTLEMENT_AUDIT_MISMATCH"\)/);
 assert.match(listPage,/const missingAudit=settlementAuditAnomaly/);
 assert.match(listPage,/const auditSequence=settlementAuditSequence/);
 for(const [status,actions] of [
  ["REQUESTED",[]],
  ["APPROVED",["SETTLEMENT_APPROVE"]],
  ["PAID",["SETTLEMENT_APPROVE","SETTLEMENT_PAID"]],
  ["REJECTED",["SETTLEMENT_REJECT"]],
 ]){
  assert.equal(settlementAuditMatches(status,actions),true,status+" valid");
  assert.equal(settlementAuditMatches(status,[...actions,"SETTLEMENT_REJECT"]),false,status+" extra reject");
 }
});

test("unknown settlement statuses fail closed instead of inheriting rejected audit rules", () => {
 const invalidStatuses = ["", "CANCELLED", "PENDING", "paid", "REJECTED_ARCHIVED"];
 for (const status of invalidStatuses) {
  assert.equal(settlementAuditMatches(status,["SETTLEMENT_REJECT"]),false,status);
  assert.equal(settlementAuditMatches(status,[]),false,status);
  assert.match(settlementAuditIssue(status,["SETTLEMENT_REJECT"]),/알 수 없는 정산 상태/,status);
 }
});

test("settlement payment details fail closed when sensitive-view audit cannot be recorded", () => {
 const detail=readFileSync(new URL("../app/admin/settlements/[id]/page.tsx",import.meta.url),"utf8");
 const auditCall=detail.indexOf('await writeAudit({actorUserId:admin.id,action:"SETTLEMENT_PAYMENT_INFO_VIEW"');
 const failClosed=detail.indexOf('throw new Error("SETTLEMENT_PAYMENT_INFO_AUDIT_FAILED")');
 const render=detail.indexOf('return <DashboardShell');
 assert.ok(auditCall>=0,"sensitive information access is audited");
 assert.ok(failClosed>auditCall&&failClosed<render,"audit failure blocks rendering payment details");
 assert.match(detail,/catch\(auditError\)\{console\.error\("Settlement payment info view audit failed",auditError\);throw new Error/);
});

test("settlement detail error boundary explains safe retry without revealing account information",()=>{
 const boundary=readFileSync(new URL("../app/admin/settlements/[id]/error.tsx",import.meta.url),"utf8");
 assert.match(boundary,/"use client"/);
 assert.match(boundary,/onClick=\{reset\}/);
 assert.match(boundary,/href="\/admin\/settlements"/);
 assert.match(boundary,/보안을 위해 상세 정보를 표시하지 않았습니다/);
 assert.doesNotMatch(boundary,/error\.message|bankAccountSnapshot|accountNumber/);
});

test("all settlement review controls are disabled when audit verification fails",()=>{
 const component=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 for(const action of ["REJECT","APPROVE","PAID"]){
  const button=component.match(new RegExp('<button[^>]*onClick=\\{\\(\\)=>act\\("'+action+'"\\)\\}[^>]*>'));
  assert.ok(button,"button for "+action);
  assert.match(button[0],/disabled=\{[^}]*!auditVerified/,"audit lock for "+action);
 }
});

test("transfer confirmation is disabled when audit or amount verification fails",()=>{
 const component=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 const checkbox=component.match(/<input type="checkbox"[^>]+>/);
 assert.ok(checkbox,"transfer confirmation checkbox exists");
 assert.match(checkbox[0],/disabled=\{loading\|\|completed\|\|!amountVerified\|\|!auditVerified\}/);
 assert.match(checkbox[0],/checked=\{transferConfirmed\}/);
});

test("settlement status recovery verifies amounts and does not expose payment account details",()=>{
 const api=readFileSync(new URL("../app/api/admin/settlements/[id]/status/route.ts",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 assert.match(api,/settlementAmountsMatch\(items\.map\(item => item\.amount\)/);
 assert.match(api,/amountVerified \}, \{ headers:/);
 assert.doesNotMatch(api,/bankAccountSnapshot|accountNumber/);
 assert.match(ui,/latest\.amountVerified===false/);
});

test("settlement review and status recheck cannot overlap or double-submit",()=>{
 const ui=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 assert.match(ui,/const recheckInFlight=useRef\(false\)/);
 assert.match(ui,/if\(recheckInFlight\.current\|\|inFlight\.current\|\|loading\)return/);
 assert.match(ui,/recheckInFlight\.current=true;setRecheckLoading\(true\)/);
 assert.match(ui,/finally\{recheckInFlight\.current=false;setRecheckLoading\(false\)\}/);
 assert.match(ui,/if\(inFlight\.current\|\|recheckInFlight\.current\|\|completed\)return/);
 assert.match(ui,/if\(inFlight\.current\|\|recheckInFlight\.current\)return;inFlight\.current=true/);
});

test("status recheck locks stale settlement review controls and clears transfer confirmation",()=>{
 const ui=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 assert.match(ui,/latest\.status!==status\|\|latest\.auditVerified!==true\|\|latest\.amountVerified!==true/);
 assert.match(ui,/\{setCompleted\(true\);setTransferConfirmed\(false\);\}setMessage/);
 assert.match(ui,/if\(inFlight\.current\|\|recheckInFlight\.current\|\|completed\)return/);
});

test("failed settlement review recheck prioritizes integrity errors without requiring status changes",()=>{
 const ui=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 const start=ui.indexOf("if(check.ok){const latest=await check.json();");
 assert.ok(start>=0);
 const recovery=ui.slice(start,ui.indexOf("else if(check.status===401",start));
 const audit=recovery.indexOf("if(latest.auditVerified!==true)");
 const amount=recovery.indexOf("else if(latest.amountVerified!==true)");
 const changed=recovery.indexOf("else if(latest.status!==status)");
 assert.ok(audit>=0&&amount>audit&&changed>amount,"integrity checks run before state-change message");
 assert.match(recovery,/서버 재확인 결과 감사 기록 검증에 실패했습니다/);
 assert.match(recovery,/서버 재확인 결과 정산 검증에 실패했습니다/);
});

test("settlement review distinguishes explicit API rejection from uncertain network outcome",()=>{
 const ui=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 assert.match(ui,/let confirmedRejection=false;let reviewSubmitted=false;try\{const preflight=await fetch/);
 assert.match(ui,/if\(!res\.ok\|\|!data\?\.ok\)\{confirmedRejection=!res\.ok&&res\.status>=400&&res\.status<500;throw new Error/);
 assert.match(ui,/confirmedRejection\?"서버에서 정산 처리 요청을 거부했습니다\."/);
 assert.match(ui,/reviewSubmitted\?"요청 결과가 불확실합니다\."\:"처리 요청을 보내기 전에 검증이 중단되었습니다\."/);
 assert.match(ui,/setCompleted\(true\);try\{const check=await fetch/);
});

test("settlement review API error codes have administrator-facing Korean explanations",()=>{
 const api=readFileSync(new URL("../app/api/admin/settlements/[id]/review/route.ts",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 const codes=new Set([
  ...[...api.matchAll(/error:\s*"([A-Z][A-Z_]+)"/g)].map(match=>match[1]),
  ...[...api.matchAll(/throw new Error\("([A-Z][A-Z_]+)"\)/g)].map(match=>match[1]),
  ...[...api.matchAll(/"([A-Z][A-Z_]+)"/g)].map(match=>match[1]).filter(code=>code.endsWith("_MISMATCH")||code==="EARNING_STATUS_INVALID")
 ]);
 for(const code of codes){
  assert.match(ui,new RegExp("(?:^|[,\\{])"+code+':"[^"]*[가-힣][^"]*"'),"missing localized UI error: "+code);
 }
 assert.match(ui,/errors\[data\?\.error\]/);
});

test("settlement review preflight checks current status and integrity before mutation",()=>{
 const ui=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 const start=ui.indexOf("let confirmedRejection=false;let reviewSubmitted=false;try{");
 const preflight=ui.indexOf("const preflight=await fetch(",start);
 const verify=ui.indexOf("current.status!==status||current.auditVerified!==true||current.amountVerified!==true",preflight);
 const post=ui.indexOf('method:"POST"',preflight);
 assert.ok(start>=0&&preflight>start&&verify>preflight&&post>verify);
 assert.match(ui,/if\(!preflight\.ok\)throw new Error/);
 assert.match(ui,/if\(!current\?\.ok\|\|current\.status!==status\|\|current\.auditVerified!==true\|\|current\.amountVerified!==true\)throw new Error/);
});

test("settlement preflight failures are not described as submitted requests",()=>{
 const ui=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 const preflight=ui.indexOf("const preflight=await fetch(");
 const submitted=ui.indexOf("reviewSubmitted=true;const res=await fetch(",preflight);
 const mutation=ui.indexOf('method:"POST"',submitted);
 assert.ok(preflight>=0&&submitted>preflight&&mutation>submitted);
 assert.match(ui,/reviewSubmitted\?"요청 결과가 불확실합니다\."\:"처리 요청을 보내기 전에 검증이 중단되었습니다\."/);
});

test("settlement review treats explicit authorization and rate-limit responses as rejected",()=>{
 const ui=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 assert.match(ui,/if\(res\.status===401\|\|res\.status===403\)\{confirmedRejection=true;throw new Error/);
 assert.match(ui,/if\(res\.status===429\)\{confirmedRejection=true;throw new Error/);
 assert.match(ui,/confirmedRejection\?"서버에서 정산 처리 요청을 거부했습니다\."/);
});

test("settlement review distinguishes HTTP rejection from malformed successful response",()=>{
 const ui=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 assert.match(ui,/if\(!res\.ok\|\|!data\?\.ok\)\{confirmedRejection=!res\.ok&&res\.status>=400&&res\.status<500;throw new Error/);
 assert.match(ui,/errors\[data\?\.error\]/);
});

test("settlement review rejects null preflight response safely",()=>{
 const ui=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 assert.match(ui,/if\(!current\?\.ok\|\|current\.status!==status/);
 assert.match(ui,/reviewSubmitted=true;const res=await fetch/);
});

test("settlement status recheck and recovery handle null JSON safely",()=>{
 const ui=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 assert.match(ui,/if\(latest\?\.ok!==true\|\|typeof latest\.status!=="string"/);
 assert.match(ui,/if\(latest\?\.ok===true&&typeof latest\.status==="string"/);
});

test("settlement recovery requires typed status and integrity fields",()=>{
 const ui=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 assert.match(ui,/typeof latest\.auditVerified!=="boolean"\|\|typeof latest\.amountVerified!=="boolean"/);
 assert.match(ui,/typeof latest\.auditVerified==="boolean"&&typeof latest\.amountVerified==="boolean"/);
});

test("settlement approval, payment, and rejection preserve earning state transitions",()=>{
 const source=readFileSync(new URL("../app/api/admin/settlements/[id]/review/route.ts",import.meta.url),"utf8");
 const approve=source.indexOf('if(action==="APPROVE")');
 const paid=source.indexOf('else if(action==="PAID")',approve);
 const reject=source.indexOf('}else{if(row.settlement.status!=="REQUESTED")',paid);
 const audit=source.indexOf("tx.insert(auditLogs)",reject);
 assert.ok(approve>=0&&paid>approve&&reject>paid&&audit>reject);
 const approveBranch=source.slice(approve,paid);
 const paidBranch=source.slice(paid,reject);
 const rejectBranch=source.slice(reject,audit);
 assert.match(approveBranch,/status:"APPROVED"/);
 assert.doesNotMatch(approveBranch,/set\(\{status:"PAID"\}\)/);
 assert.match(paidBranch,/status:"PAID"/);
 assert.match(paidBranch,/eq\(earnings\.status,"HOLD"\)/);
 assert.match(paidBranch,/changed\.length!==1/);
 assert.match(rejectBranch,/status:"REJECTED"/);
 assert.match(rejectBranch,/set\(\{status:"AVAILABLE"\}\)/);
 assert.match(rejectBranch,/eq\(earnings\.status,"HOLD"\)/);
});

test("admin settlement detail displays the same verified amount result used for review",()=>{
 const ui=readFileSync(new URL("../app/admin/settlements/[id]/page.tsx",import.meta.url),"utf8");
 assert.match(ui,/const amountVerified=Number\(amounts\.count\)>0&&Number\(amounts\.count\)===Number\(amounts\.uniqueCount\)&&Number\(amounts\.total\)===s\.requestedAmount/);
 assert.match(ui,/<strong>금액 검증<\/strong><br\/>\{amountVerified\?"일치"/);
 assert.match(ui,/amountVerified=\{amountVerified\}/);
});

test("admin settlement review warns about invalid amounts before review controls",()=>{
 const ui=readFileSync(new URL("../app/admin/settlements/[id]/page.tsx",import.meta.url),"utf8");
 const warning=ui.indexOf("!amountVerified&&<p role=\"alert\"");
 const review=ui.indexOf("<SettlementReview id={s.id}",warning);
 assert.ok(warning>=0&&review>warning);
 assert.match(ui,/amountVerified=\{amountVerified\}/);
 assert.match(ui,/auditVerified=\{auditVerified\}/);
});

test("partner settlement confirmation requires a valid receipt code and blocks ambiguous retries",()=>{
 const ui=readFileSync(new URL("../components/SettlementRequest.tsx",import.meta.url),"utf8");
 const receipt=ui.indexOf('typeof data.settlementCode !== "string"');
 const success=ui.indexOf("accepted = true; setCompleted(true)",receipt);
 assert.ok(receipt>=0&&success>receipt);
 assert.match(ui,/SET-\[0-9A-F\]\{12\}/);
 assert.match(ui,/setOutcomeUnknown\(true\)/);
 assert.match(ui,/inFlight\.current \|\| completed \|\| outcomeUnknown \|\| available <= 0 \|\| pending/);
});

test("aborted partner payout requests remain blocked until outcome review",()=>{
 const ui=readFileSync(new URL("../components/SettlementRequest.tsx",import.meta.url),"utf8");
 assert.match(ui,/error\.name === "AbortError"/);
 assert.match(ui,/setOutcomeUnknown\(true\)/);
 assert.match(ui,/disabled=\{loading\|\|completed\|\|outcomeUnknown\|\|available<=0\|\|pending\}/);
});

test("partner payout receipt requires HTTP created status before success",()=>{
 const ui=readFileSync(new URL("../components/SettlementRequest.tsx",import.meta.url),"utf8");
 const status=ui.indexOf("if (res.status !== 201)");
 const receipt=ui.indexOf('typeof data.settlementCode !== "string"',status);
 const success=ui.indexOf("accepted = true; setCompleted(true)",receipt);
 assert.ok(status>=0&&receipt>status&&success>receipt);
 assert.match(ui.slice(status,receipt),/setOutcomeUnknown\(true\)/);
});

test("partner settlement server errors never enable blind retry",()=>{
 const ui=readFileSync(new URL("../components/SettlementRequest.tsx",import.meta.url),"utf8");
 assert.match(ui,/res\.status >= 500/);
 assert.match(ui,/res\.ok \|\| res\.status >= 500/);
 assert.match(ui,/typeof data\.error !== "string"/);
 assert.match(ui,/setOutcomeUnknown\(true\)/);
});

test("partner settlement history lookup is authenticated, scoped and excludes bank details",()=>{
 const api=readFileSync(new URL("../app/api/partner/settlements/route.ts",import.meta.url),"utf8");
 const get=api.slice(api.indexOf("export async function GET()"));
 assert.match(get,/user\.role!=="PARTNER"/);
 assert.match(get,/eq\(settlements\.partnerId,user\.partnerId\)/);
 assert.match(get,/limit\(10\)/);
 assert.match(get,/Cache-Control":"no-store"/);
 assert.doesNotMatch(get,/bankAccountSnapshot/);
 assert.match(get,/settlementCode:settlements\.settlementCode/);
});

test("uncertain partner settlement exposes read-only history lookup without auto-retrying POST",()=>{
 const ui=readFileSync(new URL("../components/SettlementRequest.tsx",import.meta.url),"utf8");
 const start=ui.indexOf("async function checkRecentRequests()");
 const end=ui.indexOf("async function submit(",start);
 const lookup=ui.slice(start,end);
 assert.ok(start>=0&&end>start);
 assert.match(lookup,/fetch\("\/api\/partner\/settlements", \{cache:"no-store"\}\)/);
 assert.doesNotMatch(lookup,/method:"POST"/);
 assert.match(lookup,/Array\.isArray\(data\.settlements\)/);
 assert.match(lookup,/router\.refresh\(\)/);
 assert.match(ui,/disabled=\{historyLoading\} onClick=\{checkRecentRequests\}/);
});

test("partner settlement history comparison ignores malformed records",()=>{
 const ui=readFileSync(new URL("../components/SettlementRequest.tsx",import.meta.url),"utf8");
 assert.match(ui,/row !== null && typeof row === "object"/);
 assert.match(ui,/Number\.isSafeInteger\(row\.requestedAmount\)/);
 assert.match(ui,/\["REQUESTED","APPROVED","PAID","REJECTED"\]\.includes\(row\.status\)/);
 assert.match(ui,/row\.requestedAmount === available/);
});

test("uncertain payout recovery lists matching receipt codes and translated statuses",()=>{
 const ui=readFileSync(new URL("../components/SettlementRequest.tsx",import.meta.url),"utf8");
 assert.match(ui,/setHistoryMatches\(matches\)/);
 assert.match(ui,/historyMatches\.map\(row=>/);
 assert.match(ui,/key=\{row\.settlementCode\}/);
 assert.match(ui,/aria-label="동일 금액 정산 신청 내역"/);
 assert.match(ui,/PAID:"지급 완료"/);
});

test("admin settlement list applies duplicate earning validation across filter, priority and both layouts",()=>{
 const ui=readFileSync(new URL("../app/admin/settlements/page.tsx",import.meta.url),"utf8");
 assert.match(ui,/count\(distinct earning_id\)/);
 assert.match(ui,/exists \(select 1 from settlement_items si where si\.settlement_id=\$\{settlements\.id\} group by si\.earning_id having count\(\*\) > 1\)/);
 assert.match(ui,/Number\(r\.itemCount\)!==Number\(r\.uniqueItemCount\)/);
 assert.match(ui,/Number\(r\.itemCount\)===Number\(r\.uniqueItemCount\)&&Number\(r\.itemTotal\)===r\.requested/);
 assert.match(ui,/\?"수익 중복 연결":/);
});

test("uncertain admin settlement review remains locked if status recheck fails",()=>{
 const ui=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 const errorHandler=ui.slice(ui.indexOf('}catch(e){setMessage(`${confirmedRejection'),ui.indexOf('}finally{inFlight.current=false;setLoading(false)}'));
 assert.match(errorHandler,/setCompleted\(true\)/);
 assert.match(errorHandler,/fetch\(`\/api\/admin\/settlements\/\$\{id\}\/status`,\{cache:"no-store"\}\)/);
 assert.match(errorHandler,/catch\{ \/\* 조회 실패 시 기존 경고 유지 \*\/ \}/);
 assert.doesNotMatch(errorHandler,/setCompleted\(false\)/);
 assert.match(ui,/disabled=\{loading\|\|completed\|\|!amountVerified\|\|!auditVerified\}/);
 assert.match(ui,/disabled=\{loading\|\|completed\|\|!transferConfirmed\|\|!amountVerified\|\|!auditVerified\}/);
 assert.match(ui,/disabled=\{recheckLoading\|\|loading\} onClick=\{recheck\}/);
});

test("manual settlement status recheck is read-only and never unlocks uncertain review",()=>{
 const ui=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 const start=ui.indexOf("async function recheck()");
 const end=ui.indexOf("async function act(",start);
 assert.ok(start>=0&&end>start);
 const recheck=ui.slice(start,end);
 assert.match(recheck,/recheckInFlight\.current\|\|inFlight\.current\|\|loading/);
 assert.match(recheck,/cache:"no-store"/);
 assert.match(recheck,/setCompleted\(true\)/);
 assert.doesNotMatch(recheck,/setCompleted\(false\)/);
 assert.doesNotMatch(recheck,/method:"POST"/);
 assert.match(recheck,/router\.refresh\(\)/);
});

test("admin settlement review serializes state transitions and records audit atomically",()=>{
 const api=readFileSync(new URL("../app/api/admin/settlements/[id]/review/route.ts",import.meta.url),"utf8");
 const transaction=api.indexOf("getDb().transaction(async tx=>");
 const lock=api.indexOf("for update",transaction);
 const state=api.indexOf("canReviewSettlement(",lock);
 const audit=api.indexOf("await tx.insert(auditLogs).values(",state);
 const notification=api.indexOf("await notifyUser(",audit);
 assert.ok(transaction>=0&&lock>transaction&&state>lock&&audit>state&&notification>audit);
 assert.match(api,/eq\(settlements\.status,"REQUESTED"\)/);
 assert.match(api,/eq\(settlements\.status,"APPROVED"\)/);
 assert.match(api,/eq\(earnings\.status,"HOLD"\)/);
 assert.match(api,/changedSettlement\.length!==1/);
 assert.match(api,/changed\.length!==1/);
 assert.match(api,/hasUniqueSettlementEarnings\(items\.map\(item=>item\.earningId\)\)/);
 assert.match(api,/settlementAuditMatches\(/);
 assert.match(api,/transferConfirmed:action==="PAID"\?true:undefined/);
});

test("partner payout creation locks partner and claims each earning exactly once",()=>{
 const api=readFileSync(new URL("../app/api/partner/settlements/route.ts",import.meta.url),"utf8");
 const transaction=api.indexOf("getDb().transaction(async tx=>");
 const lock=api.indexOf("for update",transaction);
 const pending=api.indexOf("canStartSettlement(",lock);
 const available=api.indexOf('eq(earnings.status,"AVAILABLE")',pending);
 const hold=api.indexOf('set({status:"HOLD"})',available);
 const items=api.indexOf("tx.insert(settlementItems).values(",hold);
 const audit=api.indexOf("tx.insert(auditLogs).values(",items);
 const notification=api.indexOf("await notifyAdmins(",audit);
 assert.ok(transaction>=0&&lock>transaction&&pending>lock&&available>pending&&hold>available&&items>hold&&audit>items&&notification>audit);
 assert.match(api,/eq\(earnings\.id,earning\.id\),eq\(earnings\.status,"AVAILABLE"\)/);
 assert.match(api,/if\(changed\.length!==1\)throw new Error\("EARNINGS_CHANGED"\)/);
 assert.match(api,/if\(BigInt\(amount\)!==total\)throw new Error\("REQUEST_FULL_AVAILABLE_AMOUNT"\)/);
 assert.match(api,/return Response\.json\(\{ok:true,settlementCode:result\},\{status:201\}\)/);
});

test("settlement lifecycle preserves holds on approval and releases only on rejection",()=>{
 const request=readFileSync(new URL("../app/api/partner/settlements/route.ts",import.meta.url),"utf8");
 const review=readFileSync(new URL("../app/api/admin/settlements/[id]/review/route.ts",import.meta.url),"utf8");
 const approve=review.slice(review.indexOf('if(action==="APPROVE")'),review.indexOf('}else if(action==="PAID")'));
 const paid=review.slice(review.indexOf('}else if(action==="PAID")'),review.indexOf('}else{if(row.settlement.status!=="REQUESTED")'));
 const reject=review.slice(review.indexOf('}else{if(row.settlement.status!=="REQUESTED")'),review.indexOf("await tx.insert(auditLogs)"));
 assert.match(request,/set\(\{status:"HOLD"\}\)/);
 assert.match(approve,/status:"APPROVED"/);
 assert.doesNotMatch(approve,/tx\.update\(earnings\)\.set/);
 assert.match(paid,/status:"PAID"/);
 assert.match(paid,/tx\.update\(earnings\)\.set\(\{status:"PAID"\}\)/);
 assert.match(reject,/status:"REJECTED"/);
 assert.match(reject,/tx\.update\(earnings\)\.set\(\{status:"AVAILABLE"\}\)/);
 assert.match(paid,/eq\(earnings\.status,"HOLD"\)/);
 assert.match(reject,/eq\(earnings\.status,"HOLD"\)/);
});

test("audit mismatch blocks settlement review in UI and server transaction",()=>{
 const ui=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 const api=readFileSync(new URL("../app/api/admin/settlements/[id]/review/route.ts",import.meta.url),"utf8");
 const status=readFileSync(new URL("../app/api/admin/settlements/[id]/status/route.ts",import.meta.url),"utf8");
 const detail=readFileSync(new URL("../app/admin/settlements/[id]/page.tsx",import.meta.url),"utf8");
 const auditCheck=api.indexOf("settlementAuditMatches(");
 const change=api.indexOf('if(action==="APPROVE")',auditCheck);
 assert.ok(auditCheck>=0&&change>auditCheck);
 assert.match(api.slice(auditCheck,change),/throw new Error\("SETTLEMENT_AUDIT_MISMATCH"\)/);
 assert.match(ui,/if\(!auditVerified\)/);
 assert.match(ui,/current\.auditVerified!==true/);
 assert.match(ui,/disabled=\{loading\|\|completed\|\|!amountVerified\|\|!auditVerified\}/);
 assert.match(ui,/disabled=\{loading\|\|completed\|\|!transferConfirmed\|\|!amountVerified\|\|!auditVerified\}/);
 assert.match(detail,/auditVerified=\{auditVerified\}/);
 assert.match(status,/settlementAuditMatches\(/);
});

test("audit mismatch response is surfaced without allowing blind retry",()=>{
 const ui=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 const api=readFileSync(new URL("../app/api/admin/settlements/[id]/review/route.ts",import.meta.url),"utf8");
 assert.match(ui,/SETTLEMENT_AUDIT_MISMATCH:"정산 상태와 관리자 감사 기록이 일치하지 않습니다/);
 assert.match(ui,/confirmedRejection=!res\.ok&&res\.status>=400&&res\.status<500/);
 assert.match(ui,/setCompleted\(true\)/);
 assert.match(ui,/setTransferConfirmed\(false\)/);
 assert.match(ui,/latest\.auditVerified!==true/);
 assert.match(api,/const known=\[[^\]]*"SETTLEMENT_AUDIT_MISMATCH"/);
 assert.match(api,/error==="REVIEW_FAILED"\?500:409/);
});

test("duplicate earnings and amount mismatch block review at every layer",()=>{
 const ui=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 const api=readFileSync(new URL("../app/api/admin/settlements/[id]/review/route.ts",import.meta.url),"utf8");
 const status=readFileSync(new URL("../app/api/admin/settlements/[id]/status/route.ts",import.meta.url),"utf8");
 const detail=readFileSync(new URL("../app/admin/settlements/[id]/page.tsx",import.meta.url),"utf8");
 assert.match(api,/hasUniqueSettlementEarnings\(items\.map\(item=>item\.earningId\)\)/);
 assert.match(api,/throw new Error\("DUPLICATE_SETTLEMENT_EARNING"\)/);
 assert.match(api,/throw new Error\("SETTLEMENT_AMOUNT_MISMATCH"\)/);
 assert.match(status,/amountVerified/);
 assert.match(detail,/amountVerified/);
 assert.match(ui,/if\(!amountVerified\)/);
 assert.match(ui,/current\.amountVerified!==true/);
 assert.match(ui,/!amountVerified\|\|!auditVerified/);
 assert.match(ui,/DUPLICATE_SETTLEMENT_EARNING:/);
 assert.match(ui,/SETTLEMENT_AMOUNT_MISMATCH:/);
});

test("concurrent payout requests require locks and compare-and-swap updates",()=>{
 const partner=readFileSync(new URL("../app/api/partner/settlements/route.ts",import.meta.url),"utf8");
 const admin=readFileSync(new URL("../app/api/admin/settlements/[id]/review/route.ts",import.meta.url),"utf8");
 assert.match(partner,/select id from \$\{partners\} where id=\$\{user\.partnerId!\} for update/);
 assert.match(admin,/select id from \$\{settlements\} where id=\$\{id\} for update/);
 assert.match(partner,/where\(and\(eq\(earnings\.id,earning\.id\),eq\(earnings\.status,"AVAILABLE"\)\)\)/);
 assert.match(admin,/where\(and\(eq\(earnings\.id,item\.earningId\),eq\(earnings\.status,"HOLD"\)\)\)/);
 assert.match(admin,/where\(and\(eq\(settlements\.id,id\),eq\(settlements\.status,"REQUESTED"\)\)\)/);
 assert.match(admin,/where\(and\(eq\(settlements\.id,id\),eq\(settlements\.status,"APPROVED"\)\)\)/);
 assert.match(partner,/if\(changed\.length!==1\)throw new Error\("EARNINGS_CHANGED"\)/);
 assert.match(admin,/if\(changedSettlement\.length!==1\)throw new Error\("INVALID_STATUS"\)/);
});

test("settlement failures throw inside transaction before post-commit notifications",()=>{
 const partner=readFileSync(new URL("../app/api/partner/settlements/route.ts",import.meta.url),"utf8");
 const review=readFileSync(new URL("../app/api/admin/settlements/[id]/review/route.ts",import.meta.url),"utf8");
 for(const [source,notification] of [[partner,"await notifyAdmins("],[review,"await notifyUser("]]){
  const begin=source.indexOf("getDb().transaction(async tx=>");
  const audit=source.indexOf("await tx.insert(auditLogs).values(",begin);
  const end=source.indexOf("});",audit);
  const notify=source.indexOf(notification,end);
  assert.ok(begin>=0&&audit>begin&&end>audit&&notify>end);
  assert.match(source.slice(begin,end),/throw new Error\(/);
  assert.ok(!source.slice(begin,end).includes(notification));
 }
 assert.match(partner,/catch\(notificationError\)\{console\.error\("Settlement saved but admin notification failed"/);
 assert.match(review,/catch\(notificationError\)\{console\.error\("Settlement review committed but notification failed"/);
});

test("notification failures do not turn committed settlements into failed API responses",()=>{
 const partner=readFileSync(new URL("../app/api/partner/settlements/route.ts",import.meta.url),"utf8");
 const review=readFileSync(new URL("../app/api/admin/settlements/[id]/review/route.ts",import.meta.url),"utf8");
 const partnerNotification=partner.slice(partner.indexOf("try{await notifyAdmins("),partner.indexOf("return Response.json({ok:true,settlementCode:result}"));
 const reviewNotification=review.slice(review.indexOf("try{await notifyUser("),review.indexOf("return Response.json({ok:true});"));
 assert.match(partnerNotification,/catch\(notificationError\)/);
 assert.match(reviewNotification,/catch\(notificationError\)/);
 assert.doesNotMatch(partnerNotification,/throw notificationError/);
 assert.doesNotMatch(reviewNotification,/throw notificationError/);
 assert.match(partner,/return Response\.json\(\{ok:true,settlementCode:result\},\{status:201\}\)/);
 assert.match(review,/return Response\.json\(\{ok:true\}\)/);
});

test("ambiguous review responses lock retry and require a fresh detail page",()=>{
 const ui=readFileSync(new URL("../components/SettlementReview.tsx",import.meta.url),"utf8");
 const review=readFileSync(new URL("../app/api/admin/settlements/[id]/review/route.ts",import.meta.url),"utf8");
 assert.match(ui,/let reviewSubmitted=false/);
 assert.match(ui,/reviewSubmitted=true/);
 assert.match(ui,/setCompleted\(true\)/);
 assert.match(ui,/if\(inFlight\.current\|\|recheckInFlight\.current\|\|completed\)return/);
 assert.match(ui,/요청 결과가 불확실합니다/);
 assert.match(ui,/서버 처리 상태 다시 확인/);
 assert.match(ui,/상세 화면 새로고침/);
 assert.match(review,/if\(!canReviewSettlement\(/);
 assert.match(review,/throw new Error\("INVALID_STATUS"\)/);
 assert.match(review,/for update/);
});
