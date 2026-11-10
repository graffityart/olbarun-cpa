// Preview KYC access must fail closed until independent DB and Blob storage have been reviewed.
// The flag is an operator attestation, not an automatic isolation check.
export function isKycPreviewIsolationBlocked(env){
 return env.VERCEL_ENV==="preview"&&env.PAYOUT_KYC_PREVIEW_ISOLATION_CONFIRMED!=="enabled";
}
