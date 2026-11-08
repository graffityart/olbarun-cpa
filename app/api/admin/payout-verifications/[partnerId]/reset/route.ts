import {sql} from "drizzle-orm";
import {getDb} from "@/db";
import {requireAdmin} from "@/lib/auth/guards";
import {requireSameOrigin} from "@/lib/security/origin";
import {auditLogs} from "@/db/schema";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:Request,{params}:{params:Promise<{partnerId:string}>}){
 try{
  requireSameOrigin(request);
  const admin=await requireAdmin();
  if(process.env.PAYOUT_KYC_DOCUMENT_UPLOAD!=="enabled")return Response.json({ok:false,error:"DOCUMENT_REVIEW_UNAVAILABLE"},{status:503,headers:{"Cache-Control":"no-store"}});
  const {partnerId}=await params;
  if(!/^application\\/json(?:\\s*;\\s*charset\\s*=\\s*utf-8)?\\s*$/i.test(request.headers.get("content-type")??""))return Response.json({ok:false,error:"INVALID_CONTENT_TYPE"},{status:415,headers:{"Cache-Control":"no-store"}});
  const maxBodyBytes=4096;
  const declaredLength=request.headers.get("content-length");
  if(declaredLength!==null&&(!/^\\d+$/.test(declaredLength)||!Number.isSafeInteger(Number(declaredLength))))return Response.json({ok:false,error:"INVALID_CONTENT_LENGTH"},{status:400,headers:{"Cache-Control":"no-store"}});
  if(declaredLength!==null&&Number(declaredLength)>maxBodyBytes)return Response.json({ok:false,error:"RESET_PAYLOAD_TOO_LARGE"},{status:413,headers:{"Cache-Control":"no-store"}});
  const reader=request.body?.getReader();
  if(!reader)return Response.json({ok:false,error:"INVALID_INPUT"},{status:400,headers:{"Cache-Control":"no-store"}});
  const chunks:Uint8Array[]=[];
  let total=0;
  try{
   while(true){
    const {done,value}=await reader.read();
    if(done)break;
    total+=value.byteLength;
    if(total>maxBodyBytes){await reader.cancel().catch(()=>{});return Response.json({ok:false,error:"RESET_PAYLOAD_TOO_LARGE"},{status:413,headers:{"Cache-Control":"no-store"}});}
    chunks.push(value);
   }
  }finally{reader.releaseLock();}
  const body=await new Response(new Blob(chunks.map(chunk=>new Uint8Array(chunk)))).json().catch(()=>null);
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(key=>key!=="reason"))return Response.json({ok:false,error:"INVALID_INPUT"},{status:400,headers:{"Cache-Control":"no-store"}});
  const reason=typeof body?.reason==="string"?body.reason.trim():"";
  // Never store complete resident registration numbers in reset reasons or audit metadata.
  if(/\b\d{6}\s*[-‐‑‒–—−]?\s*\d{7}\b/.test(reason.normalize("NFKC")))return Response.json({ok:false,error:"SENSITIVE_REASON_DATA"},{status:400,headers:{"Cache-Control":"no-store"}});
  if(!uuid.test(partnerId)||!reason||reason.length>2000)return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});
  await getDb().transaction(async tx=>{
   const partnerLock=await tx.execute(sql`select id from partners where id=${partnerId} for update`);
   if(partnerLock.length!==1)throw Error("NOT_APPROVED");
   const locked=await tx.execute(sql`select id,status from partner_payout_verifications where partner_id=${partnerId} for update`);
   if(locked.length!==1||locked[0].status!=="APPROVED")throw Error("NOT_APPROVED");
   const pending=await tx.execute(sql`select id from settlements where partner_id=${partnerId} and status in ('REQUESTED','APPROVED') limit 1`);
   if(pending.length)throw Error("PAYOUT_IN_PROGRESS");
   const updated=await tx.execute(sql`update partner_payout_verifications set status='REJECTED',verified_account_fingerprint=null,reviewed_by=${admin.id},reviewed_at=now(),rejection_reason=${reason},updated_at=now() where partner_id=${partnerId} and status='APPROVED' returning id`);
   if(updated.length!==1)throw Error("NOT_APPROVED");
   await tx.insert(auditLogs).values({actorUserId:admin.id,action:"PAYOUT_IDENTITY_RESET",targetType:"PARTNER",targetId:partnerId,summary:"출금계좌 변경 재검수 요청",metadata:{verificationId:updated[0].id,reason}});
  });
  return Response.json({ok:true,status:"REJECTED"},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  const code=error instanceof Error?error.message:"RESET_FAILED";
  if(code==="INVALID_ORIGIN"||code==="ORIGIN_CHECK_FAILED")return Response.json({ok:false,error:code},{status:403});
  if(code==="NOT_APPROVED"||code==="PAYOUT_IN_PROGRESS")return Response.json({ok:false,error:code},{status:409});
  console.error("Payout verification reset failed",{code:"RESET_FAILED"});
  return Response.json({ok:false,error:"RESET_FAILED"},{status:500});
 }
}
