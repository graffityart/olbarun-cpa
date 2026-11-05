import { NextRequest } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireAdmin } from "@/lib/auth/guards";
import { requireSameOrigin } from "@/lib/security/origin";
import postgres from "postgres";
import {head} from "@vercel/blob";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maxBytes = 50 * 1024 * 1024;
const types = ["application/zip", "application/x-zip-compressed", "application/pdf", "image/jpeg", "image/png", "image/webp"];
function db() { if (!process.env.DATABASE_URL) throw Error("DATABASE_NOT_READY"); return postgres(process.env.DATABASE_URL, {max:1}); }

export async function POST(req:NextRequest,{params}:{params:Promise<{campaignId:string}>}) {
 const {campaignId}=await params;
 if(!uuid.test(campaignId))return Response.json({error:"INVALID_ID"},{status:400});
 try {
  const body=(await req.json()) as HandleUploadBody;
  const result=await handleUpload({
   request:req,body,
   onBeforeGenerateToken:async(pathname)=>{
    requireSameOrigin(req);
    await requireAdmin();
    const ext=pathname.toLowerCase().match(/\.[^.]+$/)?.[0]??"";
    if(![".zip",".pdf",".jpg",".jpeg",".png",".webp"].includes(ext))throw Error("INVALID_FILE");
    const sql=db();
    try{
     const campaigns=await sql`select id from campaigns where id=${campaignId} and type in ('POSTING','CPA')`;
     if(!campaigns.length)throw Error("CAMPAIGN_NOT_FOUND");
    }finally{await sql.end();}
    return {allowedContentTypes:types,maximumSizeInBytes:maxBytes,addRandomSuffix:true,tokenPayload:JSON.stringify({campaignId})};
   },
   onUploadCompleted:async({blob,tokenPayload})=>{
    const payload=JSON.parse(tokenPayload??"{}") as {campaignId?:string};
    if(payload.campaignId!==campaignId||!uuid.test(payload.campaignId??""))throw Error("INVALID_CAMPAIGN");
    const filename=decodeURIComponent(blob.pathname.split("/").pop()??"file").replace(/-[a-zA-Z0-9]{12,}(?=\.[^.]+$)/,"").slice(0,180);
    const metadata=await head(blob.url);
    const ext=filename.toLowerCase().match(/\.[^.]+$/)?.[0]??"";
    const limits:Record<string,number>={".zip":50*1024*1024,".pdf":20*1024*1024,".jpg":10*1024*1024,".jpeg":10*1024*1024,".png":10*1024*1024,".webp":10*1024*1024};
    if(!limits[ext]||metadata.size>limits[ext])throw Error("FILE_LIMIT_EXCEEDED");
    const sql=db();
    try{
     await sql`insert into campaign_blob_materials(campaign_id,filename,mime_type,file_size,blob_url)
       select id,${filename},${blob.contentType},${metadata.size},${blob.url} from campaigns
       where id=${campaignId} and type in ('POSTING','CPA') and not exists (select 1 from campaign_blob_materials where blob_url=${blob.url})`;
    }finally{await sql.end();}
   }
  });
  return Response.json(result);
 }catch(e){return Response.json({error:e instanceof Error?e.message:"UPLOAD_FAILED"},{status:400});}
}
