import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const source=readFileSync(new URL("./settlement-validation.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};vm.runInNewContext(js,{exports});
const {settlementAuditMatches,canReviewSettlement,settlementAmountsMatch,hasUniqueSettlementEarnings}=exports;
const auditActions=["SETTLEMENT_APPROVE","SETTLEMENT_PAID","SETTLEMENT_REJECT"];
function* sequences(max=4,prefix=[]){yield prefix;if(prefix.length===max)return;for(const a of auditActions)yield* sequences(max,[...prefix,a]);}
test("audit state accepts only exact valid review sequences across 121 cases",()=>{
 const valid={REQUESTED:[],APPROVED:["SETTLEMENT_APPROVE"],PAID:["SETTLEMENT_APPROVE","SETTLEMENT_PAID"],REJECTED:["SETTLEMENT_REJECT"]};
 let cases=0;
 for(const seq of sequences()){
  for(const [status,expected] of Object.entries(valid)){
   const should=seq.length===expected.length&&seq.every((a,i)=>a===expected[i]);
   assert.equal(settlementAuditMatches(status,seq),should,status+" "+seq.join(","));
   cases++;
  }
 }
 assert.equal(cases,484);
});
test("every terminal status blocks all review actions",()=>{
 for(const status of ["PAID","REJECTED"])for(const action of ["APPROVE","PAID","REJECT"])
  assert.equal(canReviewSettlement(status,action),false);
});
test("settlement item validation rejects duplicate ids and any amount drift",()=>{
 assert.equal(hasUniqueSettlementEarnings(["earning-a","earning-b"]),true);
 assert.equal(hasUniqueSettlementEarnings(["earning-a","earning-a"]),false);
 assert.equal(hasUniqueSettlementEarnings(["earning-a",""]),false);
 for(const delta of [-2,-1,1,2])assert.equal(settlementAmountsMatch([12000,8000+delta],20000,20000,0),false);
 assert.equal(settlementAmountsMatch([12000,8000],20000,19340,660),true);
});
