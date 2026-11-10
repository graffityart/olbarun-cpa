import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const script=fileURLToPath(new URL("../../scripts/check-kyc-preview-readiness.mjs",import.meta.url));
const fixture={
 VERCEL_ENV:"preview",
 DATABASE_URL:"synthetic-test-db-do-not-connect",
 BLOB_READ_WRITE_TOKEN:"synthetic-test-blob-do-not-connect",
 PAYOUT_KYC_PREVIEW_ISOLATION_CONFIRMED:"enabled",
 PAYOUT_KYC_DOCUMENT_UPLOAD:"enabled"
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
