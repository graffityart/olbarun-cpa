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
 assert.match(source,/eq\(conversions\.status,row\.conversion\.status\)/);
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
 assert.match(source,/eq\(conversions\.status,row\.conversion\.status\)/);
});

test("partner settlement request holds all available earnings atomically",()=>{
 const source=read("../../app/api/partner/settlements/route.ts");
 const lock=source.indexOf("select id from ${partners} where id=${user.partnerId!} for update");
 const pending=source.indexOf("canStartSettlement(",lock);
 const total=source.indexOf("sumSettlementItems(",pending);
 const insert=source.indexOf("tx.insert(settlements)",total);
 const hold=source.indexOf('status:"HOLD"',insert);
 const item=source.indexOf("tx.insert(settlementItems)",hold);
 const audit=source.indexOf("tx.insert(auditLogs)",item);
 assert.ok(lock>=0&&pending>lock&&total>pending&&insert>total&&hold>insert&&item>hold&&audit>item);
 assert.match(source,/getDb\(\)\.transaction\(async tx/);
 assert.match(source,/eq\(earnings\.status,"AVAILABLE"\)/);
 assert.match(source,/eq\(earnings\.status,"AVAILABLE"\)\)\)\.returning/);
 assert.match(source,/throw new Error\("EARNINGS_CHANGED"\)/);
 assert.match(source,/throw new Error\("REQUEST_FULL_AVAILABLE_AMOUNT"\)/);
});

