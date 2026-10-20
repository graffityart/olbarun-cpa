import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const source = readFileSync(new URL("./settlement-validation.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(js, { exports });
const { isValidSettlementAmount, sumSettlementItems, settlementAmountsMatch, canReviewSettlement, isValidSettlementReviewRequest, canStartSettlement, isSettlementPending } = exports;

test("accepts valid integer amounts and rejects invalid amounts", () => {
  for (const value of [1, 1000, 2147483647]) assert.equal(isValidSettlementAmount(value), true);
  for (const value of [0, -1, 1.5, NaN, Infinity, "100", 2147483648]) assert.equal(isValidSettlementAmount(value), false);
});

test("sums valid earnings without number precision loss", () => {
  assert.equal(sumSettlementItems([100, 200, 300]), 600n);
  assert.equal(sumSettlementItems([2147483647]), 2147483647n);
  assert.equal(sumSettlementItems([]), null);
  assert.equal(sumSettlementItems([2147483647, 1]), null);
  assert.equal(sumSettlementItems([100, -1]), null);
});

test("requires exact requested, paid and deduction amounts", () => {
  assert.equal(settlementAmountsMatch([100, 200], 300, 300, 0), true);
  assert.equal(settlementAmountsMatch([100, 200], 300, 270, 30), true);
  assert.equal(settlementAmountsMatch([100, 200], 301, 300, 0), false);
  assert.equal(settlementAmountsMatch([100, 200], 300, 301, 0), false);
  assert.equal(settlementAmountsMatch([100, 200], 300, 200, -1), false);
  assert.equal(settlementAmountsMatch([], 300, 300, 0), false);
});

test("allows only expected settlement state transitions", () => {
  const statuses = ["REQUESTED", "APPROVED", "PAID", "REJECTED"];
  const actions = ["APPROVE", "PAID", "REJECT"];
  for (const status of statuses) for (const action of actions) {
    const expected = status === "REQUESTED" && (action === "APPROVE" || action === "REJECT") ||
      status === "APPROVED" && action === "PAID";
    assert.equal(canReviewSettlement(status, action), expected, `${status} / ${action}`);
  }
});

test("requires explicit confirmation only for paid settlement requests", () => {
  for (const action of ["APPROVE", "REJECT"]) assert.equal(isValidSettlementReviewRequest({action}), true);
  assert.equal(isValidSettlementReviewRequest({action:"PAID",transferConfirmed:true}), true);
  for (const value of [
    null, [], {}, {action:"UNKNOWN"}, {action:"PAID"}, {action:"PAID",transferConfirmed:false},
    {action:"PAID",transferConfirmed:"true"}, {action:"PAID",transferConfirmed:1},
  ]) assert.equal(isValidSettlementReviewRequest(value), false);
});

test("blocks a new settlement while another request is pending", () => {
  assert.equal(canStartSettlement([]), true);
  assert.equal(canStartSettlement(["PAID", "REJECTED"]), true);
  assert.equal(canStartSettlement(["REQUESTED"]), false);
  assert.equal(canStartSettlement(["APPROVED"]), false);
  assert.equal(canStartSettlement(["PAID", "APPROVED"]), false);
  assert.equal(isSettlementPending("REQUESTED"), true);
  assert.equal(isSettlementPending("APPROVED"), true);
  assert.equal(isSettlementPending("PAID"), false);
  assert.equal(isSettlementPending("REJECTED"), false);
});

test("completed settlements allow a new request", () => {
  assert.equal(canStartSettlement(["PAID", "REJECTED"]), true);
});

test("rejects fractional, overflowing and inconsistent payout breakdowns", () => {
  assert.equal(settlementAmountsMatch([100, 200], 300, 299, 1), true);
  assert.equal(settlementAmountsMatch([100, 200], 300, 299.5, 0.5), false);
  assert.equal(settlementAmountsMatch([100, 200], 300, 300, 1), false);
  assert.equal(settlementAmountsMatch([2147483647, 1], 2147483647, 2147483647, 0), false);
});

test("prevents repeating completed settlement actions", () => {
  for (const status of ["PAID", "REJECTED"]) {
    for (const action of ["APPROVE", "PAID", "REJECT"]) {
      assert.equal(canReviewSettlement(status, action), false);
    }
  }
});
