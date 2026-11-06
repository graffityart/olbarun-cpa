import {get} from "@vercel/blob";
import {getDb} from "@/db";
import {requireAdmin} from "@/lib/auth/guards";
import {sql} from "drizzle-orm";
import {auditLogs} from "@/db/schema";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const runtime="nodejs";
const privateError=(status:number)=>new Response(null,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}});
export async function GET(_request:Request,{params}:{params:Promise<{partnerId:string;kind:string}>}){
 try{
  const admin=await requireAdmin();
  if(process.env.PAYOUT_KYC_DOCUMENT_UPLOAD!=="enabled")return privateError(503);
  const {partnerId,kind}=await params;
  if(!uuid.test(partnerId)||!["bank","identity"].includes(kind))return privateError(400);
  const rows=await getDb().execute(sql`select bank_document_blob_path,identity_document_blob_path from partner_payout_verifications where partner_id=${partnerId} and status in ('PENDING','APPROVED','REJECTED') limit 1`);
  if(rows.length!==1)return privateError(404);
  const path=kind==="bank"?rows[0].bank_document_blob_path:rows[0].identity_document_blob_path;
  if(typeof path!=="string"||!path.startsWith(`payout-verifications/${partnerId}/`))return privateError(404);
  const file=await get(path,{access:"private"});
  if(file?.statusCode!==200)return privateError(404);
  const contentType=/\.pdf(?:-[a-zA-Z0-9]+)?$/.test(path)?"application/pdf":/\.png(?:-[a-zA-Z0-9]+)?$/.test(path)?"image/png":/\.jpg(?:-[a-zA-Z0-9]+)?$/.test(path)?"image/jpeg":"";
  if(!["application/pdf","image/jpeg","image/png"].includes(contentType))return privateError(415);
  await getDb().insert(auditLogs).values({actorUserId:admin.id,action:"PAYOUT_IDENTITY_DOCUMENT_VIEW",targetType:"PARTNER",targetId:partnerId,summary:kind==="bank"?"출금 통장 사본 열람":"출금 본인확인 서류 열람",metadata:{documentKind:kind}});

  return new Response(file.stream,{headers:{"Content-Type":contentType,"Content-Disposition":`attachment; filename="${kind==="bank"?"bank":"identity"}.${contentType==="application/pdf"?"pdf":contentType==="image/png"?"png":"jpg"}"`,"X-Content-Type-Options":"nosniff","Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Frame-Options":"DENY","Content-Security-Policy":"default-src 'none'; sandbox"}});
 }catch{console.error("Private verification document access failed");return privateError(500);}
}
