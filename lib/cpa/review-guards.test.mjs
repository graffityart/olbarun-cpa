import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const source=readFileSync(new URL("./review-guards.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};
vm.runInNewContext(js,{exports});
const {validCpaReviewRates,canReviewCpaConversion}=exports;
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
 assert.equal(validCpaReviewRates(max,max,0),true);
 assert.equal(validCpaReviewRates(max+1,1,max),false);
 assert.equal(validCpaReviewRates(100,Number.NaN,0),false);
 assert.equal(validCpaReviewRates(100,10,Infinity),false);
 assert.equal(validCpaReviewRates(100,-1,101),false);
});
