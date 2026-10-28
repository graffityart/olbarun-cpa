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

test("CPA approval commits advertiser debit, partner earning and review status together",()=>{
 const source=read("../../app/api/admin/conversions/[id]/review/route.ts");
 const transaction=source.indexOf("db.transaction(async tx=>");
 const lock=source.indexOf("conversion:${id}");
 const balance=source.indexOf("validCpaDebitBalance(balance,advertiserRate)");
 const debit=source.indexOf("tx.insert(advertiserLedger)");
 const earning=source.indexOf("tx.insert(earnings)");
 const status=source.indexOf("tx.update(conversions)");
 const audit=source.indexOf("tx.insert(auditLogs)");
 const end=source.indexOf("});if(result.partnerUserId)");
 assert.ok(transaction>=0&&lock>transaction&&balance>lock&&debit>balance&&earning>debit&&status>earning&&audit>status&&end>audit);
 assert.match(source,/amount:-advertiserRate,balanceAfter:balance-advertiserRate/);
 assert.match(source,/amount:partnerRate,status:"AVAILABLE"/);
 assert.match(source,/if\(ledger\|\|earning\)throw new Error\("ALREADY_ACCOUNTED"\)/);
 assert.match(source,/if\(!updated\)throw new Error\("UPDATE_FAILED"\)/);
});

test("CPA rejection cannot debit advertiser or credit partner",()=>{
 const source=read("../../app/api/admin/conversions/[id]/review/route.ts");
 const reject=source.indexOf('if(decision==="REJECTED"){');
 const approve=source.indexOf('if(decision==="APPROVED"){');
 const debit=source.indexOf("tx.insert(advertiserLedger)");
 const credit=source.indexOf("tx.insert(earnings)");
 const update=source.indexOf("tx.update(conversions)");
 assert.ok(reject>=0&&approve>reject&&debit>approve&&credit>debit&&update>credit);
 const rejectionGuard=source.slice(reject,approve);
 assert.match(rejectionGuard,/if\(ledger\|\|earning\)throw new Error\("ALREADY_ACCOUNTED"\)/);
 assert.doesNotMatch(rejectionGuard,/tx\.insert\(advertiserLedger\)|tx\.insert\(earnings\)/);
 assert.match(source,/approvedAt:decision==="APPROVED"\?now:null/);
 assert.match(source,/rejectedAt:decision==="REJECTED"\?now:null/);
 assert.match(source,/eq\(conversions\.status,row\.conversion\.status\)/);
});

test("CPA review UI prevents duplicate submissions and uncertain retries",()=>{
 const source=read("../../components/ConversionReview.tsx");
 for(const guard of ["busy.current||completed||uncertain","busy.current=true","setCompleted(true)","res.status>=500","setUncertain(true)","disabled={loading||completed||uncertain}"]){
  assert.ok(source.includes(guard), "missing UI safety guard: "+guard);
 }
 assert.ok(source.includes("errorMessages[code]"));
 assert.ok(!source.includes("errorMessages[data.error]||data.error"));
});

test("CPA review detail only shows decision controls for reviewable statuses",()=>{
 const detail=read("../../app/admin/conversions/[id]/page.tsx");
 const review=read("../../components/ConversionReview.tsx");
 assert.ok(detail.includes('["REVIEWING","REJECTION_REQUESTED"].includes(c.status)?<ConversionReview'));
 assert.ok(detail.includes('["RECEIVED","DELIVERED"].includes(c.status)?<ConversionAdvance'));
 assert.ok(detail.includes("최종 처리되었거나 별도 대응이 필요한 CPA 전환입니다."));
 assert.ok(review.includes("window.location.reload()"));
 assert.ok(review.includes("현재 상태 새로고침"));
 assert.ok(review.includes("disabled={loading||completed||uncertain}"));
});

test("CPA dashboard and ledger retain reconciliation links",()=>{
 const conversions=read("../../app/admin/conversions/page.tsx");
 const ledger=read("../../app/admin/ledger/page.tsx");
 assert.ok(conversions.includes('href="/admin/ledger"'));
 assert.ok(ledger.includes('/admin/conversions/'));
 assert.ok(ledger.includes('mismatchReason(r)'));
 assert.ok(ledger.includes("광고비 누락"));
 assert.ok(ledger.includes("파트너 수익 중복"));
});

test("CPA ledger review requires admin and preserves manual audit trail",()=>{
 const api=read("../../app/api/admin/ledger/reviews/route.ts");
 const form=read("../../components/admin/LedgerReviewForm.tsx");
 assert.ok(api.includes('["ADMIN", "SUPER_ADMIN"].includes(user.role)'));
 assert.ok(api.includes('origin !== request.nextUrl.origin'));
 assert.ok(api.includes('conversion.status !== "APPROVED"'));
 assert.ok(api.includes('["IN_REVIEW", "RESOLVED", "REOPENED"]'));
 assert.ok(api.includes('note.trim().length === 0 && status === "RESOLVED"'));
 assert.ok(api.includes('db.insert(cpaLedgerReviews)'));
 assert.ok(api.includes('reviewerUserId: user.id'));
 assert.ok(form.includes('maxLength={1000}'));
 assert.ok(form.includes('disabled={busy || uncertain}'));
 assert.ok(form.includes('submitting.current || uncertain'));
 assert.ok(form.includes('submitting.current = true'));
 assert.ok(form.includes('response.status >= 500'));
 assert.ok(form.includes('setUncertain(true)'));
 assert.ok(form.includes('검토 이력 새로고침'));
 assert.ok(form.includes('검토 완료는 정산 장부의 자동 수정이 아닙니다.'));
});


