import test from "node:test";
import assert from "node:assert/strict";
import {checkReadiness} from "../../scripts/check-kyc-preview-readiness.mjs";

const isolatedFixture={
 VERCEL_ENV:"preview",
 DATABASE_URL:"fixture-only-db-not-real",
 BLOB_READ_WRITE_TOKEN:"fixture-only-blob-not-real",
 PAYOUT_KYC_PREVIEW_ISOLATION_CONFIRMED:"enabled",
 PAYOUT_KYC_DOCUMENT_UPLOAD:"enabled"
};

test("readiness checker reports complete configuration without proving isolation",()=>{
 const result=checkReadiness(isolatedFixture);
 assert.equal(result.configurationComplete,true);
 assert.equal(result.requiresManualIsolationVerification,true);
 assert.equal(JSON.stringify(result).includes("fixture-only"),false);
});

test("readiness checker rejects missing or incorrect preview configuration",()=>{
 for(const key of Object.keys(isolatedFixture)){
  assert.equal(checkReadiness({...isolatedFixture,[key]:undefined}).configurationComplete,false,key);
 }
 assert.equal(checkReadiness({...isolatedFixture,VERCEL_ENV:"production"}).configurationComplete,false);
 assert.equal(checkReadiness({...isolatedFixture,PAYOUT_KYC_PREVIEW_ISOLATION_CONFIRMED:"true"}).configurationComplete,false);
});
