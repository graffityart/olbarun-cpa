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
