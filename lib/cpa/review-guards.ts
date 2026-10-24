const MAX_DB_AMOUNT = 2147483647;

export function validCpaReviewRates(advertiserRate:number,partnerRate:number,platformMargin:number):boolean {
  return Number.isSafeInteger(advertiserRate) && advertiserRate>0 && advertiserRate<=MAX_DB_AMOUNT
    && Number.isSafeInteger(partnerRate) && partnerRate>=0 && partnerRate<=MAX_DB_AMOUNT
    && Number.isSafeInteger(platformMargin) && platformMargin>=0 && platformMargin<=MAX_DB_AMOUNT
    && partnerRate<=advertiserRate
    && platformMargin===advertiserRate-partnerRate;
}
export function canReviewCpaConversion(status:string):boolean {
  return status==="REVIEWING";
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
