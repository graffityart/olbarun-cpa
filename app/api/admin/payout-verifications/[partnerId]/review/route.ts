import {sql} from "drizzle-orm";
import {getDb} from "@/db";
import {requireAdmin} from "@/lib/auth/guards";
import {requireSameOrigin} from "@/lib/security/origin";
import {auditLogs} from "@/db/schema";
const privateJson:typeof Response.json=(data,init)=>Response.json(data,{...init,headers:{...Object.fromEntries(new Headers(init?.headers)),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:Request,{params}:{params:Promise<{partnerId:string}>}){
 const admin=await requireAdmin();
 try{
  requireSameOrigin(request);
  if(process.env.PAYOUT_KYC_DOCUMENT_UPLOAD!=="enabled")return privateJson({ok:false,error:"DOCUMENT_REVIEW_UNAVAILABLE"},{status:503,headers:{"Cache-Control":"no-store"}});
  const {partnerId}=await params;
  if(!/^application\/json(?:\s*;\s*charset\s*=\s*utf-8)?\s*$/i.test(request.headers.get("content-type")??""))return privateJson({ok:false,error:"INVALID_CONTENT_TYPE"},{status:415});
  // Bound even chunked requests without Content-Length before parsing admin review JSON.
  const maxReviewBytes=4096;
  const rawLength=request.headers.get("content-length");
  if(rawLength!==null&&(!/^\d+$/.test(rawLength)||!Number.isSafeInteger(Number(rawLength))))return privateJson({ok:false,error:"INVALID_CONTENT_LENGTH"},{status:400});
  if(rawLength!==null&&Number(rawLength)>maxReviewBytes)return privateJson({ok:false,error:"REVIEW_PAYLOAD_TOO_LARGE"},{status:413});
  const reader=request.body?.getReader();
  if(!reader)return privateJson({ok:false,error:"INVALID_INPUT"},{status:400});
  let size=0;
  const chunks:Uint8Array[]=[];
  try{
   while(true){
    const {done,value}=await reader.read();
    if(done)break;
    size+=value.byteLength;
    if(size>maxReviewBytes){await reader.cancel().catch(()=>{});return privateJson({ok:false,error:"REVIEW_PAYLOAD_TOO_LARGE"},{status:413});}
    chunks.push(value);
   }
  }catch{
   await reader.cancel().catch(()=>{});
   return privateJson({ok:false,error:"REVIEW_STREAM_FAILED"},{status:400});
  }finally{reader.releaseLock();}
  if(rawLength!==null&&size!==Number(rawLength))return privateJson({ok:false,error:"CONTENT_LENGTH_MISMATCH"},{status:400});
  const body=await new Response(new Blob(chunks.map(chunk=>new Uint8Array(chunk)))).json().catch(()=>null),decision=body?.decision,reason=typeof body?.reason==="string"?body.reason.trim():"";
  // Reject nested arrays and primitive JSON before inspecting review fields.
  if(!body||typeof body!=="object"||Array.isArray(body))return privateJson({ok:false,error:"INVALID_INPUT"},{status:400});
  // Accept only fields used by the review workflow; reject unexpected metadata.
  const allowedReviewFields=new Set(["decision","reason","identityAndBankMatch","sensitiveDataMasked"]);
  if(Object.keys(body).some(key=>!allowedReviewFields.has(key)))return privateJson({ok:false,error:"INVALID_INPUT"},{status:400});
  if(("reason" in body&&typeof body.reason!=="string")||("identityAndBankMatch" in body&&typeof body.identityAndBankMatch!=="boolean")||("sensitiveDataMasked" in body&&typeof body.sensitiveDataMasked!=="boolean"))return privateJson({ok:false,error:"INVALID_INPUT"},{status:400});
  if(decision==="APPROVED"&&body?.identityAndBankMatch!==true)return privateJson({ok:false,error:"IDENTITY_MATCH_CONFIRMATION_REQUIRED"},{status:400});
  if(decision==="APPROVED"&&body?.sensitiveDataMasked!==true)return privateJson({ok:false,error:"PRIVACY_MASK_REVIEW_REQUIRED"},{status:400});
  // Do not persist a full Korean resident registration number in rejection messages.
  if(decision==="REJECTED"&&/\b\d{6}\s*[-‐‑‒–—−]?\s*\d{7}\b/.test(reason.normalize("NFKC")))return privateJson({ok:false,error:"SENSITIVE_REASON_DATA"},{status:400});
  // Rejection notes are displayed to partners; reject control characters and bidi overrides.
  if(decision==="REJECTED"&&/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(reason))return privateJson({ok:false,error:"INVALID_REJECTION_REASON"},{status:400});
  if(!uuid.test(partnerId)||!["APPROVED","REJECTED"].includes(decision)||reason.length>2000||(decision==="REJECTED"&&!reason)||(decision==="APPROVED"&&reason.length>0))return privateJson({ok:false,error:"INVALID_INPUT"},{status:400});
  const result=await getDb().transaction(async tx=>{
   const locked=await tx.execute(sql`select id from partner_payout_verifications where partner_id=${partnerId} and status='PENDING' for update`);
   if(locked.length!==1)throw Error("NOT_PENDING");
   if(decision==="APPROVED"){
    const viewed=await tx.execute(sql`select count(distinct metadata->>'documentKind')::int as count from audit_logs where actor_user_id=${admin.id} and target_type='PARTNER' and target_id=${partnerId} and action='PAYOUT_IDENTITY_DOCUMENT_VIEW' and metadata->>'documentKind' in ('bank','identity') and metadata->>'verificationId'=${locked[0].id} and created_at>now()-interval '30 minutes' and created_at>(select submitted_at from partner_payout_verifications where partner_id=${partnerId})`);
    if(Number(viewed[0]?.count)!==2)throw Error("DOCUMENT_REVIEW_REQUIRED");
   }
   const rows=await tx.execute(sql`update partner_payout_verifications
   set status=${decision},reviewed_by=${admin.id},reviewed_at=now(),rejection_reason=${decision==="REJECTED"?reason:null},updated_at=now()
   where partner_id=${partnerId} and status='PENDING'
   and (${decision}='REJECTED' or (bank_document_blob_path is not null and identity_document_blob_path is not null))
   and (${decision}='REJECTED' or bank_document_blob_path <> identity_document_blob_path)
   and (${decision}='REJECTED' or verified_account_fingerprint ~ '^[0-9a-f]{64}$')
   returning id,partner_id,status`);
   if(rows.length!==1)throw Error("NOT_PENDING");
   const row=rows[0];
   await tx.insert(auditLogs).values({actorUserId:admin.id,action:"PAYOUT_IDENTITY_REVIEW",targetType:"PARTNER",targetId:partnerId,summary:decision==="APPROVED"?"출금 본인확인 승인":"출금 본인확인 반려",metadata:{verificationId:row.id,decision,identityAndBankMatch:decision==="APPROVED",sensitiveDataMasked:decision==="APPROVED"}});
   return {status:decision};
  });
  return privateJson({ok:true,...result},{headers:{"Cache-Control":"no-store"}});
 }catch(error){const code=error instanceof Error?error.message:"REVIEW_FAILED";if(code==="DOCUMENT_REVIEW_REQUIRED")return privateJson({ok:false,error:code},{status:409});if(code==="NOT_PENDING")return privateJson({ok:false,error:code},{status:409});if(code==="INVALID_ORIGIN"||code==="ORIGIN_CHECK_FAILED")return privateJson({ok:false,error:code},{status:403});// Avoid logging raw exceptions that may contain sensitive database parameters or document metadata.
  console.error("Payout identity review failed",{code:"REVIEW_FAILED"});return privateJson({ok:false,error:"REVIEW_FAILED"},{status:500});}
}