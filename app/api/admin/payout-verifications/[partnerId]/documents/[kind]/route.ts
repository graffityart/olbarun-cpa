import {get} from "@vercel/blob";
import {getDb} from "@/db";
import {requireAdmin} from "@/lib/auth/guards";
import {sql} from "drizzle-orm";
import {auditLogs} from "@/db/schema";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const runtime="nodejs";
const privateError=(status:number)=>new Response(null,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","Cross-Origin-Resource-Policy":"same-origin","X-Frame-Options":"DENY"}});
export async function GET(_request:Request,{params}:{params:Promise<{partnerId:string;kind:string}>}){
 const admin=await requireAdmin();
 try{
  if(process.env.PAYOUT_KYC_DOCUMENT_UPLOAD!=="enabled")return privateError(503);
  if(process.env.VERCEL_ENV==="preview"&&process.env.PAYOUT_KYC_PREVIEW_ISOLATION_CONFIRMED!=="enabled")return privateError(503);
  const {partnerId,kind}=await params;
  if(!uuid.test(partnerId)||!["bank","identity"].includes(kind))return privateError(400);
  const rows=await getDb().execute(sql`select id,bank_document_blob_path,identity_document_blob_path from partner_payout_verifications where partner_id=${partnerId} and status='PENDING' limit 1`);
  if(rows.length!==1)return privateError(404);
  const path=kind==="bank"?rows[0].bank_document_blob_path:rows[0].identity_document_blob_path;
  if(typeof path!=="string"||!path.startsWith(`payout-verifications/${partnerId}/`))return privateError(404);
  const file=await get(path,{access:"private"});
  if(file?.statusCode!==200)return privateError(404);
  const contentType=/\.pdf(?:-[a-zA-Z0-9]+)?$/.test(path)?"application/pdf":/\.png(?:-[a-zA-Z0-9]+)?$/.test(path)?"image/png":/\.jpg(?:-[a-zA-Z0-9]+)?$/.test(path)?"image/jpeg":"";
  if(!["application/pdf","image/jpeg","image/png"].includes(contentType))return privateError(415);
  // Recheck the exact document reference after fetching the private blob.
  // A concurrent approval, rejection or resubmission must invalidate this download.
  const stillPending=await getDb().execute(sql`select id from partner_payout_verifications
   where id=${rows[0].id} and partner_id=${partnerId} and status='PENDING'
   and ${kind==="bank"?sql`bank_document_blob_path=${path}`:sql`identity_document_blob_path=${path}`}
   limit 1`);
  if(stillPending.length!==1)return privateError(409);
  await getDb().insert(auditLogs).values({actorUserId:admin.id,action:"PAYOUT_IDENTITY_DOCUMENT_VIEW",targetType:"PARTNER",targetId:partnerId,summary:kind==="bank"?"출금 통장 사본 열람":"출금 본인확인 서류 열람",metadata:{verificationId:rows[0].id,documentKind:kind}});

  return new Response(file.stream,{headers:{"Content-Type":contentType,"Content-Disposition":`attachment; filename="${kind==="bank"?"bank":"identity"}.${contentType==="application/pdf"?"pdf":contentType==="image/png"?"png":"jpg"}"`,"X-Content-Type-Options":"nosniff","Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Frame-Options":"DENY","Cross-Origin-Resource-Policy":"same-origin","Permissions-Policy":"camera=(), microphone=(), geolocation=()","Content-Security-Policy":"default-src 'none'; sandbox"}});
 }catch{console.error("Private verification document access failed");return privateError(500);}
}
