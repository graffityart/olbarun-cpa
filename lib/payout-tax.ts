export type PayoutTaxMode="INDIVIDUAL"|"BUSINESS";
export type PayoutEstimate={baseAmount:number;taxAdjustment:number;estimatedPayment:number};
export function estimatePayout(baseAmount:number,mode:PayoutTaxMode):PayoutEstimate{
 if(!Number.isSafeInteger(baseAmount)||baseAmount<0)throw new RangeError("INVALID_PAYOUT_AMOUNT");
 const taxAdjustment=mode==="INDIVIDUAL"?-Math.floor(baseAmount*33/1000):mode==="BUSINESS"?Math.floor(baseAmount/10):NaN;
 if(!Number.isSafeInteger(taxAdjustment))throw new RangeError("INVALID_TAX_MODE");
 const estimatedPayment=baseAmount+taxAdjustment;
 if(!Number.isSafeInteger(estimatedPayment))throw new RangeError("INVALID_PAYOUT_AMOUNT");
 return {baseAmount,taxAdjustment,estimatedPayment};
}
