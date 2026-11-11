import { getValidatedDatabaseUrl } from "@/db";
import {NextRequest} from "next/server";
import postgres from "postgres";
import {get,del} from "@vercel/blob";
import {getCurrentUser} from "@/lib/auth/session";
import {requireAdmin} from "@/lib/auth/guards";
import {requireSameOrigin} from "@/lib/security/origin";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function db(){return postgres(getValidatedDatabaseUrl(),{max:1});}
export async function GET(_req:NextRequest,{params}:{params:Promise<{campaignId:string;fileId:string}>}){
 const {campaignId,fileId}=await params;if(!uuid.test(campaignId)||!uuid.test(fileId))return new Response(null,{status:400});
 const user=await getCurrentUser();if(!user||user.status!=="ACTIVE"||!["ADMIN","SUPER_ADMIN","PARTNER"].includes(user.role))return new Response(null,{status:401});
 const sql=db();try{
 const rows=await sql`select m.filename,m.mime_type,m.file_data,c.status from posting_materials m join campaigns c on c.id=m.campaign_id where m.campaign_id=${campaignId} and m.id=${fileId} and c.type in ('POSTING','CPA')`;
 if(!rows.length){
 const blobRows=await sql`select m.filename,m.mime_type,m.blob_url,c.status from campaign_blob_materials m join campaigns c on c.id=m.campaign_id where m.campaign_id=${campaignId} and m.id=${fileId} and c.type in ('POSTING','CPA')`;
 if(!blobRows.length||(!["ADMIN","SUPER_ADMIN"].includes(user.role)&&!["ACTIVE","PAUSED","COMPLETED"].includes(blobRows[0].status)))return new Response(null,{status:404});
 const file=blobRows[0];
 const result=await get(file.blob_url,{access:"private"});
 if(result?.statusCode!==200)return new Response(null,{status:404});
 return new Response(result.stream,{headers:{"Content-Type":file.mime_type,"Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,"X-Content-Type-Options":"nosniff","Cache-Control":"private, no-store"}});
 }
 if(!["ADMIN","SUPER_ADMIN"].includes(user.role)&&!["ACTIVE","PAUSED","COMPLETED"].includes(rows[0].status))return new Response(null,{status:404});
 const file=rows[0];const data=Buffer.from(file.file_data);
 return new Response(new Uint8Array(data),{headers:{"Content-Type":file.mime_type,"Content-Length":String(data.length),"Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,"X-Content-Type-Options":"nosniff","Cache-Control":"private, no-store"}});
 }finally{await sql.end();}
}
export async function DELETE(req:NextRequest,{params}:{params:Promise<{campaignId:string;fileId:string}>}){
 try{requireSameOrigin(req);await requireAdmin();}catch{return Response.json({error:"FORBIDDEN"},{status:403});}
 const {campaignId,fileId}=await params;if(!uuid.test(campaignId)||!uuid.test(fileId))return Response.json({error:"INVALID_ID"},{status:400});
 const sql=db();try{
 const blobs=await sql`select blob_url from campaign_blob_materials where campaign_id=${campaignId} and id=${fileId}`;
 if(blobs.length){await del(blobs[0].blob_url);await sql`delete from campaign_blob_materials where campaign_id=${campaignId} and id=${fileId}`;return Response.json({ok:true});}
 const rows=await sql`delete from posting_materials where campaign_id=${campaignId} and id=${fileId} returning id`;
 return Response.json({ok:rows.length>0},{status:rows.length?200:404});
 }finally{await sql.end();}
}
