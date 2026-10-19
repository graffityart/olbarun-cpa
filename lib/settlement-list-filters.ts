export type SettlementListParams = {status?:string;q?:string;audit?:string;page?:string};
export const settlementStatuses = ["ALL","REQUESTED","APPROVED","PAID","REJECTED"] as const;
export function normalizeSettlementListParams(input:SettlementListParams){
 const status=settlementStatuses.find(s=>s===input.status)??"ALL";
 const q=(input.q??"").trim().toLowerCase();
 const audit=input.audit==="MISSING"?"MISSING":"ALL";
 const parsed=Number(input.page);
 const page=Number.isSafeInteger(parsed)&&parsed>0?parsed:1;
 return {status,q,audit,page};
}
export function escapeSettlementLike(value:string){
 return value.replace(/[\\%_]/g,character=>"\\"+character);
}
export function settlementPageNumber(requested:number,total:number,pageSize=30){
 return Math.min(requested,Math.max(1,Math.ceil(total/pageSize)));
}
