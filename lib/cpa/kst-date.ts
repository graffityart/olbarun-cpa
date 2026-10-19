const KST_OFFSET_MS=9*60*60*1000;
export function toKstDate(value:Date):string{
 return new Date(value.getTime()+KST_OFFSET_MS).toISOString().slice(0,10);
}
export function isWithinKstDateRange(value:Date,from:string,to:string):boolean{
 const date=toKstDate(value);
 return (!from||date>=from)&&(!to||date<=to);
}
