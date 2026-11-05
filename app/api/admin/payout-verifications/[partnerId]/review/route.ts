import {sql} from "drizzle-orm";
import {getDb} from "@/db";
import {requireAdmin} from "@/lib/auth/guards";
import {requireSameOrigin} from "@/lib/security/origin";
import {auditLogs} from "@/db/schema";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:Request,{params}:{params:Promise<{partnerId:string}>}){
 try{
  requireSameOrigin(request);const admin=await requireAdmin();const {partnerId}=await params;
  const body=await request.json().catch(()=>null),decision=body?.decision,reason=typeof body?.reason==="string"?body.reason.trim():"";
  if(decision==="APPROVED"&&body?.identityAndBankMatch!==true)return Response.json({ok:false,error:"IDENTITY_MATCH_CONFIRMATION_REQUIRED"},{status:400});
  if(!uuid.test(partnerId)||!["APPROVED","REJECTED"].includes(decision)||reason.length>2000||(decision==="REJECTED"&&!reason))return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});
  const result=await getDb().transaction(async tx=>{
   const locked=await tx.execute(sql`select id from partner_payout_verifications where partner_id=${partnerId} and status='PENDING' for update`);
   if(locked.length!==1)throw Error("NOT_PENDING");
   if(decision==="APPROVED"){
    const viewed=await tx.execute(sql`select count(distinct metadata->>'documentKind')::int as count from audit_logs where actor_user_id=${admin.id} and target_type='PARTNER' and target_id=${partnerId} and action='PAYOUT_IDENTITY_DOCUMENT_VIEW' and metadata->>'documentKind' in ('bank','identity') and created_at>now()-interval '30 minutes' and created_at>(select submitted_at from partner_payout_verifications where partner_id=${partnerId})`);
    if(Number(viewed[0]?.count)!==2)throw Error("DOCUMENT_REVIEW_REQUIRED");
   }
   const rows=await tx.execute(sql`update partner_payout_verifications
   set status=${decision},reviewed_by=${admin.id},reviewed_at=now(),rejection_reason=${decision==="REJECTED"?reason:null},updated_at=now()
   where partner_id=${partnerId} and status='PENDING'
   and bank_document_blob_path is not null and identity_document_blob_path is not null
   and (${decision}='REJECTED' or verified_account_fingerprint ~ '^[0-9a-f]{64}$')
   returning id,partner_id,status`);
   if(rows.length!==1)throw Error("NOT_PENDING");
   const row=rows[0];
   await tx.insert(auditLogs).values({actorUserId:admin.id,action:"PAYOUT_IDENTITY_REVIEW",targetType:"PARTNER",targetId:partnerId,summary:decision==="APPROVED"?"출금 본인확인 승인":"출금 본인확인 반려",metadata:{verificationId:row.id,decision,identityAndBankMatch:decision==="APPROVED",reason:decision==="REJECTED"?reason:undefined}});
   return {status:decision};
  });
  return Response.json({ok:true,...result},{headers:{"Cache-Control":"no-store"}});
 }catch(error){const code=error instanceof Error?error.message:"REVIEW_FAILED";if(code==="DOCUMENT_REVIEW_REQUIRED")return Response.json({ok:false,error:code},{status:409});if(code==="NOT_PENDING")return Response.json({ok:false,error:code},{status:409});if(code==="INVALID_ORIGIN"||code==="ORIGIN_CHECK_FAILED")return Response.json({ok:false,error:code},{status:403});console.error("Payout identity review failed",error);return Response.json({ok:false,error:"REVIEW_FAILED"},{status:500});}
}