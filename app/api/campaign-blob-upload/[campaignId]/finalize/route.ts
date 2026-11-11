import { getValidatedDatabaseUrl } from "@/db";
import { NextRequest } from "next/server";
import { head } from "@vercel/blob";
import postgres from "postgres";
import { getCurrentUser } from "@/lib/auth/session";
import { requireSameOrigin } from "@/lib/security/origin";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const limits: Record<string, number> = { ".zip":50*1024*1024, ".pdf":20*1024*1024, ".jpg":10*1024*1024, ".jpeg":10*1024*1024, ".png":10*1024*1024, ".webp":10*1024*1024 };
const mime: Record<string, string[]> = { ".zip":["application/zip","application/x-zip-compressed","application/octet-stream"], ".pdf":["application/pdf"], ".jpg":["image/jpeg"], ".jpeg":["image/jpeg"], ".png":["image/png"], ".webp":["image/webp"] };

export async function POST(req: NextRequest, {params}:{params:Promise<{campaignId:string}>}) {
 if (process.env.PAYOUT_TEST_PROJECT_ID === "orange-salad-93665842") {
  return Response.json({error:"UPLOAD_FINALIZE_DISABLED_IN_PAYOUT_TEST"},{status:503});
 }
 try {
  requireSameOrigin(req);
  const user=await getCurrentUser();
  if(!user||user.status!=="ACTIVE"||!["ADMIN","SUPER_ADMIN"].includes(user.role))return Response.json({error:"FORBIDDEN"},{status:403});
  const {campaignId}=await params;
  if(!uuid.test(campaignId))return Response.json({error:"INVALID_CAMPAIGN"},{status:400});
  const body=await req.json();
  const url=typeof body.url==="string"?body.url:"";
  if(url.length>2048)return Response.json({error:"INVALID_URL"},{status:400});
  const metadata=await head(url);
  if(!metadata.pathname.startsWith(`campaigns/${campaignId}/`))return Response.json({error:"INVALID_PATH"},{status:400});
  const filename=metadata.pathname.split("/").pop()?.replace(/-[a-zA-Z0-9]{12,}(?=\.[^.]+$)/,"").slice(0,180)??"";
  const ext=filename.toLowerCase().match(/\.[^.]+$/)?.[0]??"";
  if(!limits[ext]||metadata.size<=0||metadata.size>limits[ext]||!mime[ext].includes(metadata.contentType))return Response.json({error:"INVALID_FILE"},{status:400});
  const sql=postgres(getValidatedDatabaseUrl(),{max:1});
  try {
   const rows=await sql`insert into campaign_blob_materials(campaign_id,filename,mime_type,file_size,blob_url)
    select id,${filename},${metadata.contentType},${metadata.size},${url} from campaigns
    where id=${campaignId} and type in ('CPA','POSTING')
    on conflict (blob_url) do update set filename=excluded.filename
    returning id`;
   if(!rows.length)return Response.json({error:"CAMPAIGN_NOT_FOUND"},{status:404});
   return Response.json({ok:true,id:rows[0].id});
  }finally{await sql.end();}
 }catch(error){return Response.json({error:error instanceof Error?error.message:"FINALIZE_FAILED"},{status:400});}
}
