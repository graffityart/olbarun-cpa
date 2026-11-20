import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

// Pure in-memory state-machine simulation: no HTTP, database writes, or transfers.
const source = readFileSync(new URL("./settlement-validation.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(js, { exports });
const { sumSettlementItems, settlementAmountsMatch, canStartSettlement, canReviewSettlement, settlementAuditMatches, isValidSettlementReviewRequest, hasUniqueSettlementEarnings } = exports;

function fixture() {
  return { earnings: [{id:"synthetic-a",amount:12000,status:"AVAILABLE"}, {id:"synthetic-b",amount:8000,status:"AVAILABLE"}], settlement:null, audit:[] };
}
function request(state, amount) {
  if (!canStartSettlement(state.settlement ? [state.settlement.status] : [])) return false;
  const available=state.earnings.filter(e=>e.status==="AVAILABLE");
  const total=sumSettlementItems(available.map(e=>e.amount));
  if (total===null || BigInt(amount)!==total || !hasUniqueSettlementEarnings(available.map(e=>e.id))) return false;
  state.settlement={status:"REQUESTED",amount,ids:available.map(e=>e.id)};
  available.forEach(e=>e.status="HOLD");
  state.audit.push("SETTLEMENT_REQUEST");
  return true;
}
function review(state, action, transferConfirmed) {
  const s=state.settlement;
  if (!s || !canReviewSettlement(s.status,action)) return false;
  if (!isValidSettlementReviewRequest(action==="PAID"?{action,transferConfirmed}:{action})) return false;
  if (!settlementAuditMatches(s.status,state.audit)) return false;
  const items=s.ids.map(id=>state.earnings.find(e=>e.id===id));
  if (items.some(e=>!e || e.status!=="HOLD") || !settlementAmountsMatch(items.map(e=>e.amount),s.amount,s.amount,0)) return false;
  if (action==="REJECT") { s.status="REJECTED";items.forEach(e=>e.status="AVAILABLE"); }
  if (action==="APPROVE") s.status="APPROVED";
  if (action==="PAID") {s.status="PAID";items.forEach(e=>e.status="PAID");}
  state.audit.push("SETTLEMENT_"+action);
  return true;
}
test("synthetic rejection restores both earnings and audit history",()=>{
  const s=fixture();
  assert.equal(request(s,20000),true);
  assert.deepEqual(s.earnings.map(e=>e.status),["HOLD","HOLD"]);
  assert.equal(request(s,20000),false);
  assert.equal(review(s,"REJECT"),true);
  assert.deepEqual(s.earnings.map(e=>e.status),["AVAILABLE","AVAILABLE"]);
  assert.equal(settlementAuditMatches(s.settlement.status,s.audit),true);
});
test("synthetic approval cannot pay without confirmation and cannot pay twice",()=>{
  const s=fixture();
  assert.equal(request(s,20000),true);
  assert.equal(review(s,"PAID",true),false);
  assert.equal(review(s,"APPROVE"),true);
  assert.equal(review(s,"REJECT"),false);
  assert.equal(review(s,"PAID",false),false);
  assert.equal(review(s,"PAID",true),true);
  assert.deepEqual(s.earnings.map(e=>e.status),["PAID","PAID"]);
  assert.equal(review(s,"PAID",true),false);
  assert.equal(settlementAuditMatches(s.settlement.status,s.audit),true);
});
test("synthetic request rejects partial and mismatched amounts",()=>{
  for (const amount of [0,8000,12000,20001]) {
    const s=fixture();assert.equal(request(s,amount),false);
    assert.equal(s.settlement,null);
    assert.deepEqual(s.earnings.map(e=>e.status),["AVAILABLE","AVAILABLE"]);
  }
});
test("synthetic review refuses mismatched earnings and audit",()=>{
  const s=fixture();assert.equal(request(s,20000),true);
  s.earnings[0].amount=11000;
  assert.equal(review(s,"APPROVE"),false);
  s.earnings[0].amount=12000;
  s.audit.push("SETTLEMENT_REJECT");
  assert.equal(review(s,"APPROVE"),false);
  assert.equal(s.settlement.status,"REQUESTED");
});
