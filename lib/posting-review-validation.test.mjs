import { readFileSync } from "node:fs";
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


test("partner posting submission rejects oversized inputs and URL credentials", () => {
 const source = readFileSync(new URL("../app/api/partner/posting/submit/route.ts", import.meta.url), "utf8");
 assert.match(source, /title\.length>300\|\|postUrl\.length>2048\|\|\(note\?\.length\?\?0\)>5000/);
 assert.match(source, /parsed\.username\|\|parsed\.password/);
 assert.match(source, /\["http:","https:"\]\.includes\(parsed\.protocol\)/);
});

test("admin posting review keeps authorization outside the review error handler", () => {
 const source = readFileSync(new URL("../app/api/admin/posting/[id]/review/route.ts", import.meta.url), "utf8");
 assert.match(source, /const admin=await requireAdmin\(\);try\{requireSameOrigin\(request\)/);
 assert.doesNotMatch(source, /try\{requireSameOrigin\(request\);const admin=await requireAdmin\(\)/);
});


test("posting submission requires matching application state for first and revised submissions",()=>{
 const source=readFileSync(new URL("../app/api/partner/posting/submit/route.ts",import.meta.url),"utf8");
 assert.match(source,/if\(!existing&&application\.status!=="APPLIED"\)throw new Error\("APPLICATION_NOT_READY"\)/);
 assert.match(source,/if\(existing&&existing\.status==="REVISION_REQUESTED"&&application\.status!=="REVISION_REQUESTED"\)throw new Error\("APPLICATION_NOT_READY"\)/);
 assert.match(source,/if\(existing&&existing\.status==="SUBMITTED"\)throw new Error\("ALREADY_SUBMITTED"\)/);
 assert.match(source,/if\(existing&&existing\.status!=="REVISION_REQUESTED"\)throw new Error\("SUBMISSION_LOCKED"\)/);
 assert.match(source,/"SUBMISSION_LIMIT","APPLICATION_NOT_READY"\]\.includes\(code\)\?409/);
});
