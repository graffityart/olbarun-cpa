import {sql} from "drizzle-orm";
import {getDb} from "@/db";
import {quickUser,quickError,uuid} from "@/lib/quick";
import {requireSameOrigin} from "@/lib/security/origin";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  requireSameOrigin(request);const admin=await quickUser(true);
  const id=uuid((await params).id),body=await request.json();
  const decision=String(body.decision??""),note=String(body.note??"").trim();
  if(!["APPROVED","REJECTED"].includes(decision)||note.length>2000||(decision==="REJECTED"&&!note))return Response.json({error:"INVALID_INPUT"},{status:400});
  const rows=await getDb().execute(sql`update quick_jobs set approval_status=${decision},reviewed_by=${admin.id},reviewed_at=now(),review_note=${note||null},status='DRAFT',updated_at=now()
    where id=${id} and registration_source='ADVERTISER' and approval_status='PENDING'
    returning id`);
  if(!rows.length)return Response.json({error:"NOT_PENDING"},{status:409});
  return Response.json({ok:true,id,approval_status:decision});
 }catch(e){return quickError(e);}
}
