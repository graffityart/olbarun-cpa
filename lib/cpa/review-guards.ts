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
