import {sql} from "drizzle-orm";
import {getDb} from "@/db";
import {requireAdmin} from "@/lib/auth/guards";
import {requireSameOrigin} from "@/lib/security/origin";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  requireSameOrigin(request);const admin=await requireAdmin();const {id}=await params;
  const body=await request.json().catch(()=>null),decision=String(body?.decision??""),note=String(body?.note??"").trim();
  if(!uuid.test(id)||!["APPROVED","REJECTED"].includes(decision)||note.length>2000||(decision==="REJECTED"&&!note))return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});
  const rows=await getDb().execute(sql`update campaigns set advertiser_approval_status=${decision},advertiser_reviewed_by=${admin.id},advertiser_reviewed_at=now(),advertiser_review_note=${note||null},updated_at=now()
   where id=${id} and type='POSTING' and registration_source='ADVERTISER' and advertiser_approval_status='PENDING' and status='DRAFT'
   returning id`);
  if(!rows.length)return Response.json({ok:false,error:"NOT_PENDING"},{status:409});
  return Response.json({ok:true,id,approvalStatus:decision});
 }catch(error){console.error("Posting request review failed",error);return Response.json({ok:false,error:"REVIEW_FAILED"},{status:500});}
}
