import test from "node:test";
import assert from "node:assert/strict";
import { validatePostingReviewInput } from "./posting-review-validation.mjs";

test("posting review validates malformed and unsupported payloads", () => {
  for (const body of [null, [], "APPROVED", 1]) assert.equal(validatePostingReviewInput(body), "INVALID_JSON");
  assert.equal(validatePostingReviewInput({ decision: "UNKNOWN" }), "INVALID_DECISION");
  assert.equal(validatePostingReviewInput({ decision: "REJECTED", reason: " " }), "REASON_REQUIRED");
  assert.equal(validatePostingReviewInput({ decision: "REVISION_REQUESTED", reason: "a".repeat(2001) }), "REASON_TOO_LONG");
});
test("posting review trims reason and allows boundary-length notes", () => {
  assert.deepEqual(validatePostingReviewInput({ decision: "APPROVED" }), { decision: "APPROVED", reason: "" });
  assert.deepEqual(validatePostingReviewInput({ decision: "REVISION_REQUESTED", reason: "  수정 필요  " }), { decision: "REVISION_REQUESTED", reason: "수정 필요" });
  assert.equal(validatePostingReviewInput({ decision: "REJECTED", reason: "a".repeat(2000) }).reason.length, 2000);
});
