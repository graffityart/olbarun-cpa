import {getDb} from "@/db";
import {requireAdmin} from "@/lib/auth/guards";
import {sql} from "drizzle-orm";

export const runtime="nodejs";
const privateJson=(data:unknown,init?:ResponseInit)=>Response.json(data,{...init,headers:{...Object.fromEntries(new Headers(init?.headers)),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
const datePattern=/^\d{4}-\d{2}-\d{2}$/;

// Read-only inventory. A cutoff is an operator-supplied assessment date,
// NOT an approved retention period or authorization to delete documents.
export async function GET(request:Request){
 try{
  await requireAdmin();
  if(process.env.PAYOUT_KYC_DOCUMENT_UPLOAD!=="enabled")return privateJson({ok:false,error:"DOCUMENT_REVIEW_UNAVAILABLE"},{status:503});
  const url=new URL(request.url);
  if([...url.searchParams.keys()].some(key=>key!=="before")||url.searchParams.getAll("before").length!==1)return privateJson({ok:false,error:"INVALID_INPUT"},{status:400});
  const before=url.searchParams.get("before")??"";
  if(!datePattern.test(before))return privateJson({ok:false,error:"INVALID_DATE"},{status:400});
  const date=new Date(before+"T00:00:00.000Z");
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==before||date.getTime()>Date.now())return privateJson({ok:false,error:"INVALID_DATE"},{status:400});
  // Aggregate only: never expose partner IDs, blob paths or document contents.
  const result=await getDb().execute(sql`select
   count(*) filter (where not exists(
    select 1 from settlements s where s.partner_id=v.partner_id and s.status in ('REQUESTED','APPROVED')
   ))::int as candidate_count,
   count(*) filter (where exists(
    select 1 from settlements s where s.partner_id=v.partner_id and s.status in ('REQUESTED','APPROVED')
   ))::int as active_payout_excluded_count,
   count(*) filter (where (v.bank_document_blob_path is null) <> (v.identity_document_blob_path is null))::int as partial_document_reference_count
   from partner_payout_verifications v
   where v.status='REJECTED' and v.submitted_at<${date.toISOString()}::timestamptz
   and (v.bank_document_blob_path is not null or v.identity_document_blob_path is not null)`);
  const candidateCount=Number(result[0]?.candidate_count??0);
  const activePayoutExcludedCount=Number(result[0]?.active_payout_excluded_count??0);
  const partialDocumentReferenceCount=Number(result[0]?.partial_document_reference_count??0);
  return privateJson({ok:true,assessmentOnly:true,cutoff:before,candidateCount,activePayoutExcludedCount,partialDocumentReferenceCount,orphanBlobScanPerformed:false,retentionPolicyApproved:false,deletionAllowed:false,documentsDeleted:0,requiredBeforeDeletion:["APPROVED_RETENTION_POLICY","LEGAL_HOLD_REVIEW","ACTIVE_PAYOUT_RECHECK","ADMIN_APPROVAL","AUDITED_DELETE_WORKER"],warning:"RETENTION_POLICY_NOT_APPROVED"});
 }catch{
  console.error("Payout document inventory failed");
  return privateJson({ok:false,error:"INVENTORY_FAILED"},{status:500});
 }
}