test("advertiser review and admin approval serialize the same conversion",()=>{
 const advertiser=read("../../app/api/advertiser/conversions/[id]/review/route.ts");
 const admin=read("../../app/api/admin/conversions/[id]/review/route.ts");
 for(const source of [advertiser,admin]){
  assert.match(source,/pg_advisory_xact_lock\(hashtext\(\$\{`conversion:\$\{id\}`\}\)\)/);
  assert.match(source,/db\.transaction\(async tx/);
  assert.match(source,/eq\(conversions\.status,/);
  assert.match(source,/tx\.insert\(auditLogs\)/);
 }
 assert.match(advertiser,/eq\(campaigns\.advertiserId,advertiser\.advertiserId\)/);
 assert.match(advertiser,/row\.status!=="DELIVERED"/);
 assert.match(admin,/ALREADY_ACCOUNTED/);
 assert.match(admin,/INSUFFICIENT_BALANCE/);
 assert.match(admin,/pg_advisory_xact_lock\(hashtext\(\$\{`advertiser:\$\{row\.advertiserId\}`\}\)\)/);
});

test("CPA final approval debits advertiser and credits partner exactly once in transaction",()=>{
 const source=read("../../app/api/admin/conversions/[id]/review/route.ts");
 const transaction=source.indexOf("db.transaction(async tx=>");
 const prior=source.indexOf('if(ledger||earning)throw new Error("ALREADY_ACCOUNTED")',source.indexOf('if(decision==="APPROVED")'));
 const debit=source.indexOf("tx.insert(advertiserLedger).values(",prior);
 const credit=source.indexOf("tx.insert(earnings).values(",debit);
 const transition=source.indexOf("tx.update(conversions).set(",credit);
 const audit=source.indexOf("tx.insert(auditLogs).values(",transition);
 const notify=source.indexOf("await notifyUser(",audit);
 assert.ok(transaction>=0&&prior>transaction&&debit>prior&&credit>debit&&transition>credit&&audit>transition&&notify>audit);
 assert.match(source,/amount:-advertiserRate,balanceAfter:balance-advertiserRate/);
 assert.match(source,/amount:partnerRate,status:"AVAILABLE"/);
 assert.match(source,/eq\(conversions\.status,row\.conversion\.status\)/);
 assert.match(source,/if\(!updated\)throw new Error\("UPDATE_FAILED"\)/);
 assert.match(source,/if\(balance<advertiserRate\)throw new Error\("INSUFFICIENT_BALANCE"\)/);
});

test("advertiser signup requires approval before accessing advertiser pages",()=>{
 const signup=read("../../app/api/auth/advertiser-signup/route.ts");
 const approval=read("../../app/api/admin/advertisers/[id]/approve/route.ts");
 const guard=read("../auth/advertiser.ts");
 assert.match(signup,/role:'ADVERTISER',status:'PENDING'/);
 assert.match(approval,/\['ADMIN','SUPER_ADMIN'\]/);
 assert.match(approval,/account\.status!=='PENDING'/);
 assert.match(approval,/status:'ACTIVE'/);
 assert.match(approval,/tx\.insert\(auditLogs\)/);
 assert.match(guard,/user\.status !== "ACTIVE"/);
 assert.match(guard,/user\.role !== "ADVERTISER"/);
 assert.match(guard,/eq\(advertiserUsers\.userId, user\.id\)/);
});
test("admin-created advertiser account serializes duplicate checks and audit",()=>{
 const source=read("../../app/api/admin/advertisers/[id]/account/route.ts");
 const lock=source.indexOf("advertiser-account:");
 const linked=source.indexOf("ACCOUNT_ALREADY_EXISTS");
 const created=source.indexOf("tx.insert(users)");
 const audit=source.indexOf("tx.insert(auditLogs)");
 assert.ok(lock>=0&&linked>lock&&created>linked&&audit>created);
 assert.match(source,/code==="ACCOUNT_ALREADY_EXISTS"\|\|code==="EMAIL_ALREADY_EXISTS"\?409/);
});

test("CPA conversion rate snapshots remain consistent during campaign rate edits",()=>{
 const intake=read("./conversion-service.ts");
 const edit=read("../../app/api/admin/campaigns/[id]/route.ts");
 const review=read("../../app/api/admin/conversions/[id]/review/route.ts");
 assert.match(intake,/select id from \$\{campaigns\} where id=\$\{campaignId\} for update/);
 assert.match(edit,/\.from\(campaigns\)\.where\(eq\(campaigns\.id,id\)\)\.for\("update"\)/);
 assert.match(intake,/advertiserRateSnapshot:rate\.advertiserRate/);
 assert.match(intake,/partnerRateSnapshot:rate\.partnerBaseRate/);
 assert.match(intake,/platformMarginSnapshot:margin/);
 assert.match(edit,/effectiveTo:now/);
 assert.match(edit,/effectiveFrom:now/);
 assert.match(review,/row\.conversion\.advertiserRateSnapshot/);
 assert.match(review,/row\.conversion\.partnerRateSnapshot/);
});

test("CPA intake serializes budget limits, duplicates and single-use clicks",()=>{
 const source=read("./conversion-service.ts");
 const lock=source.indexOf("select id from ${campaigns} where id=${campaignId} for update");
 const daily=source.indexOf("DAILY_CONVERSION_LIMIT_REACHED");
 const monthly=source.indexOf("MONTHLY_CONVERSION_LIMIT_REACHED");
 const budget=source.indexOf("DAILY_BUDGET_LIMIT_REACHED");
 const duplicate=source.indexOf("customerPhoneHash,phoneHash");
 const click=source.indexOf("cpa-click:");
 const used=source.indexOf("CLICK_ALREADY_CONVERTED");
 const insert=source.indexOf("tx.insert(conversions).values(");
 assert.ok(lock>=0&&daily>lock&&monthly>daily&&budget>monthly&&duplicate>budget&&click>duplicate&&used>click&&insert>used);
 assert.match(source,/INVALID_CONVERSION_COUNT/);
 assert.match(source,/MONTHLY_BUDGET_LIMIT_REACHED/);
 assert.match(source,/eq\(conversions\.campaignId,campaignId\)/);
 assert.match(source,/gte\(conversions\.submittedAt,today\)/);
 assert.match(source,/gte\(conversions\.submittedAt,month\)/);
 assert.match(source,/eq\(conversionData\.customerPhoneHash,phoneHash\)/);
 assert.match(source,/eq\(conversions\.clickId,click\.id\)/);
});
