import {sql} from "drizzle-orm";
import {getDb} from "@/db";
export type CustomerEvent={id:string;title:string;content:string;status:string;startsAt:Date|null;endsAt:Date|null;createdAt:Date;viewCount:number};
export async function listPublicEvents(limit=30):Promise<CustomerEvent[]|null>{
 try{const rows=await getDb().execute(sql`SELECT id,title,content,status,view_count AS "viewCount",starts_at AS "startsAt",ends_at AS "endsAt",created_at AS "createdAt" FROM customer_events WHERE status IN ('OPEN','ENDED') ORDER BY created_at DESC LIMIT ${Math.min(Math.max(limit,1),100)}`);return rows as unknown as CustomerEvent[];}
 catch(error){console.error("Events unavailable (migration pending?)",error);return null;}
}

export async function getPublicEvent(id:string):Promise<CustomerEvent|null>{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return null;
 try{
  const rows=await getDb().execute(sql`SELECT id,title,content,status,view_count AS "viewCount",starts_at AS "startsAt",ends_at AS "endsAt",created_at AS "createdAt" FROM customer_events WHERE id=${id}::uuid AND status IN ('OPEN','ENDED') LIMIT 1`);
  return rows.length?rows[0] as unknown as CustomerEvent:null;
 }catch(error){console.error("Event detail unavailable",error);return null;}
}

export async function searchPublicEvents(query:string,page:number):Promise<{events:CustomerEvent[];total:number}|null>{
 const term=query.trim().slice(0,100);
 const pageNumber=Math.max(1,Math.min(100000,Math.trunc(page)||1));
 const offset=(pageNumber-1)*10;
 try{
  const countRows=await getDb().execute(sql`SELECT count(*)::integer AS total FROM customer_events WHERE status IN ('OPEN','ENDED') AND strpos(lower(title), lower(${term})) > 0`);
  const rows=await getDb().execute(sql`SELECT id,title,content,status,view_count AS "viewCount",starts_at AS "startsAt",ends_at AS "endsAt",created_at AS "createdAt" FROM customer_events WHERE status IN ('OPEN','ENDED') AND strpos(lower(title), lower(${term})) > 0 ORDER BY created_at DESC,id DESC LIMIT 10 OFFSET ${offset}`);
  return {events:rows as unknown as CustomerEvent[],total:Number(countRows[0]?.total??0)};
 }catch(error){console.error("Event search unavailable",error);return null;}
}
