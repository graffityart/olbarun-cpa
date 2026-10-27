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

test("CPA advance route preserves guarded status transitions",()=>{
 const source=read("../../app/api/admin/conversions/[id]/advance/route.ts");
 assert.match(source,/pg_advisory_xact_lock/);
 assert.match(source,/row\.status==="RECEIVED"\?"DELIVERED"/);
 assert.match(source,/row\.status==="DELIVERED"\?"REVIEWING"/);
 assert.match(source,/eq\(conversions\.status,row\.status\)/);
});

test("CPA status advance audit is recorded inside transaction",()=>{
 const source=read("../../app/api/admin/conversions/[id]/advance/route.ts");
 const transaction=source.indexOf("db.transaction(async tx=>");
 const audit=source.indexOf("tx.insert(auditLogs)");
 const commit=source.indexOf("return{code:row.code,from:row.status,to:next}");
 assert.ok(transaction>=0 && audit>transaction && commit>audit);
 assert.doesNotMatch(source,/writeAudit\(/);
});

test("CPA rejection cannot create partner earnings or advertiser debit",()=>{
 const source=read("../../app/api/admin/conversions/[id]/review/route.ts");
 const rejectStart=source.indexOf('if(decision==="REJECTED")');
 const approveStart=source.indexOf('if(decision==="APPROVED")');
 assert.ok(rejectStart>=0&&approveStart>rejectStart);
 const rejectBranch=source.slice(rejectStart,approveStart);
 assert.match(rejectBranch,/ALREADY_ACCOUNTED/);
 assert.doesNotMatch(rejectBranch,/tx\.insert\(earnings\)|tx\.insert\(advertiserLedger\)/);
});

test("CPA approval and settlement payment enforce independent transaction boundaries",()=>{
 const conversion=read("../../app/api/admin/conversions/[id]/review/route.ts");
 const settlement=read("../../app/api/admin/settlements/[id]/review/route.ts");
 assert.match(conversion,/requireSameOrigin\(request\)/);
 assert.match(conversion,/await requireAdmin\(\)/);
 assert.match(conversion,/db\.transaction\(async tx/);
 assert.match(conversion,/tx\.insert\(advertiserLedger\)/);
 assert.match(conversion,/tx\.insert\(earnings\)/);
 assert.match(settlement,/requireSameOrigin\(request\)/);
 assert.match(settlement,/await requireAdmin\(\)/);
 assert.match(settlement,/transferConfirmed!==true/);
 assert.match(settlement,/getDb\(\)\.transaction\(async tx/);
 assert.match(settlement,/settlementAuditMatches\(/);
 assert.match(settlement,/settlementAmountsMatch\(/);
});

test("CPA submission enforces duplicate attribution and campaign budget before creating a conversion",()=>{
 const source=read("./conversion-service.ts");
 const lock=source.indexOf("select id from ${campaigns} where id=${campaignId} for update");
 const duplicate=source.indexOf('throw new Error("DUPLICATE")');
 const clickLock=source.indexOf("cpa-click:");
 assert.ok(lock>=0&&duplicate>lock&&clickLock>duplicate);
 for(const error of ["DAILY_CONVERSION_LIMIT_REACHED","MONTHLY_CONVERSION_LIMIT_REACHED","DAILY_BUDGET_LIMIT_REACHED","MONTHLY_BUDGET_LIMIT_REACHED","INVALID_LEDGER_BALANCE"]){
  assert.ok(source.includes('throw new Error("'+error+'")'),"missing guard: "+error);
 }
 assert.match(source,/customerPhoneHash,phoneHash/);
 assert.match(source,/CLICK_ALREADY_CONVERTED/);
});

test("CPA approval requires balance and rejects duplicate accounting before partner credit",()=>{
 const source=read("../../app/api/admin/conversions/[id]/review/route.ts");
 const lock=source.indexOf("advertiser:${row.advertiserId}");
 const duplicate=source.indexOf('throw new Error("ALREADY_ACCOUNTED")',lock);
 const balance=source.indexOf('throw new Error("INSUFFICIENT_BALANCE")',duplicate);
 const debit=source.indexOf("tx.insert(advertiserLedger)",balance);
 const credit=source.indexOf("tx.insert(earnings)",debit);
 assert.ok(lock>=0&&duplicate>lock&&balance>duplicate&&debit>balance&&credit>debit);
 assert.match(source,/eq\(conversions\.status,"REVIEWING"\)/);
});
