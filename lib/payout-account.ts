import {createHmac,timingSafeEqual} from "node:crypto";
export type PayoutAccount={bankName:string;accountNumber:string;accountHolder:string};
export function normalizePayoutAccount(input:PayoutAccount):PayoutAccount{
 return {bankName:input.bankName.normalize("NFKC").trim().replace(/\s+/g," ").toLowerCase(),accountNumber:input.accountNumber.replace(/[\s-]/g,""),accountHolder:input.accountHolder.normalize("NFKC").trim().replace(/\s+/g,"")};
}
export function validPayoutAccount(input:PayoutAccount):boolean{
 const a=normalizePayoutAccount(input);
 return a.bankName.length>0&&a.bankName.length<=50&&a.accountHolder.length>0&&a.accountHolder.length<=50&&/^\d{6,50}$/.test(a.accountNumber)&&!/[\u0000-\u001f\u007f]/.test(a.bankName+a.accountHolder);
}
export function payoutAccountFingerprint(input:PayoutAccount):string{
 const secret=process.env.PAYOUT_ACCOUNT_FINGERPRINT_SECRET;
 if(!secret||Buffer.byteLength(secret,"utf8")<32)throw new Error("PAYOUT_ACCOUNT_SECRET_MISSING");
 if(!validPayoutAccount(input))throw new Error("INVALID_PAYOUT_ACCOUNT");
 const a=normalizePayoutAccount(input);
 return createHmac("sha256",secret).update(JSON.stringify([a.bankName,a.accountNumber,a.accountHolder])).digest("hex");
}
export function payoutAccountMatches(input:PayoutAccount,fingerprint:unknown):boolean{
 const actualHex=payoutAccountFingerprint(input);
 if(typeof fingerprint!=="string"||!/^[0-9a-f]{64}$/.test(fingerprint))return false;
 const expected=Buffer.from(fingerprint,"hex"),actual=Buffer.from(actualHex,"hex");
 return timingSafeEqual(expected,actual);
}
