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
 const configurationComplete=Object.values(checks).every(Boolean)&&!isKycPreviewIsolationBlocked(env);
 return {configurationComplete,checks,requiresManualIsolationVerification:true};
}

if(process.argv[1]&&resolve(fileURLToPath(import.meta.url))===resolve(process.argv[1])){
 const result=checkReadiness(process.env);
 process.stdout.write(JSON.stringify(result,null,2)+"\n");
 if(!result.configurationComplete)process.exitCode=1;
}
