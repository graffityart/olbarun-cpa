import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { and,eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clicks } from "@/db/schema";

/** Server-to-server CPA postback. Configure CPA_POSTBACK_SECRET on Vercel and give it only to trusted advertisers. */
export async function POST(request:NextRequest){
  const length=Number(request.headers.get("content-length")??0);
  if(length>8192)return Response.json({ok:false,error:"PAYLOAD_TOO_LARGE"},{status:413});
  const supplied=request.headers.get("x-cpa-postback-secret")??"";
  let body:Record<string,unknown>;
  try{const raw=await request.text();if(raw.length>8192)return Response.json({ok:false,error:"PAYLOAD_TOO_LARGE"},{status:413});body=JSON.parse(raw);if(!body||typeof body!=="object"||Array.isArray(body))throw Error("INVALID_JSON");}catch{return Response.json({ok:false,error:"INVALID_JSON"},{status:400});}
  const click=String(body.click??"");
  const campaignId=String(body.campaignId??"");
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campaignId))return Response.json({ok:false,error:"INVALID_CAMPAIGN_ID"},{status:400});
  if(!/^CLK-[A-F0-9]{14}$/.test(click))return Response.json({ok:false,error:"INVALID_CLICK"},{status:400});
  if(body.privacy!==true||body.thirdParty!==true)return Response.json({ok:false,error:"CONSENT_REQUIRED"},{status:400});
  const [attribution]=await getDb().select({id:clicks.id}).from(clicks).where(and(eq(clicks.clickCode,click),eq(clicks.campaignId,campaignId))).limit(1);
  if(!attribution)return Response.json({ok:false,error:"CLICK_NOT_FOUND"},{status:404});
  const master=process.env.CPA_POSTBACK_SECRET??"";
  const configured=master.length>=32?createHmac("sha256",master).update(`cpa-postback:${campaignId.toLowerCase()}`).digest("hex"):"";
  if(configured.length<32)return Response.json({ok:false,error:"POSTBACK_NOT_CONFIGURED"},{status:503});
  const a=Buffer.from(supplied),b=Buffer.from(configured);
  if(a.length!==b.length||!timingSafeEqual(a,b))return Response.json({ok:false,error:"UNAUTHORIZED"},{status:401});
  // Reuse the same budget, duplicate, rate and attribution logic as hosted CPA conversions.
  const {createCpaConversion}=await import("@/app/api/conversions/route");
  const forwarded=new Request(new URL("/api/conversions",request.url),{
    method:"POST",
    headers:{"content-type":"application/json","cookie":`olbarun_click=${encodeURIComponent(click)}`},
    body:JSON.stringify({campaignId:body.campaignId,name:body.name,phone:body.phone,region:body.region,privacy:true,thirdParty:true})
  });
  return createCpaConversion(forwarded,{trustedClickCode:click});
}
