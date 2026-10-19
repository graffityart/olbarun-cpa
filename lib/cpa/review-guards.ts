export function validCpaReviewRates(advertiserRate:number,partnerRate:number,platformMargin:number):boolean {
  return Number.isSafeInteger(advertiserRate) && advertiserRate>0
    && Number.isSafeInteger(partnerRate) && partnerRate>=0
    && Number.isSafeInteger(platformMargin) && platformMargin>=0
    && partnerRate<=advertiserRate
    && platformMargin===advertiserRate-partnerRate;
}
export function canReviewCpaConversion(status:string):boolean {
  return status==="REVIEWING";
}
