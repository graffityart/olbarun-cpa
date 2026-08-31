import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { earnings, settlementItems, settlements } from "@/db/schema";

export async function POST(request: Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params; const body=await request.json(); const action=String(body.action??"");
  if(!["APPROVE","PAID","REJECT"].includes(action)) return Response.json({ok:false,error:"INVALID_ACTION"},{status:400});
  try{
    const result=await getDb().transaction(async tx=>{
      const [row]=await tx.select().from(settlements).where(eq(settlements.id,id)).limit(1); if(!row) throw new Error("NOT_FOUND");
      if(action==="APPROVE"){
        if(row.status!=="REQUESTED") throw new Error("INVALID_STATUS");
        await tx.update(settlements).set({status:"APPROVED",approvedAt:new Date()}).where(eq(settlements.id,id));
      }else if(action==="PAID"){
        if(row.status!=="APPROVED") throw new Error("INVALID_STATUS");
        await tx.update(settlements).set({status:"PAID",paidAt:new Date()}).where(eq(settlements.id,id));
        const items=await tx.select().from(settlementItems).where(eq(settlementItems.settlementId,id));
        for(const item of items) await tx.update(earnings).set({status:"PAID"}).where(eq(earnings.id,item.earningId));
      }else{
        if(row.status!=="REQUESTED") throw new Error("INVALID_STATUS");
        await tx.update(settlements).set({status:"REJECTED"}).where(eq(settlements.id,id));
        const items=await tx.select().from(settlementItems).where(eq(settlementItems.settlementId,id));
        for(const item of items) await tx.update(earnings).set({status:"AVAILABLE"}).where(eq(earnings.id,item.earningId));
      }
      return true;
    });
    return Response.json({ok:result});
  }catch(e){const error=e instanceof Error?e.message:"REVIEW_FAILED";return Response.json({ok:false,error},{status:error==="NOT_FOUND"?404:409});}
}
