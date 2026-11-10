#!/usr/bin/env node
// Offline readiness check: never connects to the database, Blob storage or a live API.
// Presence of credentials does not prove isolation from production.
import {isKycPreviewIsolationBlocked} from "../lib/security/kyc-preview-isolation.mjs";

export function checkReadiness(env){
 const checks={
  previewEnvironment:env.VERCEL_ENV==="preview",
  databaseConfigured:typeof env.DATABASE_URL==="string"&&env.DATABASE_URL.length>0,
  blobConfigured:typeof env.BLOB_READ_WRITE_TOKEN==="string"&&env.BLOB_READ_WRITE_TOKEN.length>0,
  operatorAttestation:env.PAYOUT_KYC_PREVIEW_ISOLATION_CONFIRMED==="enabled",
  uploadFeatureEnabled:env.PAYOUT_KYC_DOCUMENT_UPLOAD==="enabled",
 };
 const ready=Object.values(checks).every(Boolean)&&!isKycPreviewIsolationBlocked(env);
 return {ready,checks,requiresManualIsolationVerification:true};
}

if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
 const result=checkReadiness(process.env);
 process.stdout.write(JSON.stringify(result,null,2)+"\n");
 if(!result.ready)process.exitCode=1;
}
