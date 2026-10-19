import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(relative)=>readFileSync(new URL(relative,import.meta.url),"utf8");
test("CPA application endpoint delegates to shared conversion service",()=>{
 assert.match(read("../../app/api/conversions/route.ts"),/createCpaConversion\(request\)/);
});
test("CPA conversion service locks click before checking duplicate attribution",()=>{
 const source=read("./conversion-service.ts");
 const lock=source.indexOf("cpa-click:");
 const duplicate=source.indexOf('throw new Error("CLICK_ALREADY_CONVERTED")');
 assert.ok(lock>=0&&duplicate>lock);
 assert.match(source,/for update/);
});
test("CPA review uses transaction and guarded state transitions",()=>{
 const source=read("../../app/api/admin/conversions/[id]/review/route.ts");
 assert.match(source,/db\.transaction\(async tx/);
 assert.match(source,/canReviewCpaConversion\(row\.conversion\.status\)/);
 assert.match(source,/validCpaReviewRates\(advertiserRate,partnerRate,margin\)/);
 assert.match(source,/eq\(conversions\.status,"REVIEWING"\)/);
 assert.match(source,/tx\.insert\(auditLogs\)/);
});
test("CPA review checks prior accounting before adding new entries",()=>{
 const source=read("../../app/api/admin/conversions/[id]/review/route.ts");
 assert.match(source,/if\(ledger\|\|earning\)throw new Error\("ALREADY_ACCOUNTED"\)/);
 assert.match(source,/tx\.insert\(advertiserLedger\)/);
 assert.match(source,/tx\.insert\(earnings\)/);
});
