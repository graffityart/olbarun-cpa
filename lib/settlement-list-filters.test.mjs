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

test("validates requested date range",()=>{
 const valid=normalizeSettlementListParams({from:"2026-10-01",to:"2026-10-19"});
 assert.equal(valid.from,"2026-10-01");assert.equal(valid.to,"2026-10-19");
 const invalid=normalizeSettlementListParams({from:"2026-02-30",to:"2026-02-01"});
 assert.equal(invalid.from,"");assert.equal(invalid.to,"2026-02-01");
 const reversed=normalizeSettlementListParams({from:"2026-10-19",to:"2026-10-01"});
 assert.equal(reversed.from,"");assert.equal(reversed.to,"");
});

test("bounds malformed and oversized page requests",()=>{
 assert.equal(settlementPageNumber(Number.NaN,100,30),1);
 assert.equal(settlementPageNumber(-10,100,30),1);
 assert.equal(settlementPageNumber(999,100,30),4);
 assert.equal(normalizeSettlementListParams({page:""}).page,1);
});

test("supports 24-hour and 72-hour overdue filters without accepting arbitrary values",()=>{
 const day=normalizeSettlementListParams({status:"REQUESTED",stale:"24",amount:"MISMATCH"});
 assert.equal(day.stale,true);
 assert.equal(day.staleHours,24);
 assert.equal(day.amount,true);
 const threeDays=normalizeSettlementListParams({status:"APPROVED",stale:"1"});
 assert.equal(threeDays.stale,true);
 assert.equal(threeDays.staleHours,72);
 const all=normalizeSettlementListParams({stale:"0"});
 assert.equal(all.stale,false);
 assert.equal(all.staleHours,72);
 const invalid=normalizeSettlementListParams({stale:"48"});
 assert.equal(invalid.stale,false);
});
test("retains date and search filters alongside overdue selection",()=>{
 const result=normalizeSettlementListParams({status:"APPROVED",stale:"24",q:"  ABC-123  ",from:"2026-10-01",to:"2026-10-26",page:"3"});
 assert.equal(result.status,"APPROVED");
 assert.equal(result.staleHours,24);
 assert.equal(result.q,"abc-123");
 assert.equal(result.from,"2026-10-01");
 assert.equal(result.to,"2026-10-26");
 assert.equal(result.page,3);
});
