import test from "node:test";
import assert from "node:assert/strict";
import {checkReadiness} from "../../scripts/check-kyc-preview-readiness.mjs";

const isolatedFixture={
 VERCEL_ENV:"preview",
 VERCEL_GIT_COMMIT_REF:"feature/partner-payout-verification",
 DATABASE_URL:"fixture-only-db-not-real",
 BLOB_READ_WRITE_TOKEN:"fixture-only-blob-not-real",
 PAYOUT_KYC_PREVIEW_ISOLATION_CONFIRMED:"enabled",
 PAYOUT_KYC_DOCUMENT_UPLOAD:"enabled",
 PAYOUT_KYC_PREVIEW_DB_BRANCH_ID:"br-preview-test",
 PAYOUT_KYC_PRODUCTION_DB_BRANCH_ID:"br-production-test",
 PAYOUT_KYC_PREVIEW_BLOB_STORE_ID:"store_previewTest",
 PAYOUT_KYC_PRODUCTION_BLOB_STORE_ID:"store_productionTest"
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

test("readiness rejects identical DB branches or Blob stores",()=>{
 for(const key of ["PAYOUT_KYC_PREVIEW_DB_BRANCH_ID","PAYOUT_KYC_PREVIEW_BLOB_STORE_ID"]){
  const productionKey=key.replace("PREVIEW","PRODUCTION");
  assert.equal(checkReadiness({...isolatedFixture,[key]:isolatedFixture[productionKey]}).configurationComplete,false,key);
 }
});

test("readiness diagnostics explicitly identify a wrong Preview branch",()=>{
 const result=checkReadiness({...isolatedFixture,VERCEL_GIT_COMMIT_REF:"feature/unrelated"});
 assert.equal(result.configurationComplete,false);
 assert.equal(result.checks.verificationBranch,false);
 assert.equal(result.requiresManualIsolationVerification,true);
});
