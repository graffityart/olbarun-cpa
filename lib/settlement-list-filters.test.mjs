import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const source=readFileSync(new URL("./settlement-list-filters.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};vm.runInNewContext(js,{exports});
const {normalizeSettlementListParams,escapeSettlementLike,settlementPageNumber}=exports;

test("normalizes status, search and audit filter",()=>{
 const result=normalizeSettlementListParams({status:"APPROVED",q:"  HELLO  ",audit:"MISSING",page:"2"});
 assert.equal(result.status,"APPROVED");assert.equal(result.q,"hello");assert.equal(result.audit,"MISSING");assert.equal(result.page,2);
});
test("rejects invalid filter values and page numbers",()=>{
 const result=normalizeSettlementListParams({status:"UNKNOWN",audit:"BAD",page:"-4"});
 assert.equal(result.status,"ALL");assert.equal(result.audit,"ALL");assert.equal(result.page,1);
});
test("escapes LIKE wildcards and backslashes",()=>{
 assert.equal(escapeSettlementLike("a%b_c\\d"),"a\\%b\\_c\\\\d");
});
test("bounds pages to available rows",()=>{
 assert.equal(settlementPageNumber(10,61,30),3);
 assert.equal(settlementPageNumber(2,0,30),1);
 assert.equal(settlementPageNumber(1,30,30),1);
});
