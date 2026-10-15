import { and,eq,sql } from "drizzle-orm";
import { getDb } from "@/db";
import { conversions } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { requireSameOrigin } from "@/lib/security/origin";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    requireSameOrigin(request);
    const admin=await requireAdmin();
    const{id}=await params;
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return Response.json({ok:false,error:"INVALID_ID"},{status:400});
    const db=getDb();
    const result=await db.transaction(async tx=>{
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`conversion:${id}`}))`);
      const[row]=await tx.select({code:conversions.conversionCode,status:conversions.status}).from(conversions).where(eq(conversions.id,id)).limit(1);
      if(!row)throw new Error("NOT_FOUND");
      const next:"DELIVERED"|"REVIEWING"|undefined=row.status==="RECEIVED"?"DELIVERED":row.status==="DELIVERED"?"REVIEWING":undefined;
      if(!next)throw new Error("NOT_ADVANCEABLE");
      const now=new Date();
      const values=next==="DELIVERED"?{status:next,deliveredAt:now,updatedAt:now}:{status:next,updatedAt:now};
      const[updated]=await tx.update(conversions).set(values).where(and(eq(conversions.id,id),eq(conversions.status,row.status))).returning({id:conversions.id});
      if(!updated)throw new Error("UPDATE_FAILED");
      return{code:row.code,from:row.status,to:next};
    });
    try{await writeAudit({actorUserId:admin.id,action:"CPA_STATUS_ADVANCE",targetType:"CONVERSION",targetId:id,summary:`${result.code} ${result.from} → ${result.to}`,metadata:{from:result.from,to:result.to}});}catch(auditError){console.error("CPA status advanced but audit logging failed",auditError);}
    return Response.json({ok:true,status:result.to});
  }catch(e){const message=e instanceof Error?e.message:"ADVANCE_FAILED";const known=["INVALID_ORIGIN","ORIGIN_CHECK_FAILED","NOT_FOUND","NOT_ADVANCEABLE","UPDATE_FAILED"];const error=known.includes(message)?message:"ADVANCE_FAILED";if(error==="ADVANCE_FAILED")console.error("CPA status advance failed",e);const status=error==="INVALID_ORIGIN"||error==="ORIGIN_CHECK_FAILED"?403:error==="NOT_FOUND"?404:error==="ADVANCE_FAILED"?500:409;return Response.json({ok:false,error},{status});}
}
