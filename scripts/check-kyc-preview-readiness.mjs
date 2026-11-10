#!/usr/bin/env node
// Offline readiness check: never connects to the database, Blob storage or a live API.
// Presence of credentials does not prove isolation from production.
import {isKycPreviewIsolationBlocked} from "../lib/security/kyc-preview-isolation.mjs";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";

export function checkReadiness(env){
 const checks={
  previewEnvironment:env.VERCEL_ENV==="preview",
  databaseConfigured:typeof env.DATABASE_URL==="string"&&env.DATABASE_URL.length>0,
  blobConfigured:typeof env.BLOB_READ_WRITE_TOKEN==="string"&&env.BLOB_READ_WRITE_TOKEN.length>0,
  operatorAttestation:env.PAYOUT_KYC_PREVIEW_ISOLATION_CONFIRMED==="enabled",
  uploadFeatureEnabled:env.PAYOUT_KYC_DOCUMENT_UPLOAD==="enabled",
 };
 // These optional identifiers are operator-provided non-secret metadata, never connection strings.
 const previewDbBranch=env.PAYOUT_KYC_PREVIEW_DB_BRANCH_ID??"";
 const productionDbBranch=env.PAYOUT_KYC_PRODUCTION_DB_BRANCH_ID??"";
 const previewBlobStore=env.PAYOUT_KYC_PREVIEW_BLOB_STORE_ID??"";
 const productionBlobStore=env.PAYOUT_KYC_PRODUCTION_BLOB_STORE_ID??"";
 checks.distinctDatabaseBranch= /^br-[a-z0-9-]+$/.test(previewDbBranch)&&/^br-[a-z0-9-]+$/.test(productionDbBranch)&&previewDbBranch!==productionDbBranch;
 checks.distinctBlobStore= /^store_[a-zA-Z0-9]+$/.test(previewBlobStore)&&/^store_[a-zA-Z0-9]+$/.test(productionBlobStore)&&previewBlobStore!==productionBlobStore;
 const configurationComplete=Object.values(checks).every(Boolean)&&!isKycPreviewIsolationBlocked(env);
 return {configurationComplete,checks,requiresManualIsolationVerification:true};
}

if(process.argv[1]&&resolve(fileURLToPath(import.meta.url))===resolve(process.argv[1])){
 const result=checkReadiness(process.env);
 process.stdout.write(JSON.stringify(result,null,2)+"\n");
 if(!result.configurationComplete)process.exitCode=1;
}
