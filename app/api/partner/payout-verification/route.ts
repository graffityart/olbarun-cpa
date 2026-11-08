import {put,del} from "@vercel/blob";
import {payoutAccountFingerprint,validPayoutAccount} from "@/lib/payout-account";
import {getDb} from "@/db";
import {getCurrentUser} from "@/lib/auth/session";
import {requireSameOrigin} from "@/lib/security/origin";
import {sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
export const runtime="nodejs";
const MAX_BYTES=5*1024*1024;
// Never allow browsers or intermediate caches to store identity-upload responses.
const privateJson:typeof Response.json=(data,init)=>Response.json(data,{...init,headers:{...Object.fromEntries(new Headers(init?.headers)),"Cache-Control":"no-store"}});
function detect(bytes:Uint8Array){
 if(bytes.length>=16&&bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46&&bytes[4]===0x2d&&bytes[5]>=0x31&&bytes[5]<=0x32&&bytes[6]===0x2e&&bytes[7]>=0x30&&bytes[7]<=0x39){
  // Reject truncated PDFs lacking a terminal EOF marker; this is not a PDF sanitizer.
  const tail=Buffer.from(bytes.subarray(Math.max(0,bytes.length-1024))).toString("latin1");
  if(!/%%EOF(?:\r?\n|\r|[ \t])*$/i.test(tail))return null;
  return {ext:"pdf",mime:"application/pdf"};
 }
 if(bytes.length>=16&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff&&bytes[bytes.length-2]===0xff&&bytes[bytes.length-1]===0xd9){
  // Walk JPEG markers until a Start of Frame header is found. Do not trust SOI/EOI alone.
  let offset=2,validFrame=false,validScan=false,frameComponents=0;
  const frameComponentIds=new Set<number>();
  while(offset+4<bytes.length){
   if(bytes[offset]!==0xff)break;
   while(bytes[offset]===0xff)offset++;
   const marker=bytes[offset++];
   if(marker===0xd9)break;
   if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
   if(offset+2>bytes.length)break;
   const length=(bytes[offset]<<8)|bytes[offset+1];
   if(length<2||offset+length>bytes.length)break;
   if(marker===0xda){
    // SOS length is 6 + 2 * scan component count; reject truncated or malformed scan headers.
    const scanComponents=bytes[offset+2];
    if(validFrame&&scanComponents>=1&&scanComponents<=frameComponents&&length===6+2*scanComponents&&offset+length<bytes.length-2){
     const scanIds=new Set<number>();
     let validIds=true;
     for(let i=0;i<scanComponents;i++){
      const id=bytes[offset+3+2*i];
      if(!frameComponentIds.has(id)||scanIds.has(id)){validIds=false;break;}
      scanIds.add(id);
     }
     if(validIds)validScan=true;
    }
    break;
   }
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
    // A second SOF must not replace the dimensions or component IDs of the first frame.
    if(validFrame)break;
    if(length<9)break;
    const precision=bytes[offset+2];
    if(marker===0xc0?precision!==8:![8,12].includes(precision))break;
    const components=bytes[offset+7];
    if(components<1||components>4||length!==8+3*components)break;
    const height=(bytes[offset+3]<<8)|bytes[offset+4],width=(bytes[offset+5]<<8)|bytes[offset+6];
    if(width<1||height<1||width>10000||height>10000||width*height>25000000)break;
    frameComponentIds.clear();
    let validIds=true;
    for(let i=0;i<components;i++){
     const id=bytes[offset+8+3*i];
     if(frameComponentIds.has(id)){validIds=false;break;}
     frameComponentIds.add(id);
    }
    if(!validIds)break;
    frameComponents=components;
    validFrame=true;
   }
   offset+=length;
  }
  if(validFrame&&validScan)return {ext:"jpg",mime:"image/jpeg"};
 }
 if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)&&[73,72,68,82].every((v,i)=>bytes[12+i]===v)&&[73,69,78,68,174,66,96,130].every((v,i)=>bytes[bytes.length-8+i]===v)){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  // PNG's first chunk must be the 13-byte IHDR; reject malformed headers.
  if(view.getUint32(8)!==13||bytes.length<45)return null;
  // IEND must be the final zero-length chunk with the standard PNG CRC.
  if(view.getUint32(bytes.length-12)!==0)return null;
  // Walk intervening chunks without trusting their declared lengths.
  // This checks framing only; full PNG decoding and malware scanning remain separate.
  let chunkOffset=33;
  let sawIdat=false;
  let idatEnded=false;
  let sawPlte=false;
  const endOffset=bytes.length-12;
  while(chunkOffset<endOffset){
   if(chunkOffset+12>endOffset)return null;
   const chunkLength=view.getUint32(chunkOffset);
   if(chunkLength>endOffset-chunkOffset-12)return null;
   for(let i=chunkOffset+4;i<chunkOffset+8;i++){
    const c=bytes[i];
    if(!((c>=65&&c<=90)||(c>=97&&c<=122)))return null;
   }
   // Unknown critical chunks (uppercase first letter) cannot be safely interpreted.
   const knownCritical=([73,68,65,84].every((v,i)=>bytes[chunkOffset+4+i]===v)||
    [80,76,84,69].every((v,i)=>bytes[chunkOffset+4+i]===v));
   if(bytes[chunkOffset+4]>=65&&bytes[chunkOffset+4]<=90&&!knownCritical)return null;
   const isIdat=[73,68,65,84].every((v,i)=>bytes[chunkOffset+4+i]===v);
   const isPlte=[80,76,84,69].every((v,i)=>bytes[chunkOffset+4+i]===v);
   if(isIdat){
    if(idatEnded)return null;
    sawIdat=true;
   }else if(sawIdat)idatEnded=true;
   if(isPlte){
    if(sawPlte||sawIdat||chunkLength===0||chunkLength%3!==0||chunkLength>768)return null;
    sawPlte=true;
   }
   // IHDR is only permitted as the first chunk; IEND must be terminal.
   if([73,72,68,82].every((v,i)=>bytes[chunkOffset+4+i]===v))return null;
   if([73,69,78,68].every((v,i)=>bytes[chunkOffset+4+i]===v))return null;
   // CRC covers chunk type and payload, excluding length and stored CRC.
   let chunkCrc=0xffffffff;
   const crcEnd=chunkOffset+8+chunkLength;
   for(let i=chunkOffset+4;i<crcEnd;i++){
    chunkCrc^=bytes[i];
    for(let bit=0;bit<8;bit++)chunkCrc=(chunkCrc>>>1)^((chunkCrc&1)?0xedb88320:0);
   }
   if(((chunkCrc^0xffffffff)>>>0)!==view.getUint32(crcEnd))return null;
   chunkOffset+=chunkLength+12;
  }
  if(chunkOffset!==endOffset||!sawIdat)return null;
  // Validate the IHDR CRC (chunk type + 13-byte data) before trusting dimensions.
  let crc=0xffffffff;
  for(let i=12;i<29;i++){
   crc^=bytes[i];
   for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  if(((crc^0xffffffff)>>>0)!==view.getUint32(29))return null;
  const width=view.getUint32(16),height=view.getUint32(20);
  const depth=bytes[24],color=bytes[25];
  const allowedDepths:Record<number,number[]>={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
  if(!allowedDepths[color]?.includes(depth)||bytes[26]!==0||bytes[27]!==0||bytes[28]>1)return null;
  // Reject impossible or excessively large PNG dimensions before private storage.
  if(width<1||height<1||width>10000||height>10000||width*height>25000000)return null;
  return {ext:"png",mime:"image/png"};
 }
 return null;
}
export async function POST(request:Request){
 if(process.env.PAYOUT_KYC_DOCUMENT_UPLOAD!=="enabled")return privateJson({ok:false,error:"DOCUMENT_UPLOAD_UNAVAILABLE"},{status:503});
 try{
  requireSameOrigin(request);
  const user=await getCurrentUser();
  if(!user||user.status!=="ACTIVE"||user.role!=="PARTNER"||!user.partnerId)return privateJson({ok:false,error:"UNAUTHORIZED"},{status:401});
  // Fail closed: enabling sensitive document uploads requires the DB-backed rate limiter.
  // Migration 0021 must exist before both flags are enabled in any environment.
  if(process.env.PAYOUT_UPLOAD_RATE_LIMIT!=="enabled")return privateJson({ok:false,error:"UPLOAD_RATE_LIMIT_UNAVAILABLE"},{status:503});
  {
   // Atomic DB counter works across serverless instances.
   const attempts=await getDb().execute(sql`insert into partner_payout_upload_limits(partner_id,window_started_at,attempt_count,updated_at)
    values(${user.partnerId},now(),1,now())
    on conflict(partner_id) do update set
     window_started_at=case when partner_payout_upload_limits.window_started_at<=now()-interval '1 hour' then now() else partner_payout_upload_limits.window_started_at end,
     attempt_count=case when partner_payout_upload_limits.window_started_at<=now()-interval '1 hour' then 1 else least(partner_payout_upload_limits.attempt_count+1,6) end,
     updated_at=now()
    returning attempt_count,extract(epoch from (window_started_at+interval '1 hour'-now())) as retry_seconds`);
   if(Number(attempts[0]?.attempt_count)>5){
    const retryAfter=Math.max(1,Math.ceil(Number(attempts[0]?.retry_seconds)||3600));
    return privateJson({ok:false,error:"UPLOAD_RATE_LIMITED"},{status:429,headers:{"Retry-After":String(retryAfter)}});
   }
  }
  // Reject non-multipart requests before parsing potentially large bodies.
  const contentType=request.headers.get("content-type")??"";
  // Require one well-formed boundary parameter; reject extra or ambiguous parameters.
  if(!/^multipart\/form-data\s*;\s*boundary=(?:"[A-Za-z0-9\x27()+_,.\/:=?-]{1,70}"|[A-Za-z0-9\x27()+_,.\/:=?-]{1,70})\s*$/i.test(contentType))return privateJson({ok:false,error:"INVALID_CONTENT_TYPE"},{status:415});
  const rawLength=request.headers.get("content-length");
  if(rawLength!==null&&(!/^\d+$/.test(rawLength)||!Number.isSafeInteger(Number(rawLength))))return privateJson({ok:false,error:"INVALID_CONTENT_LENGTH"},{status:400});
  if(rawLength!==null&&Number(rawLength)>MAX_BYTES*2+1024*1024)return privateJson({ok:false,error:"FILE_SIZE_INVALID"},{status:413});
  // A missing or forged Content-Length must not bypass the total upload limit.
  // Read at most the permitted payload size before invoking the multipart parser.
  const maxRequestBytes=MAX_BYTES*2+1024*1024;
  if(!request.body)return privateJson({ok:false,error:"INVALID_INPUT"},{status:400});
  const reader=request.body.getReader();
  const chunks:Uint8Array[]=[];
  let totalBytes=0;
  try{
   while(true){
    const {done,value}=await reader.read();
    if(done)break;
    totalBytes+=value.byteLength;
    if(totalBytes>maxRequestBytes){await reader.cancel().catch(()=>{});return privateJson({ok:false,error:"FILE_SIZE_INVALID"},{status:413});}
    chunks.push(value);
   }
  }finally{reader.releaseLock();}
  const form=await new Request(request.url,{method:"POST",headers:request.headers,body:new Blob(chunks.map(chunk=>new Uint8Array(chunk)))}).formData().catch(()=>null);
  if(!form)return privateJson({ok:false,error:"INVALID_MULTIPART_BODY"},{status:400});
  const allowedFields=new Set(["bankDocument","identityDocument","documentType","bankName","accountNumber","accountHolder","privacyMaskConfirmed"]);
  if([...form.keys()].some(key=>!allowedFields.has(key)))return privateJson({ok:false,error:"INVALID_INPUT"},{status:400});
  if([...allowedFields].some(key=>form.getAll(key).length!==1))return privateJson({ok:false,error:"INVALID_INPUT"},{status:400});
  if(form.get("privacyMaskConfirmed")!=="true")return privateJson({ok:false,error:"PRIVACY_MASK_CONFIRMATION_REQUIRED"},{status:400});
  const bank=form.get("bankDocument"),identity=form.get("identityDocument"),documentType=form.get("documentType");
  const bankName=form.get("bankName"),accountNumber=form.get("accountNumber"),accountHolder=form.get("accountHolder");
  if(typeof bankName!=="string"||typeof accountNumber!=="string"||typeof accountHolder!=="string"||typeof documentType!=="string")return privateJson({ok:false,error:"INVALID_INPUT"},{status:400});
  const account={bankName,accountNumber,accountHolder};
  if(!validPayoutAccount(account))return privateJson({ok:false,error:"INVALID_PAYOUT_ACCOUNT"},{status:400});
  const accountFingerprint=payoutAccountFingerprint(account);
  if(!(bank instanceof File)||!(identity instanceof File)||!["PERSONAL_ID","BUSINESS_REGISTRATION"].includes(documentType))return privateJson({ok:false,error:"INVALID_INPUT"},{status:400});
  if(bank.size<8||identity.size<8||bank.size>MAX_BYTES||identity.size>MAX_BYTES)return privateJson({ok:false,error:"FILE_SIZE_INVALID"},{status:400});
  const bankBytes=new Uint8Array(await bank.arrayBuffer()),identityBytes=new Uint8Array(await identity.arrayBuffer());
  const bankFormat=detect(bankBytes),identityFormat=detect(identityBytes);
  if(!bankFormat||!identityFormat)return privateJson({ok:false,error:"FILE_TYPE_INVALID"},{status:400});
  // The filename extension must agree with the validated binary signature.
  // This does not replace malware scanning or content sanitization.
  const allowedExtensions:Record<string,string[]>={pdf:["pdf"],jpg:["jpg","jpeg"],png:["png"]};
  const bankExtension=bank.name.toLowerCase().split(".").pop()??"";
  const identityExtension=identity.name.toLowerCase().split(".").pop()??"";
  if(!allowedExtensions[bankFormat.ext].includes(bankExtension)||!allowedExtensions[identityFormat.ext].includes(identityExtension))
   return privateJson({ok:false,error:"FILE_TYPE_INVALID"},{status:400});
  // File.type is browser-supplied and not authoritative, but a mismatch is suspicious.
  // Empty MIME values are allowed for clients that omit this optional metadata.
  if((bank.type&&bank.type!==bankFormat.mime)||(identity.type&&identity.type!==identityFormat.mime))
   return privateJson({ok:false,error:"FILE_TYPE_INVALID"},{status:400});

  const partner=await getDb().execute(sql`select member_type from partners where id=${user.partnerId} limit 1`);
  if(partner.length!==1)return privateJson({ok:false,error:"PARTNER_NOT_FOUND"},{status:404});
  if(documentType==="BUSINESS_REGISTRATION"&&partner[0].member_type==="INDIVIDUAL")return privateJson({ok:false,error:"DOCUMENT_TYPE_MISMATCH"},{status:400});
  const existing=await getDb().execute(sql`select status,submitted_at,bank_document_blob_path,identity_document_blob_path from partner_payout_verifications where partner_id=${user.partnerId} limit 1`);
  if(existing[0]?.status==="PENDING"||existing[0]?.status==="APPROVED")return privateJson({ok:false,error:"ALREADY_SUBMITTED"},{status:409});
  if(existing[0]?.status==="REJECTED"&&existing[0]?.submitted_at){
   const submittedAt=new Date(String(existing[0].submitted_at)).getTime();
   if(Number.isFinite(submittedAt)){
    const remainingMs=10*60*1000-(Date.now()-submittedAt);
    if(remainingMs>0)return privateJson({ok:false,error:"RESUBMISSION_COOLDOWN"},{status:429,headers:{"Retry-After":String(Math.ceil(remainingMs/1000))}});
   }
  }
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
  if(updated.length!==1){await Promise.allSettled(uploadedPaths.map(path=>del(path)));return privateJson({ok:false,error:"RESUBMISSION_COOLDOWN_OR_ALREADY_SUBMITTED"},{status:409});}
  }catch(uploadError){await Promise.allSettled(uploadedPaths.map(path=>del(path)));throw uploadError;}
  // Only delete previously rejected documents after the new submission is committed.
  // A second concurrent request may have won the DB update, so verify the paths
  // are no longer referenced before removing any old private blobs.
  const oldPaths=[existing[0]?.bank_document_blob_path,existing[0]?.identity_document_blob_path]
   .filter((path):path is string=>typeof path==="string"&&path.startsWith(`payout-verifications/${user.partnerId}/`));
  if(oldPaths.length){
   try{
    const current=await getDb().execute(sql`select bank_document_blob_path,identity_document_blob_path from partner_payout_verifications where partner_id=${user.partnerId} limit 1`);
    const active=new Set([current[0]?.bank_document_blob_path,current[0]?.identity_document_blob_path]);
    const obsolete=oldPaths.filter(path=>!active.has(path));
    const cleanupResults=await Promise.allSettled(obsolete.map(path=>del(path)));
    const failedCount=cleanupResults.filter(result=>result.status==="rejected").length;
    if(failedCount>0)console.error("Old payout verification blob cleanup incomplete",{failedCount});
   }catch(cleanupError){console.error("Old payout verification blob cleanup deferred");}
  }
  return privateJson({ok:true,status:"PENDING"},{headers:{"Cache-Control":"no-store"}});
 }catch(error){const code=error instanceof Error?error.message:"SUBMISSION_FAILED";if(code==="PAYOUT_ACCOUNT_SECRET_MISSING")return privateJson({ok:false,error:code},{status:503});if(code==="INVALID_ORIGIN"||code==="ORIGIN_CHECK_FAILED")return privateJson({ok:false,error:code},{status:403});console.error("Payout verification submission failed",{code:"SUBMISSION_FAILED"});return privateJson({ok:false,error:"SUBMISSION_FAILED"},{status:500});}
}
