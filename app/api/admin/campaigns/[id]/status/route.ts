import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { campaignRates, campaigns } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { requireSameOrigin } from "@/lib/security/origin";

type Status="DRAFT"|"REVIEW"|"ACTIVE"|"PAUSED"|"COMPLETED"|"ARCHIVED";
const allowed:Record<Status,readonly Status[]>={DRAFT:["REVIEW","ARCHIVED"],REVIEW:["DRAFT","ACTIVE","ARCHIVED"],ACTIVE:["PAUSED","COMPLETED"],PAUSED:["ACTIVE","COMPLETED","ARCHIVED"],COMPLETED:["ARCHIVED"],ARCHIVED:[]};
const statuses=new Set<Status>(["DRAFT","REVIEW","ACTIVE","PAUSED","COMPLETED","ARCHIVED"]);

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  requireSameOrigin(request);await requireAdmin();const{id}=await params;const body=await request.json();const raw=String(body.status??"");if(!statuses.has(raw as Status))return Response.json({ok:false,error:"INVALID_STATUS"},{status:400});const next=raw as Status;const db=getDb();
  const result=await db.transaction(async tx=>{
   const [row]=await tx.select({id:campaigns.id,status:campaigns.status,startAt:campaigns.startAt,endAt:campaigns.endAt}).from(campaigns).where(eq(campaigns.id,id)).for("update").limit(1);
   if(!row)throw new Error("NOT_FOUND");if(!allowed[row.status].includes(next))throw new Error("INVALID_TRANSITION");
   if(next==="ACTIVE"){
    const[rate]=await tx.select({advertiserRate:campaignRates.advertiserRate,partnerBaseRate:campaignRates.partnerBaseRate,minimumMargin:campaignRates.minimumMargin}).from(campaignRates).where(eq(campaignRates.campaignId,id)).limit(1);
    if(!rate||rate.advertiserRate<=0||rate.partnerBaseRate<0||rate.partnerBaseRate+rate.minimumMargin>rate.advertiserRate)throw new Error("RATE_NOT_READY");
    const now=new Date();if(row.endAt&&row.endAt<=now)throw new Error("CAMPAIGN_ENDED");
   }
   const[updated]=await tx.update(campaigns).set({status:next,updatedAt:new Date()}).where(and(eq(campaigns.id,id),eq(campaigns.status,row.status))).returning({id:campaigns.id,status:campaigns.status});if(!updated)throw new Error("CONCURRENT_UPDATE");return updated;
  });
  return Response.json({ok:true,campaign:result});
 }catch(error){const code=error instanceof Error?error.message:"UPDATE_FAILED";const status=code==="INVALID_ORIGIN"||code==="ORIGIN_CHECK_FAILED"?403:code==="NOT_FOUND"?404:code==="INVALID_STATUS"?400:409;return Response.json({ok:false,error:code},{status});}
}
