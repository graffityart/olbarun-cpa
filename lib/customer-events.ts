import {sql} from "drizzle-orm";
import {getDb} from "@/db";
export type CustomerEvent={id:string;title:string;content:string;status:string;startsAt:Date|null;endsAt:Date|null;createdAt:Date};
export async function listPublicEvents(limit=30):Promise<CustomerEvent[]|null>{
 try{const rows=await getDb().execute(sql`SELECT id,title,content,status,starts_at AS "startsAt",ends_at AS "endsAt",created_at AS "createdAt" FROM customer_events WHERE status IN ('OPEN','ENDED') ORDER BY created_at DESC LIMIT ${Math.min(Math.max(limit,1),100)}`);return rows as unknown as CustomerEvent[];}
 catch(error){console.error("Events unavailable (migration pending?)",error);return null;}
}
