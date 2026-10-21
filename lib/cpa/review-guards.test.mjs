import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const source=readFileSync(new URL("./review-guards.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};
vm.runInNewContext(js,{exports});
const {validCpaReviewRates,validCpaCampaignRates,canReviewCpaConversion}=exports;
test("accepts balanced CPA snapshots",()=>{
 assert.equal(validCpaReviewRates(30000,20000,10000),true);
 assert.equal(validCpaReviewRates(10000,0,10000),true);
});
test("rejects mismatched, negative and non-integer CPA snapshots",()=>{
 for(const rates of [[30000,20000,9999],[30000,40000,-10000],[0,0,0],[100,10,-1],[100.5,10,90.5],[Infinity,10,20],[NaN,0,0]]){
  assert.equal(validCpaReviewRates(...rates),false);
 }
});
test("only reviewing conversions are eligible for review",()=>{
 assert.equal(canReviewCpaConversion("REVIEWING"),true);
 for(const status of ["RECEIVED","DELIVERED","APPROVED","REJECTED","CANCELLED","TEST","DISPUTED"]){
  assert.equal(canReviewCpaConversion(status),false);
 }
});

test("rejects unsafe integer CPA accounting amounts",()=>{
 const max=Number.MAX_SAFE_INTEGER;
 assert.equal(validCpaReviewRates(2147483647,2147483647,0),true);
 assert.equal(validCpaReviewRates(max,max,0),false);
 assert.equal(validCpaReviewRates(2147483648,2147483647,1),false);
 assert.equal(validCpaReviewRates(2147483648,1,2147483647),false);
 assert.equal(validCpaReviewRates(max+1,1,max),false);
 assert.equal(validCpaReviewRates(100,Number.NaN,0),false);
 assert.equal(validCpaReviewRates(100,10,Infinity),false);
 assert.equal(validCpaReviewRates(100,-1,101),false);
});

test("CPA intake accepts valid campaign rates and minimum margins",()=>{
 assert.equal(validCpaCampaignRates(30000,20000,10000),true);
 assert.equal(validCpaCampaignRates(30000,20000,9999),true);
 assert.equal(validCpaCampaignRates(2147483647,2147483647,0),true);
});
test("CPA intake rejects overflowing, inconsistent and fractional rates",()=>{
 for(const rates of [[2147483648,1,0],[2147483647,2147483648,0],[2147483647,0,2147483648],[30000,20000,10001],[30000,30001,0],[30000,20000,-1],[30000,20000,0.5],[NaN,1,0]]){
  assert.equal(validCpaCampaignRates(...rates),false);
 }
});
