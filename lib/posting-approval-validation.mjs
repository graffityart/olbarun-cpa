export function validatePostingApproval({ advertiserRate, partnerRate, balance }) {
  if (!Number.isSafeInteger(advertiserRate) || advertiserRate <= 0 ||
      !Number.isSafeInteger(partnerRate) || partnerRate < 0 ||
      partnerRate > advertiserRate) return "RATE_NOT_READY";
  if (!Number.isSafeInteger(balance) || balance < advertiserRate) return "ADVERTISER_BALANCE_INSUFFICIENT";
  return { advertiserRate, partnerRate, balanceAfter: balance - advertiserRate };
}
