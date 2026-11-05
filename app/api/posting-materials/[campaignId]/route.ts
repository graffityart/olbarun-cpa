import { NextRequest } from "next/server";
import postgres from "postgres";
import { getCurrentUser } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/guards";
import { requireSameOrigin } from "@/lib/security/origin";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowed=new Map([[".zip",["application/zip","application/x-zip-compressed","application/octet-stream"]],[".pdf",["application/pdf"]],[".jpg",["image/jpeg"]],[".jpeg",["image/jpeg"]],[".png",["image/png"]],[".webp",["image/webp"]]]);
const maxBytes=5*1024*1024;
function db(){if(!process.env.DATABASE_URL)throw Error("DATABASE_NOT_READY");return postgres(process.env.DATABASE_URL,{max:1});}
export async function GET(_req:NextRequest,{params}:{params:Promise<{campaignId:string}>}){
 const {campaignId}=await params;if(!uuid.test(campaignId))return Response.json({error:"INVALID_ID"},{status:400});
 const user=await getCurrentUser();if(!user||user.status!=="ACTIVE"||!["ADMIN","SUPER_ADMIN","PARTNER"].includes(user.role))return Response.json({error:"UNAUTHORIZED"},{status:401});
 const sql=db();try{
 const campaign=await sql`select type,status from campaigns where id=${campaignId}`;
 if(!campaign.length||!["POSTING","CPA"].includes(campaign[0].type))return Response.json({error:"NOT_FOUND"},{status:404});
 if(!["ADMIN","SUPER_ADMIN"].includes(user.role)&&!["ACTIVE","PAUSED","COMPLETED"].includes(campaign[0].status))return Response.json({error:"NOT_FOUND"},{status:404});
 const files=await sql`select id,filename,file_size,created_at from posting_materials where campaign_id=${campaignId} union all select id,filename,file_size,created_at from campaign_blob_materials where campaign_id=${campaignId} order by created_at desc`;
 return Response.json({ok:true,files},{headers:{"Cache-Control":"private, no-store"}});
 }finally{await sql.end();}
}
export async function POST(req:NextRequest,{params}:{params:Promise<{campaignId:string}>}){
 try{requireSameOrigin(req);await requireAdmin();}catch{return Response.json({error:"FORBIDDEN"},{status:403});}
 const {campaignId}=await params;if(!uuid.test(campaignId))return Response.json({error:"INVALID_ID"},{status:400});
 const length=Number(req.headers.get("content-length")??0);if(length>maxBytes+65536)return Response.json({error:"FILE_TOO_LARGE"},{status:413});
 const form=await req.formData().catch(()=>null);const file=form?.get("file");
 if(!(file instanceof File)||file.size===0||file.size>maxBytes||!(allowed.get(file.name.toLowerCase().match(/\.[^.]+$/)?.[0]??"")??[]).includes(file.type))return Response.json({error:"INVALID_FILE"},{status:400});
 const filename=file.name.replace(/[\\/\x00-\x1f\x7f]/g,"_").slice(0,180);
 if(!filename)return Response.json({error:"INVALID_FILENAME"},{status:400});
 const bytes=Buffer.from(await file.arrayBuffer());
 const ext=file.name.toLowerCase().match(/\.[^.]+$/)?.[0]??"";
 const signatureValid=ext===".zip"?bytes.length>=4&&bytes[0]===0x50&&bytes[1]===0x4b&&[[0x03,0x04],[0x05,0x06],[0x07,0x08]].some(([a,b])=>bytes[2]===a&&bytes[3]===b):
 ext===".pdf"?bytes.subarray(0,5).toString("ascii")==="%PDF-":
 ext===".jpg"||ext===".jpeg"?bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff:
 ext===".png"?bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
 ext===".webp"?bytes.length>=12&&bytes.subarray(0,4).toString("ascii")==="RIFF"&&bytes.subarray(8,12).toString("ascii")==="WEBP":false;
 if(!signatureValid)return Response.json({error:"INVALID_FILE_SIGNATURE"},{status:400});
 const sql=db();
 try{
 const rows=await sql`insert into posting_materials(campaign_id,filename,mime_type,file_size,file_data)
 select id,${filename},${file.type},${bytes.length},${bytes} from campaigns where id=${campaignId} and type in ('POSTING','CPA')
 returning id`;
 if(!rows.length)return Response.json({error:"NOT_FOUND"},{status:404});
 return Response.json({ok:true,id:rows[0].id},{status:201});
 }finally{await sql.end();}
}
