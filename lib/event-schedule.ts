const SEOUL_OFFSET_MS=9*60*60*1000;
function parseKoreaDateTime(value:unknown):Date|null{
 if(value===null||value===undefined||value==="")return null;
 if(typeof value!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$/.test(value))throw new Error("INVALID_DATES");
 const date=new Date(value+":00+09:00");
 if(!Number.isFinite(date.getTime()))throw new Error("INVALID_DATES");
 const normalized=new Date(date.getTime()+SEOUL_OFFSET_MS).toISOString().slice(0,16);
 if(normalized!==value)throw new Error("INVALID_DATES");
 return date;
}
export function parseEventSchedule(body:Record<string,unknown>){
 const startsAt=parseKoreaDateTime(body.startsAt);
 const endsAt=parseKoreaDateTime(body.endsAt);
 if(startsAt&&endsAt&&endsAt.getTime()<startsAt.getTime())throw new Error("INVALID_DATES");
 return {startsAt,endsAt};
}
export function eventDateInput(date:unknown){
 if(!date)return "";
 const parsed=new Date(String(date));
 if(!Number.isFinite(parsed.getTime()))return "";
 return new Date(parsed.getTime()+SEOUL_OFFSET_MS).toISOString().slice(0,16);
}
