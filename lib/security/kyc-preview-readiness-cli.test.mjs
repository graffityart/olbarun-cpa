import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const script=fileURLToPath(new URL("../../scripts/check-kyc-preview-readiness.mjs",import.meta.url));
const fixture={
 VERCEL_ENV:"preview",
 VERCEL_GIT_COMMIT_REF:"feature/partner-payout-verification",
 DATABASE_URL:"synthetic-test-db-do-not-connect",
 BLOB_READ_WRITE_TOKEN:"synthetic-test-blob-do-not-connect",
 PAYOUT_KYC_PREVIEW_ISOLATION_CONFIRMED:"enabled",
 PAYOUT_KYC_DOCUMENT_UPLOAD:"enabled",
 PAYOUT_KYC_PREVIEW_DB_BRANCH_ID:"br-preview-test",
 PAYOUT_KYC_PRODUCTION_DB_BRANCH_ID:"br-production-test",
 PAYOUT_KYC_PREVIEW_BLOB_STORE_ID:"store_previewTest",
 PAYOUT_KYC_BLOB_TOKEN_STORE_ID:"store_previewTest",
 PAYOUT_KYC_PRODUCTION_BLOB_STORE_ID:"store_productionTest"
};
function run(overrides={}){
 return spawnSync(process.execPath,[script],{
  encoding:"utf8",
  timeout:5000,
  env:{PATH:process.env.PATH,...fixture,...overrides}
 });
}

test("offline KYC readiness CLI succeeds only for complete preview configuration",()=>{
 const result=run();
 assert.equal(result.status,0,result.stderr);
 const output=JSON.parse(result.stdout);
 assert.equal(output.configurationComplete,true);
 assert.equal(output.requiresManualIsolationVerification,true);
 assert.equal(result.stdout.includes(fixture.DATABASE_URL),false);
 assert.equal(result.stdout.includes(fixture.BLOB_READ_WRITE_TOKEN),false);
});

test("offline KYC readiness CLI exits nonzero for missing isolation attestation",()=>{
 const result=run({PAYOUT_KYC_PREVIEW_ISOLATION_CONFIRMED:""});
 assert.equal(result.status,1,result.stderr);
 assert.equal(JSON.parse(result.stdout).checks.operatorAttestation,false);
});

test("offline KYC readiness CLI refuses production even when every other flag is enabled",()=>{
 const result=run({VERCEL_ENV:"production"});
 assert.equal(result.status,1,result.stderr);
 assert.equal(JSON.parse(result.stdout).checks.previewEnvironment,false);
});

test("offline KYC readiness CLI refuses missing DB or Blob settings",()=>{
 for(const key of ["DATABASE_URL","BLOB_READ_WRITE_TOKEN"]){
  const result=run({[key]:""});
  assert.equal(result.status,1,key+": "+result.stderr);
  assert.equal(JSON.parse(result.stdout).configurationComplete,false);
 }
});

test("readiness rejects identical DB branches or Blob stores",()=>{
 for(const key of ["PAYOUT_KYC_PREVIEW_DB_BRANCH_ID","PAYOUT_KYC_PREVIEW_BLOB_STORE_ID"]){
  const productionKey=key.replace("PREVIEW","PRODUCTION");
  const result=run({[key]:fixture[productionKey]});
  assert.equal(result.status,1,key);
  assert.equal(JSON.parse(result.stdout).configurationComplete,false);
 }
});

test("readiness rejects Blob token metadata pointing to the production store",()=>{
 const result=run({PAYOUT_KYC_BLOB_TOKEN_STORE_ID:fixture.PAYOUT_KYC_PRODUCTION_BLOB_STORE_ID});
 assert.equal(result.status,1);
 assert.equal(JSON.parse(result.stdout).checks.isolatedBlobTokenMetadata,false);
});
