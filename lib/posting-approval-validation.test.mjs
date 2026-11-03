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
  assert.match(source,/FINANCE_ALREADY_POSTED","FINANCE_INCONSISTENT"\]\.includes\(code\)\?409/);
});
