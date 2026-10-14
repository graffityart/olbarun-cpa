import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";

export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  await requireAdmin();
  const {id}=await params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return Response.json({ok:false,error:"INVALID_CAMPAIGN_ID"},{status:400});
  const [row]=await getDb().select({id:campaigns.id,type:campaigns.type}).from(campaigns).where(eq(campaigns.id,id)).limit(1);
  if(!row||row.type!=="CPA")return Response.json({ok:false,error:"CAMPAIGN_NOT_FOUND"},{status:404});
  const master=process.env.CPA_POSTBACK_SECRET??"";
  if(master.length<32)return Response.json({ok:false,error:"POSTBACK_NOT_CONFIGURED"},{status:503});
  const token=createHmac("sha256",master).update(`cpa-postback:${id.toLowerCase()}`).digest("hex");
  return Response.json({ok:true,campaignId:id,postbackUrl:"https://www.mypickup.kr/api/postback/cpa",token},{headers:{"Cache-Control":"no-store"}});
}
