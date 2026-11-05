import {randomBytes} from "node:crypto";
import {sql} from "drizzle-orm";
import {getDb} from "@/db";
import {getCurrentUser} from "@/lib/auth/session";
import {requireSameOrigin} from "@/lib/security/origin";

export async function POST(request:Request){
 try{
  requireSameOrigin(request);
  const user=await getCurrentUser();
  if(!user||user.status!=="ACTIVE"||user.role!=="ADVERTISER")return Response.json({ok:false,error:"UNAUTHORIZED"},{status:401});
  const body=await request.json().catch(()=>null);
  if(!body||typeof body!=="object"||Array.isArray(body))return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});
  const data=body as Record<string,unknown>;
  const name=String(data.name??"").trim(),description=String(data.description??"").trim(),category=String(data.category??"").trim(),landingUrl=String(data.landingUrl??"").trim();
  if(!name||name.length>200||!description||description.length>10000||category.length>80||landingUrl.length>2000)return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});
  let parsed:URL;try{parsed=new URL(landingUrl);}catch{return Response.json({ok:false,error:"INVALID_URL"},{status:400});}
  if(!["https:","http:"].includes(parsed.protocol)||parsed.username||parsed.password||!parsed.hostname||parsed.hostname==="localhost"||parsed.hostname.endsWith(".localhost"))return Response.json({ok:false,error:"INVALID_URL"},{status:400});
  const code="CPA-"+Date.now().toString(36).toUpperCase()+"-"+randomBytes(4).toString("hex").toUpperCase();
  const slug="cpa-"+Date.now().toString(36)+"-"+randomBytes(6).toString("hex");
  const rows=await getDb().execute(sql`insert into campaigns(campaign_code,advertiser_id,type,name,slug,category,description,status,settings,registration_source,advertiser_approval_status)
   select ${code},au.advertiser_id,'CPA',${name},${slug},${category||null},${description},'DRAFT',${JSON.stringify({landingUrl})}::jsonb,'ADVERTISER','PENDING'
   from advertiser_users au where au.user_id=${user.id} returning id`);
  if(!rows.length)return Response.json({ok:false,error:"ADVERTISER_NOT_LINKED"},{status:403});
  return Response.json({ok:true,id:rows[0].id,approvalStatus:"PENDING"},{status:201});
 }catch(error){console.error("Advertiser CPA request failed",error);return Response.json({ok:false,error:"REQUEST_FAILED"},{status:500});}
}
