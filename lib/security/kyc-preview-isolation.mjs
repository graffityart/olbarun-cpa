// Preview KYC access must fail closed until independent DB and Blob storage have been reviewed.
// Resource IDs are operator-provided metadata, not automatic proof of credential isolation.
export function isKycPreviewIsolationBlocked(env){
 if(env.VERCEL_ENV!=="preview")return false;
 if(env.PAYOUT_KYC_PREVIEW_ISOLATION_CONFIRMED!=="enabled")return true;
 // An attestation must never unlock every preview branch at once.
 if(env.VERCEL_GIT_COMMIT_REF!=="feature/partner-payout-verification")return true;
 const db=env.PAYOUT_KYC_PREVIEW_DB_BRANCH_ID??"";
 const prodDb=env.PAYOUT_KYC_PRODUCTION_DB_BRANCH_ID??"";
 const blob=env.PAYOUT_KYC_PREVIEW_BLOB_STORE_ID??"";
 const prodBlob=env.PAYOUT_KYC_PRODUCTION_BLOB_STORE_ID??"";
 const tokenStore=env.PAYOUT_KYC_BLOB_TOKEN_STORE_ID??"";
 return !(/^br-[a-z0-9-]+$/.test(db)&&/^br-[a-z0-9-]+$/.test(prodDb)&&db!==prodDb
  &&/^store_[a-zA-Z0-9]+$/.test(blob)&&/^store_[a-zA-Z0-9]+$/.test(prodBlob)&&blob!==prodBlob&&tokenStore===blob);
}
