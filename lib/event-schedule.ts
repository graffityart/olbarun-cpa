export function parseEventSchedule(body:Record<string,unknown>){
 const parse=(value:unknown)=>{if(value===null||value===undefined||value==="")return null;if(typeof value!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$/.test(value))throw new Error("INVALID_DATES");const d=new Date(value+":00+09:00");if(!Number.isFinite(d.getTime()))throw new Error("INVALID_DATES");return d;};
 const startsAt=parse(body.startsAt),endsAt=parse(body.endsAt);if(startsAt&&endsAt&&endsAt<startsAt)throw new Error("INVALID_DATES");return {startsAt,endsAt};
}
export function eventDateInput(date:unknown){if(!date)return "";const d=new Date(String(date));if(!Number.isFinite(d.getTime()))return "";return new Date(d.getTime()+9*3600000).toISOString().slice(0,16);}
