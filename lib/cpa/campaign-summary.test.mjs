import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const source=readFileSync(new URL("./campaign-summary.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};
vm.runInNewContext(js,{exports});
const {summarizeCpaCampaigns}=exports;

test("campaign metrics use IDs instead of duplicate campaign names",()=>{
 const rows=[
  {campaignId:"a",campaign:"같은 이름",status:"RECEIVED"},
  {campaignId:"a",campaign:"같은 이름",status:"APPROVED"},
  {campaignId:"b",campaign:"같은 이름",status:"REJECTED"}
 ];
 const result=summarizeCpaCampaigns(rows);
 assert.equal(result.length,2);
 assert.equal(result[0].campaignId,"a");
 assert.equal(result[0].pending,1);
 assert.equal(result[0].approvalRate,50);
 assert.equal(result[1].campaignId,"b");
 assert.equal(result[1].rejected,1);
});
test("empty conversions produce empty campaign summary",()=>{
 assert.equal(summarizeCpaCampaigns([]).length,0);
});
