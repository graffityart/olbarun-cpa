import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const source=readFileSync(new URL("./kst-date.ts",import.meta.url),"utf8");
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};
vm.runInNewContext(output,{exports,Date});
const {toKstDate,isWithinKstDateRange}=exports;
test("KST date rolls forward from prior UTC day",()=>{
 assert.equal(toKstDate(new Date("2026-10-18T16:00:00Z")),"2026-10-19");
});
test("KST date range includes local midnight boundaries",()=>{
 assert.equal(isWithinKstDateRange(new Date("2026-10-18T15:00:00Z"),"2026-10-19","2026-10-19"),true);
 assert.equal(isWithinKstDateRange(new Date("2026-10-19T14:59:59Z"),"2026-10-19","2026-10-19"),true);
 assert.equal(isWithinKstDateRange(new Date("2026-10-19T15:00:00Z"),"2026-10-19","2026-10-19"),false);
});
