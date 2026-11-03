import test from "node:test";
import assert from "node:assert/strict";
import {validatePostingApproval} from "./posting-approval-validation.mjs";
test("posting approval rejects invalid rates", () => {
  for (const [advertiserRate, partnerRate] of [[0,0],[-1,0],[100,101],[100,-1],[1.5,1],[100,1.1],[undefined,0]]) {
    assert.equal(validatePostingApproval({advertiserRate,partnerRate,balance:1000}),"RATE_NOT_READY");
  }
});
test("posting approval rejects insufficient balance and computes exact debit", () => {
  assert.equal(validatePostingApproval({advertiserRate:1000,partnerRate:700,balance:999}),"ADVERTISER_BALANCE_INSUFFICIENT");
  assert.deepEqual(validatePostingApproval({advertiserRate:1000,partnerRate:700,balance:1000}),{advertiserRate:1000,partnerRate:700,balanceAfter:0});
  assert.deepEqual(validatePostingApproval({advertiserRate:1000,partnerRate:0,balance:5000}),{advertiserRate:1000,partnerRate:0,balanceAfter:4000});
});


test("posting approval keeps advertiser debit and partner earning in one locked transaction", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../app/api/admin/posting/[id]/review/route.ts", import.meta.url), "utf8");
  assert.match(source, /db\.transaction\(async tx=>\{/);
  assert.match(source, /pg_advisory_xact_lock\(hashtext\(\$\{`posting:\$\{id\}`\}\)\)/);
  assert.match(source, /pg_advisory_xact_lock\(hashtext\(\$\{`advertiser:\$\{current\.advertiserId\}`\}\)\)/);
  assert.match(source, /if\(existingLedger\|\|existingEarning\)throw new Error\("FINANCE_ALREADY_POSTED"\)/);
  const debit=source.indexOf("await tx.insert(advertiserLedger)");
  const credit=source.indexOf("await tx.insert(earnings)");
  const review=source.indexOf("await tx.insert(postingReviews)");
  assert.ok(debit>0&&credit>debit&&review>credit,"financial postings and review stay inside the transaction");
  assert.match(source, /if\(rate!\.partnerRate>0\)await tx\.insert\(earnings\)/);
});


test("repeated posting approval verifies previously recorded financial entries", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../app/api/admin/posting/[id]/review/route.ts", import.meta.url), "utf8");
  const start=source.indexOf("if(recordedReview){");
  const end=source.indexOf("alreadyProcessed:true};}",start);
  assert.ok(start>0&&end>start,"idempotent approval checks financial entries");
  const branch=source.slice(start,end);
  assert.match(branch,/decision==="APPROVED"/);
  assert.match(branch,/advertiserLedger\.postingSubmissionId,id/);
  assert.match(branch,/earnings\.postingSubmissionId,id/);
  assert.match(branch,/FINANCE_INCONSISTENT/);
  assert.match(source,/FINANCE_ALREADY_POSTED","FINANCE_INCONSISTENT","APPLICATION_STATE_MISMATCH"\]\.includes\(code\)\?409/);
});


test("idempotent posting approval checks historical audit amounts rather than current rates", async () => {
 const {readFileSync}=await import("node:fs");
 const source=readFileSync(new URL("../app/api/admin/posting/[id]/review/route.ts",import.meta.url),"utf8");
 const start=source.indexOf("if(recordedReview){");
 const end=source.indexOf("alreadyProcessed:true};}",start);
 const branch=source.slice(start,end);
 assert.match(branch,/auditLogs\.action,"POSTING_APPROVED"/);
 assert.match(branch,/audit\?\.metadata\?\.advertiserRate/);
 assert.match(branch,/audit\?\.metadata\?\.partnerRate/);
 assert.match(branch,/debits\.length!==1/);
 assert.match(branch,/credits\.length!==\(historicPartnerRate>0\?1:0\)/);
 assert.doesNotMatch(branch,/campaignRates\.partnerBaseRate/);
});


test("partner earnings shows confirmed posting revenue without counting cancelled items", async () => {
 const {readFileSync}=await import("node:fs");
 const source=readFileSync(new URL("../app/partner/earnings/page.tsx",import.meta.url),"utf8");
 assert.match(source,/postingSubmissionId\} is not null and \$\{earnings\.status\}<>\x27CANCELLED\x27/);
 assert.match(source,/\[\x27포스팅 누적 수익\x27,summary\?\.posting/);
 assert.match(source,/출금 처리 중 및 지급 완료 포함/);
});


test("posting available earnings exclude pending payouts, paid and cancelled amounts", async () => {
 const {readFileSync}=await import("node:fs");
 const source=readFileSync(new URL("../app/partner/earnings/page.tsx",import.meta.url),"utf8");
 assert.match(source,/postingAvailable:sql<number>`coalesce\(sum\(case when \$\{earnings\.postingSubmissionId\} is not null and \$\{earnings\.status\}=\x27AVAILABLE\x27/);
 assert.match(source,/\[\x27포스팅 출금 가능\x27,summary\?\.postingAvailable/);
 assert.match(source,/\[\x27포스팅 누적 수익\x27,summary\?\.posting/);
});


test("posting approval selects the currently effective campaign rate with deterministic priority", async () => {
 const {readFileSync}=await import("node:fs");
 const review=readFileSync(new URL("../app/api/admin/posting/[id]/review/route.ts",import.meta.url),"utf8");
 const listing=readFileSync(new URL("../app/partner/posting/page.tsx",import.meta.url),"utf8");
 assert.match(review,/lte\(campaignRates\.effectiveFrom,new Date\(\)\)/);
 assert.match(review,/or\(isNull\(campaignRates\.effectiveTo\),gt\(campaignRates\.effectiveTo,new Date\(\)\)\)/);
 assert.match(review,/orderBy\(desc\(campaignRates\.effectiveFrom\),desc\(campaignRates\.createdAt\),desc\(campaignRates\.id\)\)/);
 assert.match(listing,/effective_from<=now\(\) and \(effective_to is null or effective_to>now\(\)\)/);
 assert.match(listing,/order by effective_from desc,created_at desc,id desc limit 1/);
});


test("posting review blocks application/submission state mismatches before approval accounting",async()=>{
 const {readFileSync}=await import("node:fs");
 const source=readFileSync(new URL("../app/api/admin/posting/[id]/review/route.ts",import.meta.url),"utf8");
 assert.match(source,/applicationStatus:postingApplications\.status/);
 assert.match(source,/if\(current\.applicationStatus!==current\.currentStatus\)throw new Error\("APPLICATION_STATE_MISMATCH"\)/);
 assert.ok(source.indexOf('throw new Error("APPLICATION_STATE_MISMATCH")')<source.indexOf("await tx.insert(advertiserLedger)"));
 assert.match(source,/"APPLICATION_STATE_MISMATCH"\]\.includes\(code\)\?409/);
});


test("admin posting review page hides review controls for inconsistent application state",async()=>{
 const {readFileSync}=await import("node:fs");
 const page=readFileSync(new URL("../app/admin/posting/[id]/page.tsx",import.meta.url),"utf8");
 const api=readFileSync(new URL("../app/api/admin/posting/[id]/review/route.ts",import.meta.url),"utf8");
 assert.match(page,/applicationStatus:postingApplications\.status/);
 assert.match(page,/canApprove=row\.status==="SUBMITTED"&&row\.applicationStatus==="SUBMITTED"/);
 assert.match(page,/row\.status==="SUBMITTED"&&row\.applicationStatus==="SUBMITTED"\?<PostingReviewForm/);
 assert.match(page,/row\.status!==row\.applicationStatus\?"신청 상태와 제출 상태가 일치하지 않습니다/);
 assert.match(api,/if\(current\.applicationStatus!==current\.currentStatus\)throw new Error\("APPLICATION_STATE_MISMATCH"\)/);
});


test("approved posting earnings flow into partner balance and full settlement reservation",async()=>{
 const {readFileSync}=await import("node:fs");
 const approval=readFileSync(new URL("../app/api/admin/posting/[id]/review/route.ts",import.meta.url),"utf8");
 const earningsPage=readFileSync(new URL("../app/partner/earnings/page.tsx",import.meta.url),"utf8");
 const settlement=readFileSync(new URL("../app/api/partner/settlements/route.ts",import.meta.url),"utf8");
 assert.match(approval,/postingSubmissionId:id,type:"POSTING_APPROVAL",amount:rate!\.partnerRate,status:"AVAILABLE"/);
 assert.match(earningsPage,/postingAvailable:sql<number>\x60coalesce\(sum\(case when \$\{earnings\.postingSubmissionId\} is not null and \$\{earnings\.status\}='AVAILABLE'/);
 assert.match(settlement,/eq\(earnings\.partnerId,user\.partnerId!\),eq\(earnings\.status,"AVAILABLE"\)/);
 assert.match(settlement,/BigInt\(amount\)!==total/);
 assert.match(settlement,/await tx\.update\(earnings\)\.set\(\{status:"HOLD"\}\)/);
 assert.match(settlement,/await tx\.insert\(settlementItems\)\.values\(\{settlementId:settlement\.id,earningId:earning\.id/);
});


test("posting settlement lifecycle preserves earnings through approval, payout and rejection",async()=>{
 const {readFileSync}=await import("node:fs");
 const source=readFileSync(new URL("../app/api/admin/settlements/[id]/review/route.ts",import.meta.url),"utf8");
 const status=readFileSync(new URL("../app/api/admin/settlements/[id]/status/route.ts",import.meta.url),"utf8");
 assert.match(source,/if\(action==="APPROVE"\)\{/);
 assert.match(source,/eq\(earnings\.status,"HOLD"\)/);
 assert.match(source,/\.set\(\{status:"APPROVED",approvedAt:new Date\(\)\}\)/);
 assert.match(source,/\.set\(\{status:"PAID"\}\)\.where\(and\(eq\(earnings\.id,item\.earningId\),eq\(earnings\.status,"HOLD"\)\)\)/);
 assert.match(source,/\.set\(\{status:"AVAILABLE"\}\)\.where\(and\(eq\(earnings\.id,item\.earningId\),eq\(earnings\.status,"HOLD"\)\)\)/);
 assert.match(status,/row\.status === "PAID" \? "PAID" : row\.status === "REJECTED" \? "AVAILABLE"/);
 assert.match(status,/\["REQUESTED", "APPROVED"\]\.includes\(row\.status\) \? "HOLD"/);
});


test("admin posting preview uses the same active rate window and priority as approval",async()=>{
 const {readFileSync}=await import("node:fs");
 const page=readFileSync(new URL("../app/admin/posting/[id]/page.tsx",import.meta.url),"utf8");
 const review=readFileSync(new URL("../app/api/admin/posting/[id]/review/route.ts",import.meta.url),"utf8");
 const active="effective_from<=now() and (effective_to is null or effective_to>now())";
 const priority="order by effective_from desc,created_at desc,id desc limit 1";
 assert.equal(page.split(active).length-1,2,"both advertiser and partner preview rates must be currently effective");
 assert.equal(page.split(priority).length-1,2,"both preview rates must use deterministic priority");
 assert.match(page,/advertiserRate:sql<number\|null>\x60\(select advertiser_rate from campaign_rates/);
 assert.match(page,/partnerRate:sql<number\|null>\x60\(select partner_base_rate from campaign_rates/);
 assert.match(review,/lte\(campaignRates\.effectiveFrom,new Date\(\)\)/);
 assert.match(review,/or\(isNull\(campaignRates\.effectiveTo\),gt\(campaignRates\.effectiveTo,new Date\(\)\)\)/);
 assert.match(review,/orderBy\(desc\(campaignRates\.effectiveFrom\),desc\(campaignRates\.createdAt\),desc\(campaignRates\.id\)\)/);
});


test("admin posting preview never treats a missing partner rate as zero",async()=>{
 const {readFileSync}=await import("node:fs");
 const page=readFileSync(new URL("../app/admin/posting/[id]/page.tsx",import.meta.url),"utf8");
 const api=readFileSync(new URL("../app/api/admin/posting/[id]/review/route.ts",import.meta.url),"utf8");
 assert.match(page,/rateValid=row\.advertiserRate!==null&&row\.partnerRate!==null&&Number\.isSafeInteger\(advertiserRate\)/);
 assert.match(page,/canApprove=row\.status==="SUBMITTED"&&row\.applicationStatus==="SUBMITTED"&&!alreadyPaid&&rateValid&&balance>=advertiserRate/);
 assert.match(api,/validatePostingApproval\(\{advertiserRate:rate\?\.advertiserRate,partnerRate:rate\?\.partnerRate,balance:Number\.MAX_SAFE_INTEGER\}\)==="RATE_NOT_READY"/);
});
