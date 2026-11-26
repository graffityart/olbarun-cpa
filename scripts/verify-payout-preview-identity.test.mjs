import test from "node:test";
import assert from "node:assert/strict";
import { verifyPreviewIdentity } from "./verify-payout-preview-identity.mjs";
const host = "mypickup-payout-integration-isolated-qwuqtkzqw.vercel.app";
const sha = "bc340f9a2ab87c07cfe130cc065a501e3c661d37";
const valid = {projectId:"prj_FUz3cEPnss1fBzU6RTzCw8GUr0ic",url:host,target:null,readyState:"READY",meta:{githubCommitSha:sha,githubRepo:"olbarun-cpa",githubOrg:"graffityart"}};
test("verified isolated preview identity",()=>assert.equal(verifyPreviewIdentity(valid,host,sha),true));
for(const [name,patch] of Object.entries({project:{projectId:"other"},host:{url:"other.vercel.app"},production:{target:"production"},building:{readyState:"BUILDING"},commit:{meta:{...valid.meta,githubCommitSha:"0".repeat(40)}},repo:{meta:{...valid.meta,githubRepo:"other"}}})){
  test("reject "+name,()=>assert.throws(()=>verifyPreviewIdentity({...valid,...patch},host,sha)));
}
test("reject lookalike hostname",()=>assert.throws(()=>verifyPreviewIdentity(valid,host+".evil.invalid",sha)));

test("API verifies deployment with fixed origin and rejects redirects", async()=>{
  const {fetchVerifiedPreview}=await import("./verify-payout-preview-identity.mjs");
  assert.equal(await fetchVerifiedPreview(host,sha,"synthetic-token",async(url,options)=>{
    assert.equal(url.origin,"https://api.vercel.com");
    assert.equal(options.redirect,"error");
    assert.equal(options.headers.authorization,"Bearer synthetic-token");
    return {ok:true,json:async()=>valid};
  }),true);
});
test("API rejects missing token before network",async()=>{
  const {fetchVerifiedPreview}=await import("./verify-payout-preview-identity.mjs");
  await assert.rejects(fetchVerifiedPreview(host,sha,"",()=>assert.fail("network forbidden")));
});
test("API rejects unauthorized response",async()=>{
  const {fetchVerifiedPreview}=await import("./verify-payout-preview-identity.mjs");
  await assert.rejects(fetchVerifiedPreview(host,sha,"synthetic-token",async()=>({ok:false})));
});
