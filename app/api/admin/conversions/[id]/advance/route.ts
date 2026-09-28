import { eq,sql } from "drizzle-orm";
import { getDb } from "@/db";
import { conversions } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { requireSameOrigin } from "@/lib/security/origin";

const nextStatus:Record<string,"DELIVERED"|"REVIEWING">={RECEIVED:"DELIVERED",DELIVERED:"REVIEWING"};

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    requireSameOrigin(request);
    const admin=await requireAdmin();
    const{id}=await params;
    const db=getDb();
    const result=await db.transaction(async tx=>{
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`conversion:${id}`}))`);
      const[row]=await tx.select({code:conversions.conversionCode,status:conversions.status}).from(conversions).where(eq(conversions.id,id)).limit(1);
      if(!row)throw new Error("NOT_FOUND");
      const next=nextStatus[row.status];
      if(!next)throw new Error("NOT_ADVANCEABLE");
      const now=new Date();
      const values=next==="DELIVERED"?{status:next,deliveredAt:now,updatedAt:now}:{status:next,updatedAt:now};
      const[updated]=await tx.update(conversions).set(values).where(eq(conversions.id,id)).returning({id:conversions.id});
      if(!updated)throw new Error("UPDATE_FAILED");
      return{code:row.code,from:row.status,to:next};
    });
    await writeAudit({actorUserId:admin.id,action:"CPA_STATUS_ADVANCE",targetType:"CONVERSION",targetId:id,summary:`${result.code} ${result.from} → ${result.to}`,metadata:{from:result.from,to:result.to}});
    return Response.json({ok:true,status:result.to});
  }catch(e){const message=e instanceof Error?e.message:"ADVANCE_FAILED";const status=message==="INVALID_ORIGIN"||message==="ORIGIN_CHECK_FAILED"?403:message==="NOT_FOUND"?404:409;return Response.json({ok:false,error:message},{status});}
}
