import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { and,eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clicks } from "@/db/schema";

/** Server-to-server CPA postback. Configure CPA_POSTBACK_SECRET on Vercel and give it only to trusted advertisers. */
export async function POST(request:NextRequest){
  const configured=process.env.CPA_POSTBACK_SECRET;
  if(!configured||configured.length<32)return Response.json({ok:false,error:"POSTBACK_NOT_CONFIGURED"},{status:503});
  const supplied=request.headers.get("x-cpa-postback-secret")??"";
  const a=Buffer.from(supplied),b=Buffer.from(configured);
  if(a.length!==b.length||!timingSafeEqual(a,b))return Response.json({ok:false,error:"UNAUTHORIZED"},{status:401});
  let body:Record<string,unknown>;
  try{body=await request.json();}catch{return Response.json({ok:false,error:"INVALID_JSON"},{status:400});}
  const click=String(body.click??"");
  if(!/^CLK-[A-F0-9]{14}$/.test(click))return Response.json({ok:false,error:"INVALID_CLICK"},{status:400});
  if(body.privacy!==true||body.thirdParty!==true)return Response.json({ok:false,error:"CONSENT_REQUIRED"},{status:400});
  const [attribution]=await getDb().select({id:clicks.id}).from(clicks).where(and(eq(clicks.clickCode,click),eq(clicks.campaignId,String(body.campaignId??"")))).limit(1);
  if(!attribution)return Response.json({ok:false,error:"CLICK_NOT_FOUND"},{status:404});
  // Reuse the same budget, duplicate, rate and attribution logic as hosted CPA conversions.
  const {POST:createConversion}=await import("@/app/api/conversions/route");
  const forwarded=new Request(new URL("/api/conversions",request.url),{
    method:"POST",
    headers:{"content-type":"application/json","cookie":`olbarun_click=${encodeURIComponent(click)}`},
    body:JSON.stringify({campaignId:body.campaignId,name:body.name,phone:body.phone,region:body.region,privacy:true,thirdParty:true})
  });
  return createConversion(forwarded);
}
