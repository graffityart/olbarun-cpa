import test from "node:test";
import assert from "node:assert/strict";
import { validatePostingLimits } from "./posting-limits.mjs";

const valid = {mediaType:"BLOG",perPartnerLimit:2,participantLimit:3,totalSubmissionLimit:6,postingReviewDays:3,revisionLimit:2};
test("accepts valid posting limits and optional capacities", () => {
  assert.equal(validatePostingLimits(valid), null);
  assert.equal(validatePostingLimits({}), null);
  assert.equal(validatePostingLimits({...valid,revisionLimit:0}), null);
});
test("rejects invalid media and review settings", () => {
  assert.equal(validatePostingLimits({...valid,mediaType:"VIDEO"}),"INVALID_POSTING_MEDIA_TYPE");
  for(const patch of [{perPartnerLimit:0},{perPartnerLimit:1.5},{postingReviewDays:0},{revisionLimit:-1},{revisionLimit:1.2}])
    assert.equal(validatePostingLimits({...valid,...patch}),"INVALID_POSTING_SETTINGS");
});
test("rejects malformed capacity values", () => {
  for(const patch of [{participantLimit:0},{participantLimit:-1},{totalSubmissionLimit:"abc"},{totalSubmissionLimit:1.5}])
    assert.equal(validatePostingLimits({...valid,...patch}),"INVALID_LIMIT");
});
test("rejects capacity conflicts at the boundary", () => {
  assert.equal(validatePostingLimits({...valid,totalSubmissionLimit:1}),"INVALID_POSTING_LIMITS");
  assert.equal(validatePostingLimits({...valid,totalSubmissionLimit:2}),"INVALID_POSTING_LIMITS");
  assert.equal(validatePostingLimits({...valid,totalSubmissionLimit:3,perPartnerLimit:3}),null);
});
