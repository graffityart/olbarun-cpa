export type SettlementListParams = {status?:string;q?:string;audit?:string;page?:string;from?:string;to?:string};
export const settlementStatuses = ["ALL","REQUESTED","APPROVED","PAID","REJECTED"] as const;
export function normalizeSettlementListParams(input:SettlementListParams){
 const status=settlementStatuses.find(s=>s===input.status)??"ALL";
 const q=(input.q??"").trim().toLowerCase();
 const audit=input.audit==="MISSING"?"MISSING":"ALL";
 const parsed=input.page?Number(input.page):1;
 const page=Number.isSafeInteger(parsed)&&parsed>0?parsed:1;
 const validDate=(v?:string)=>v&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+"T00:00:00Z"))&&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v?v:"";
 const from=validDate(input.from),to=validDate(input.to);
 return {status,q,audit,page,from:from&&to&&from>to?"":from,to:from&&to&&from>to?"":to};
}
export function escapeSettlementLike(value:string){
 return value.replace(/[\\%_]/g,character=>"\\"+character);
}
export function settlementPageNumber(requested:number,total:number,pageSize=30){
 const maxPage=Math.max(1,Math.ceil(total/pageSize));
 return Number.isSafeInteger(requested)&&requested>0?Math.min(requested,maxPage):1;
}
