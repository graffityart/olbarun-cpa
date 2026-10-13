import {sql} from "drizzle-orm";
import {getDb} from "@/db";
export type AdminEventRow={id:string;title:string;status:string;createdAt:Date;viewCount:number};
export async function searchAdminEvents(query:string,status:string,page:number){
 const q=query.trim().slice(0,100);
 const filter=["DRAFT","OPEN","ENDED"].includes(status)?status:"ALL";
 const safePage=Math.max(1,Math.min(100000,Math.trunc(page)||1));
 const where=sql`WHERE title ILIKE '%' || ${q} || '%' AND (${filter} = 'ALL' OR status = ${filter})`;
 const counts=await getDb().execute(sql`SELECT count(*)::integer AS total FROM customer_events ${where}`);
 const total=Number(counts[0]?.total??0);
 const maxPage=Math.max(1,Math.ceil(total/20));
 const currentPage=Math.min(safePage,maxPage);
 const offset=(currentPage-1)*20;
 const events=await getDb().execute(sql`SELECT id,title,status,created_at AS "createdAt",view_count AS "viewCount" FROM customer_events ${where} ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET ${offset}`);
 return {events:events as unknown as AdminEventRow[],total,currentPage};
}
