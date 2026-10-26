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
