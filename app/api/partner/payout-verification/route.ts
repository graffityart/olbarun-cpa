import {put,del} from "@vercel/blob";
import {getDb} from "@/db";
import {getCurrentUser} from "@/lib/auth/session";
import {requireSameOrigin} from "@/lib/security/origin";
import {sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
export const runtime="nodejs";
const MAX_BYTES=5*1024*1024;
function detect(bytes:Uint8Array){
 if(bytes.length>=4&&bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46)return {ext:"pdf",mime:"application/pdf"};
 if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return {ext:"jpg",mime:"image/jpeg"};
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return {ext:"png",mime:"image/png"};
 return null;
}
export async function POST(request:Request){
 try{
  requireSameOrigin(request);
  const user=await getCurrentUser();
  if(!user||user.status!=="ACTIVE"||user.role!=="PARTNER"||!user.partnerId)return Response.json({ok:false,error:"UNAUTHORIZED"},{status:401});
  const contentLength=Number(request.headers.get("content-length")??0);
  if(contentLength>MAX_BYTES*2+1024*1024)return Response.json({ok:false,error:"FILE_SIZE_INVALID"},{status:413});
  const form=await request.formData();
  const bank=form.get("bankDocument"),identity=form.get("identityDocument"),documentType=form.get("documentType");
  if(!(bank instanceof File)||!(identity instanceof File)||!["PERSONAL_ID","BUSINESS_REGISTRATION"].includes(String(documentType)))return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});
  if(bank.size<8||identity.size<8||bank.size>MAX_BYTES||identity.size>MAX_BYTES)return Response.json({ok:false,error:"FILE_SIZE_INVALID"},{status:400});
  const bankBytes=new Uint8Array(await bank.arrayBuffer()),identityBytes=new Uint8Array(await identity.arrayBuffer());
  const bankFormat=detect(bankBytes),identityFormat=detect(identityBytes);
  if(!bankFormat||!identityFormat)return Response.json({ok:false,error:"FILE_TYPE_INVALID"},{status:400});
  const partner=await getDb().execute(sql`select member_type from partners where id=${user.partnerId} limit 1`);
  if(partner.length!==1)return Response.json({ok:false,error:"PARTNER_NOT_FOUND"},{status:404});
  if(documentType==="BUSINESS_REGISTRATION"&&partner[0].member_type==="INDIVIDUAL")return Response.json({ok:false,error:"DOCUMENT_TYPE_MISMATCH"},{status:400});
  const existing=await getDb().execute(sql`select status from partner_payout_verifications where partner_id=${user.partnerId} limit 1`);
  if(existing[0]?.status==="PENDING"||existing[0]?.status==="APPROVED")return Response.json({ok:false,error:"ALREADY_SUBMITTED"},{status:409});
  const prefix=`payout-verifications/${user.partnerId}/${randomUUID()}`;
  const uploadedPaths:string[]=[];
  try{
  const bankBlob=await put(`${prefix}/bank.${bankFormat.ext}`,Buffer.from(bankBytes),{access:"private",contentType:bankFormat.mime,addRandomSuffix:true});
  uploadedPaths.push(bankBlob.pathname);
  const identityBlob=await put(`${prefix}/identity.${identityFormat.ext}`,Buffer.from(identityBytes),{access:"private",contentType:identityFormat.mime,addRandomSuffix:true});
  uploadedPaths.push(identityBlob.pathname);
  const updated=await getDb().execute(sql`insert into partner_payout_verifications(partner_id,status,bank_document_blob_path,identity_document_blob_path,document_type,submitted_at,created_at,updated_at)
   values(${user.partnerId},'PENDING',${bankBlob.pathname},${identityBlob.pathname},${String(documentType)},now(),now(),now())
   on conflict(partner_id) do update set status='PENDING',bank_document_blob_path=excluded.bank_document_blob_path,
   identity_document_blob_path=excluded.identity_document_blob_path,document_type=excluded.document_type,
   submitted_at=now(),reviewed_at=null,reviewed_by=null,rejection_reason=null,verified_account_fingerprint=null,updated_at=now()
   where partner_payout_verifications.status in ('NOT_SUBMITTED','REJECTED') returning id`);
  if(updated.length!==1){await Promise.allSettled(uploadedPaths.map(path=>del(path)));return Response.json({ok:false,error:"ALREADY_SUBMITTED"},{status:409});}
  }catch(uploadError){await Promise.allSettled(uploadedPaths.map(path=>del(path)));throw uploadError;}
  return Response.json({ok:true,status:"PENDING"},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("Payout verification submission failed",error);return Response.json({ok:false,error:"SUBMISSION_FAILED"},{status:500});}
}
