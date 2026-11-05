import {randomBytes} from "node:crypto";
import {sql} from "drizzle-orm";
import {getDb} from "@/db";
import {getCurrentUser} from "@/lib/auth/session";
import {requireSameOrigin} from "@/lib/security/origin";
import {validatePostingLimits} from "@/lib/cpa/posting-limits.mjs";

export async function POST(request:Request){
 try{
  requireSameOrigin(request);
  const user=await getCurrentUser();
  if(!user||user.status!=="ACTIVE"||user.role!=="ADVERTISER")return Response.json({ok:false,error:"UNAUTHORIZED"},{status:401});
  const body=await request.json().catch(()=>null);
  if(!body||typeof body!=="object"||Array.isArray(body))return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});
  const input=body as Record<string,unknown>;
  const name=String(input.name??"").trim(),description=String(input.description??"").trim(),category=String(input.category??"").trim();
  const instructions=String(input.instructions??"").trim(),requiredKeywords=String(input.requiredKeywords??"").trim(),notice=String(input.notice??"").trim();
  const targetUrl=String(input.targetUrl??"").trim();
  if(!name||name.length>200||!description||description.length>10000||!instructions||instructions.length>10000||requiredKeywords.length>2000||notice.length>10000||category.length>80||targetUrl.length>2000)return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});
  if(targetUrl){let parsed:URL;try{parsed=new URL(targetUrl);}catch{return Response.json({ok:false,error:"INVALID_URL"},{status:400});}if(!["https:","http:"].includes(parsed.protocol)||parsed.username||parsed.password||!parsed.hostname||parsed.hostname==="localhost"||parsed.hostname.endsWith(".localhost"))return Response.json({ok:false,error:"INVALID_URL"},{status:400});}
  const limitsError=validatePostingLimits(input);if(limitsError)return Response.json({ok:false,error:limitsError},{status:400});
  const mediaType=String(input.mediaType??"BLOG"),participantLimit=input.participantLimit==null||input.participantLimit===""?null:Number(input.participantLimit),totalSubmissionLimit=input.totalSubmissionLimit==null||input.totalSubmissionLimit===""?null:Number(input.totalSubmissionLimit);
  const perPartnerLimit=Number(input.perPartnerLimit??1),reviewDays=Number(input.postingReviewDays??3),revisionLimit=Number(input.revisionLimit??2);
  const code="POSTING-"+Date.now().toString(36).toUpperCase()+"-"+randomBytes(4).toString("hex").toUpperCase();
  const slug="posting-"+Date.now().toString(36)+"-"+randomBytes(6).toString("hex");
  const settings=JSON.stringify({landingUrl:targetUrl,postingInstructions:instructions,requiredKeywords,postingNotice:notice});
  const result=await getDb().transaction(async tx=>{
   const rows=await tx.execute(sql`insert into campaigns(campaign_code,advertiser_id,type,name,slug,category,description,status,settings,registration_source,advertiser_approval_status)
    select ${code},au.advertiser_id,'POSTING',${name},${slug},${category||null},${description},'DRAFT',${settings}::jsonb,'ADVERTISER','PENDING'
    from advertiser_users au where au.user_id=${user.id} returning id`);
   if(!rows.length)return null;
   const id=String(rows[0].id);
   await tx.execute(sql`insert into posting_campaigns(campaign_id,media_type,participant_limit,total_submission_limit,per_partner_limit,review_days,revision_limit,rules)
    values(${id},${mediaType},${participantLimit},${totalSubmissionLimit},${perPartnerLimit},${reviewDays},${revisionLimit},${JSON.stringify({instructions,requiredKeywords,notice})}::jsonb)`);
   return id;
  });
  if(!result)return Response.json({ok:false,error:"ADVERTISER_NOT_LINKED"},{status:403});
  return Response.json({ok:true,id:result,approvalStatus:"PENDING"},{status:201});
 }catch(error){console.error("Advertiser posting request failed",error);return Response.json({ok:false,error:"REQUEST_FAILED"},{status:500});}
}