test("approved CPA earning feeds settlement available to hold to paid lifecycle",()=>{
 const approval=read("../../app/api/admin/conversions/[id]/review/route.ts");
 const request=read("../../app/api/partner/settlements/route.ts");
 const review=read("../../app/api/admin/settlements/[id]/review/route.ts");
 assert.ok(approval.includes('type:"CPA_APPROVAL",amount:partnerRate,status:"AVAILABLE"'));
 assert.ok(approval.includes("tx.insert(advertiserLedger)"));
 assert.ok(request.includes('eq(earnings.status,"AVAILABLE")'));
 assert.ok(request.includes('set({status:"HOLD"})'));
 assert.ok(review.includes('set({status:"PAID"})'));
 assert.ok(review.includes('set({status:"AVAILABLE"})'));
 assert.ok(review.includes("await tx.insert(auditLogs)"));
});


test("CPA earnings lifecycle keeps approval, settlement request and payout transitions auditable",()=>{
 const conversion=read("../../app/api/admin/conversions/[id]/review/route.ts");
 const request=read("../../app/api/partner/settlements/route.ts");
 const payout=read("../../app/api/admin/settlements/[id]/review/route.ts");
 const status=read("../../app/api/admin/settlements/[id]/status/route.ts");
 assert.match(conversion,/tx\.insert\(earnings\)/);
 assert.match(conversion,/status:"AVAILABLE"/);
 assert.match(conversion,/tx\.insert\(auditLogs\)/);
 assert.match(request,/getDb\(\)\.transaction\(async tx/);
 assert.match(request,/canStartSettlement\(/);
 assert.match(request,/BigInt\(amount\)!==total/);
 assert.match(request,/set\(\{status:"HOLD"\}\)/);
 assert.match(request,/tx\.insert\(settlementItems\)/);
 assert.match(request,/tx\.insert\(auditLogs\)/);
 assert.match(payout,/canReviewSettlement\(/);
 assert.match(payout,/settlementAuditMatches\(/);
 assert.match(payout,/settlementAmountsMatch\(/);
 assert.match(payout,/action==="PAID"&&body\.transferConfirmed!==true/);
 assert.match(payout,/set\(\{status:"PAID"\}\)/);
 assert.match(payout,/set\(\{status:"AVAILABLE"\}\)/);
 assert.match(payout,/tx\.insert\(auditLogs\)/);
 assert.match(status,/auditVerified\s*,\s*amountVerified/);
 assert.match(status,/Cache-Control/);
});


test("admin CPA ledger reconciliation detects missing, duplicate and mismatched accounting entries",()=>{
 const page=read("../../app/admin/ledger/page.tsx");
 assert.ok(page.includes("await requireAdmin()"));
 assert.ok(page.includes('dynamic="force-dynamic"'));
 assert.ok(page.includes('eq(conversions.status,"APPROVED")'));
 assert.ok(page.includes("ledgerByConversion"));
 assert.ok(page.includes("earningsByConversion"));
 for(const reason of ["광고비 누락","광고비 중복","광고비 금액 불일치","파트너 수익 누락","파트너 수익 중복","파트너 수익 금액 불일치"]){
  assert.ok(page.includes(reason),"missing reconciliation reason: "+reason);
 }
 assert.ok(page.includes("l.reduce((s,v)=>s+v.amount,0)!==-r.rate"));
 assert.ok(page.includes("e.reduce((s,v)=>s+v.amount,0)!==(r.partnerId?r.partnerRate:0)"));
 assert.ok(page.includes("cpaLedgerReviews"));
 assert.ok(page.includes("latestReviews"));
});


test("CPA ledger review is audit-only and does not silently change money",()=>{
 const api=read("../../app/api/admin/ledger/reviews/route.ts");
 const form=read("../../components/admin/LedgerReviewForm.tsx");
 assert.ok(api.includes("db.insert(cpaLedgerReviews)"));
 assert.ok(api.includes("reviewerUserId: user.id"));
 assert.ok(api.includes("note: note.trim()"));
 assert.ok(api.includes('status === "RESOLVED"'));
 assert.ok(!api.includes("db.update(advertiserLedger)"));
 assert.ok(!api.includes("db.update(earnings)"));
 assert.ok(!api.includes("db.insert(advertiserLedger)"));
 assert.ok(!api.includes("db.insert(earnings)"));
 assert.ok(form.includes("검토 완료는 정산 장부의 자동 수정이 아닙니다."));
 assert.ok(form.includes("submitting.current || uncertain"));
 assert.ok(form.includes("response.status >= 500"));
 assert.ok(form.includes("검토 이력 새로고침"));
});


test("CPA mismatch review history remains attributable and paginated",()=>{
 const page=read("../../app/admin/ledger/page.tsx");
 const history=read("../../components/admin/LedgerReviewHistory.tsx");
 assert.ok(page.includes("reviewerUserId:cpaLedgerReviews.reviewerUserId"));
 assert.ok(page.includes("reviewerEmails.get(v.reviewerUserId)"));
 assert.ok(page.includes("reviewHistory.get(r.id)"));
 assert.ok(page.includes("latestReviews.get(r.id)?.status"));
 assert.ok(page.includes("장부 불일치 상세"));
 assert.ok(page.includes("광고비 차액"));
 assert.ok(page.includes("파트너 수익 차액"));
 assert.ok(history.includes("const pageSize = 10"));
 assert.ok(history.includes("entries.slice((page - 1) * pageSize, page * pageSize)"));
 assert.ok(history.includes("disabled={page===1}"));
 assert.ok(history.includes("disabled={page===totalPages}"));
});


test("CPA ledger reconciliation scopes dates, limits and stale review filters",()=>{
 const page=read("../../app/admin/ledger/page.tsx");
 assert.ok(page.includes("[50,100,250,500].includes(Number(params.limit))"));
 assert.ok(page.includes("?Number(params.limit):100"));
 assert.ok(page.includes("validDate(params.from"));
 assert.ok(page.includes("validDate(params.to"));
 assert.ok(page.includes("from>to"));
 assert.ok(page.includes("dateFilters.push(sql`false`)"));
 assert.ok(page.includes("gte(conversions.approvedAt"));
 assert.ok(page.includes("lte(conversions.approvedAt"));
 assert.ok(page.includes(".limit(reconcileLimit)"));
 assert.ok(page.includes("params.stale===\"1\""));
 assert.ok(page.includes("72*60*60*1000"));
 assert.ok(page.includes("검사 범위는"));
 assert.ok(page.includes("전체 기간의 모든 CPA 승인 건을 집계한 수치가 아닐 수 있습니다."));
});


test("CPA approval and payout use transactional audit trails before notifications",()=>{
 const conversion=read("../../app/api/admin/conversions/[id]/review/route.ts");
 const request=read("../../app/api/partner/settlements/route.ts");
 const payout=read("../../app/api/admin/settlements/[id]/review/route.ts");
 for(const [source,marker] of [[conversion,"tx.insert(auditLogs)"],[request,"tx.insert(auditLogs)"],[payout,"tx.insert(auditLogs)"]]){
  const transaction=source.indexOf("transaction(async tx");
  const audit=source.indexOf(marker,transaction);
  assert.ok(transaction>=0&&audit>transaction);
 }
 assert.ok(conversion.includes("tx.insert(advertiserLedger)"));
 assert.ok(conversion.includes("tx.insert(earnings)"));
 assert.ok(request.includes("tx.insert(settlementItems)"));
 assert.ok(payout.includes('set({status:"PAID"})'));
 assert.ok(payout.includes('set({status:"AVAILABLE"})'));
});


test("reviewed CPA ledger mismatches remain visibly unresolved until accounting matches",()=>{
 const page=read("../../app/admin/ledger/page.tsx");
 assert.ok(page.includes('latestReviews.get(r.id)?.status==="RESOLVED"?"검토 완료 · 불일치 지속"'));
 assert.ok(page.includes("const mismatches=reconciliationRows.filter(r=>mismatchReason(r).length>0)"));
 assert.ok(page.includes("검토 완료는 검토 기록의 상태이며, 광고비 또는 수익 장부가 자동으로 수정되었다는 뜻은 아닙니다."));
});


test("campaign status transitions persist administrator audit atomically",()=>{
 const source=read("../../app/api/admin/campaigns/[id]/status/route.ts");
 assert.ok(source.includes("const admin=await requireAdmin()"));
 assert.ok(source.includes("db.transaction(async tx=>"));
 assert.ok(source.includes("tx.insert(auditLogs)"));
 assert.ok(source.includes('action:"CAMPAIGN_STATUS_CHANGED"'));
 assert.ok(source.includes("actorUserId:admin.id"));
 assert.ok(source.includes("previousStatus:row.status,nextStatus:next"));
 assert.ok(source.indexOf("tx.insert(auditLogs)")>source.indexOf("tx.update(campaigns)"));
});


test("campaign configuration edits write audit in the same transaction",()=>{
 const source=read("../../app/api/admin/campaigns/[id]/route.ts");
 assert.ok(source.includes("const admin=await requireAdmin()"));
 assert.ok(source.includes("getDb().transaction(async tx=>"));
 assert.ok(source.includes('action:"CAMPAIGN_UPDATED"'));
 assert.ok(source.includes("actorUserId:admin.id"));
 assert.ok(source.includes("tx.insert(auditLogs)"));
 assert.ok(source.indexOf("tx.insert(auditLogs)")>source.indexOf("tx.update(campaigns)"));
});
