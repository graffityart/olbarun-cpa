const MAX_DB_AMOUNT = 2147483647;

export function validCpaReviewRates(advertiserRate:number,partnerRate:number,platformMargin:number):boolean {
  return Number.isSafeInteger(advertiserRate) && advertiserRate>0 && advertiserRate<=MAX_DB_AMOUNT
    && Number.isSafeInteger(partnerRate) && partnerRate>=0 && partnerRate<=MAX_DB_AMOUNT
    && Number.isSafeInteger(platformMargin) && platformMargin>=0 && platformMargin<=MAX_DB_AMOUNT
    && partnerRate<=advertiserRate
    && platformMargin===advertiserRate-partnerRate;
}
export function canReviewCpaConversion(status:string):boolean {
  return status==="REVIEWING" || status==="REJECTION_REQUESTED";
}

export function validCpaCampaignRates(advertiserRate:number,partnerRate:number,minimumMargin:number):boolean {
  return validCpaReviewRates(advertiserRate,partnerRate,advertiserRate-partnerRate)
    && Number.isSafeInteger(minimumMargin)
    && minimumMargin>=0
    && minimumMargin<=MAX_DB_AMOUNT
    && advertiserRate-partnerRate>=minimumMargin;
}

/** Validate review input on the server, regardless of client-side controls. */
export function validCpaReviewReason(decision:string, reason:unknown):boolean {
  if (decision!=="APPROVED" && decision!=="REJECTED") return false;
  if (reason!==undefined && typeof reason!=="string") return false;
  const normalized=typeof reason==="string"?reason.trim():"";
  return normalized.length<=500 && (decision!=="REJECTED" || normalized.length>0);
}

/** Only permit debits that fit the ledger's integer balanceAfter column. */
export function validCpaDebitBalance(balance:number, advertiserRate:number):boolean {
  return Number.isSafeInteger(balance) && balance>=0
    && Number.isSafeInteger(advertiserRate) && advertiserRate>0 && advertiserRate<=MAX_DB_AMOUNT
    && balance>=advertiserRate
    && balance-advertiserRate<=MAX_DB_AMOUNT;
}

/** Positive CPA earnings must have a linked partner and its user account. */
export function validCpaEarningRecipient(partnerRate: number, partnerId: string | null, partnerUserId: string | null): boolean {
  if (!Number.isSafeInteger(partnerRate) || partnerRate < 0 || partnerRate > MAX_DB_AMOUNT) return false;
  if (partnerRate === 0) return true;
  return typeof partnerId === "string" && partnerId.trim().length > 0
    && typeof partnerUserId === "string" && partnerUserId.trim().length > 0;
}
