import {list} from "@vercel/blob";
import {sql} from "drizzle-orm";
import {getDb} from "@/db";
import {requireAdmin} from "@/lib/auth/guards";

export const runtime="nodejs";
const privateJson=(data:unknown,init?:ResponseInit)=>Response.json(data,{...init,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}});
const prefix="payout-verifications/";
const graceMs=48*60*60*1000;

// Read-only, single-page diagnostic. Never delete objects or return object names.
// A complete result requires a complete listing and a successful DB comparison.
export async function GET(request:Request){
 const admin=await requireAdmin();
 void admin;
 try{
  if(process.env.PAYOUT_KYC_ORPHAN_INVENTORY!=="enabled"||process.env.VERCEL_ENV==="production")
   return privateJson({ok:false,error:"INVENTORY_DISABLED"},{status:503});
  if(new URL(request.url).search)return privateJson({ok:false,error:"INVALID_INPUT"},{status:400});
  const page=await list({prefix,limit:100});
  const now=Date.now();
  const eligible=page.blobs.filter(blob=>blob.pathname.startsWith(prefix)
   &&/^payout-verifications\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/(?:bank|identity)\.(?:pdf|png|jpg)(?:-[a-zA-Z0-9]+)?$/.test(blob.pathname)
   &&Number.isFinite(new Date(blob.uploadedAt).getTime())
   &&now-new Date(blob.uploadedAt).getTime()>=graceMs);
  let unreferencedCandidateCount=0;
  if(eligible.length){
   const paths=eligible.map(blob=>blob.pathname);
   const rows=await getDb().execute(sql`select bank_document_blob_path as path from partner_payout_verifications
    where bank_document_blob_path in (${sql.join(paths.map(path=>sql`${path}`),sql`,`)})
    union select identity_document_blob_path as path from partner_payout_verifications
    where identity_document_blob_path in (${sql.join(paths.map(path=>sql`${path}`),sql`,`)})`);
   const referenced=new Set(rows.map(row=>String(row.path)));
   unreferencedCandidateCount=paths.filter(path=>!referenced.has(path)).length;
  }
  return privateJson({ok:true,assessmentOnly:true,complete:!page.hasMore,
   scannedObjectCount:page.blobs.length,ageEligibleCount:eligible.length,
   unreferencedCandidateCount,documentsDeleted:0,deletionAllowed:false,
   warning:page.hasMore?"PARTIAL_LISTING":"CANDIDATES_NOT_AUTHORIZED_FOR_DELETION"});
 }catch{
  console.error("Private KYC blob inventory failed");
  return privateJson({ok:false,error:"INVENTORY_FAILED",complete:false,documentsDeleted:0},{status:500});
 }
}
