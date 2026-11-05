import {put,del} from "@vercel/blob";
import {payoutAccountFingerprint,validPayoutAccount} from "@/lib/payout-account";
import {getDb} from "@/db";
import {getCurrentUser} from "@/lib/auth/session";
import {requireSameOrigin} from "@/lib/security/origin";
import {sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
export const runtime="nodejs";
const MAX_BYTES=5*1024*1024;
function detect(bytes:Uint8Array){
 if(bytes.length>=8&&bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46&&bytes[4]===0x2d&&bytes[5]>=0x31&&bytes[5]<=0x32&&bytes[6]===0x2e&&bytes[7]>=0x30&&bytes[7]<=0x39)return {ext:"pdf",mime:"application/pdf"};
 if(bytes.length>=4&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff&&bytes[bytes.length-2]===0xff&&bytes[bytes.length-1]===0xd9)return {ext:"jpg",mime:"image/jpeg"};
 if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)&&[73,72,68,82].every((v,i)=>bytes[12+i]===v)&&[73,69,78,68,174,66,96,130].every((v,i)=>bytes[bytes.length-8+i]===v))return {ext:"png",mime:"image/png"};
 return null;
}
export async function POST(request:Request){
 try{
  requireSameOrigin(request);
  const user=await getCurrentUser();
  if(!user||user.status!=="ACTIVE"||user.role!=="PARTNER"||!user.partnerId)return Response.json({ok:false,error:"UNAUTHORIZED"},{status:401});
  const rawLength=request.headers.get("content-length");
  if(rawLength!==null&&(!/^\\d+$/.test(rawLength)||!Number.isSafeInteger(Number(rawLength))))return Response.json({ok:false,error:"INVALID_CONTENT_LENGTH"},{status:400});
  if(rawLength!==null&&Number(rawLength)>MAX_BYTES*2+1024*1024)return Response.json({ok:false,error:"FILE_SIZE_INVALID"},{status:413});
  const form=await request.formData();
  const allowedFields=new Set(["bankDocument","identityDocument","documentType","bankName","accountNumber","accountHolder"]);
  if([...form.keys()].some(key=>!allowedFields.has(key)))return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});
  if([...allowedFields].some(key=>form.getAll(key).length!==1))return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});
  const bank=form.get("bankDocument"),identity=form.get("identityDocument"),documentType=form.get("documentType");
  const bankName=form.get("bankName"),accountNumber=form.get("accountNumber"),accountHolder=form.get("accountHolder");
  if(typeof bankName!=="string"||typeof accountNumber!=="string"||typeof accountHolder!=="string"||typeof documentType!=="string")return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});
  const account={bankName,accountNumber,accountHolder};
  if(!validPayoutAccount(account))return Response.json({ok:false,error:"INVALID_PAYOUT_ACCOUNT"},{status:400});
  const accountFingerprint=payoutAccountFingerprint(account);
  if(!(bank instanceof File)||!(identity instanceof File)||!["PERSONAL_ID","BUSINESS_REGISTRATION"].includes(documentType))return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});
  if(bank.size<8||identity.size<8||bank.size>MAX_BYTES||identity.size>MAX_BYTES)return Response.json({ok:false,error:"FILE_SIZE_INVALID"},{status:400});
  const bankBytes=new Uint8Array(await bank.arrayBuffer()),identityBytes=new Uint8Array(await identity.arrayBuffer());
  const bankFormat=detect(bankBytes),identityFormat=detect(identityBytes);
  if(!bankFormat||!identityFormat)return Response.json({ok:false,error:"FILE_TYPE_INVALID"},{status:400});
  const partner=await getDb().execute(sql`select member_type from partners where id=${user.partnerId} limit 1`);
  if(partner.length!==1)return Response.json({ok:false,error:"PARTNER_NOT_FOUND"},{status:404});
  if(documentType==="BUSINESS_REGISTRATION"&&partner[0].member_type==="INDIVIDUAL")return Response.json({ok:false,error:"DOCUMENT_TYPE_MISMATCH"},{status:400});
  const existing=await getDb().execute(sql`select status,submitted_at from partner_payout_verifications where partner_id=${user.partnerId} limit 1`);
  if(existing[0]?.status==="PENDING"||existing[0]?.status==="APPROVED")return Response.json({ok:false,error:"ALREADY_SUBMITTED"},{status:409});
  if(existing[0]?.status==="REJECTED"&&existing[0]?.submitted_at&&Date.now()-new Date(String(existing[0].submitted_at)).getTime()<10*60*1000)return Response.json({ok:false,error:"RESUBMISSION_COOLDOWN"},{status:429,headers:{"Retry-After":"600"}});
  const prefix=`payout-verifications/${user.partnerId}/${randomUUID()}`;
  const uploadedPaths:string[]=[];
  try{
  const bankBlob=await put(`${prefix}/bank.${bankFormat.ext}`,Buffer.from(bankBytes),{access:"private",contentType:bankFormat.mime,addRandomSuffix:true});
  uploadedPaths.push(bankBlob.pathname);
  const identityBlob=await put(`${prefix}/identity.${identityFormat.ext}`,Buffer.from(identityBytes),{access:"private",contentType:identityFormat.mime,addRandomSuffix:true});
  uploadedPaths.push(identityBlob.pathname);
  const updated=await getDb().execute(sql`insert into partner_payout_verifications(partner_id,status,bank_document_blob_path,identity_document_blob_path,document_type,verified_account_fingerprint,submitted_at,created_at,updated_at)
   values(${user.partnerId},'PENDING',${bankBlob.pathname},${identityBlob.pathname},${documentType},${accountFingerprint},now(),now(),now())
   on conflict(partner_id) do update set status='PENDING',bank_document_blob_path=excluded.bank_document_blob_path,
   identity_document_blob_path=excluded.identity_document_blob_path,document_type=excluded.document_type,
   submitted_at=now(),reviewed_at=null,reviewed_by=null,rejection_reason=null,verified_account_fingerprint=excluded.verified_account_fingerprint,updated_at=now()
   where partner_payout_verifications.status='NOT_SUBMITTED' or (partner_payout_verifications.status='REJECTED' and (partner_payout_verifications.submitted_at is null or partner_payout_verifications.submitted_at<=now()-interval '10 minutes')) returning id`);
  if(updated.length!==1){await Promise.allSettled(uploadedPaths.map(path=>del(path)));return Response.json({ok:false,error:"RESUBMISSION_COOLDOWN_OR_ALREADY_SUBMITTED"},{status:409});}
  }catch(uploadError){await Promise.allSettled(uploadedPaths.map(path=>del(path)));throw uploadError;}
  return Response.json({ok:true,status:"PENDING"},{headers:{"Cache-Control":"no-store"}});
 }catch(error){const code=error instanceof Error?error.message:"SUBMISSION_FAILED";if(code==="PAYOUT_ACCOUNT_SECRET_MISSING")return Response.json({ok:false,error:code},{status:503});if(code==="INVALID_ORIGIN"||code==="ORIGIN_CHECK_FAILED")return Response.json({ok:false,error:code},{status:403});console.error("Payout verification submission failed",error);return Response.json({ok:false,error:"SUBMISSION_FAILED"},{status:500});}
}
