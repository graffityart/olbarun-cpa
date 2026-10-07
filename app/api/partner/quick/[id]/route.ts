import {parseQuickWorkedAt} from "@/lib/quick-worked-at";
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { quickUser,quickError,uuid } from '@/lib/quick';
import { requireSameOrigin } from '@/lib/security/origin';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
 requireSameOrigin(request);const user=await quickUser();const id=uuid((await params).id);
 if(Number(request.headers.get('content-length')??0)>3000000)throw new Error('IMAGE_LIMIT');
 const form=await request.formData();const action=String(form.get('action')??'apply');
 if(!['apply','submit'].includes(action))throw new Error('INVALID_INPUT');
 const account=String(form.get('account')??'').trim(),note=String(form.get('note')??'').trim(),workedRaw=String(form.get('workedAt')??'');
 const workedAt=parseQuickWorkedAt(workedRaw);const proofs:{type:string;data:string}[]=[];
 if(action==='submit'){
  if(!account||account.length>120||!note||note.length>4000||!workedAt||workedAt.getTime()>Date.now()+60000||form.get('agree')!=='on')throw new Error('INVALID_INPUT');
  const files=form.getAll('proofs').filter((x):x is File=>typeof x!=='string'&&x.size>0);
  if(!files.length||files.length>3||files.some(x=>x.size>700000))throw new Error('IMAGE_LIMIT');
  for(const file of files){const b=Buffer.from(await file.arrayBuffer());const type=b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':b[0]===255&&b[1]===216&&b[2]===255?'image/jpeg':b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP'?'image/webp':null;if(!type||type!==file.type)throw new Error('INVALID_IMAGE');proofs.push({type,data:b.toString('base64')});}
 }
 await getDb().transaction(async tx=>{
  const jobs=await tx.execute(sql`select * from quick_jobs where id=${id} for update`);const job=jobs[0];if(!job)throw new Error('NOT_FOUND');
  const rows=await tx.execute(sql`select * from quick_submissions where job_id=${id} and partner_id=${user.partnerId!} for update`);const current=rows[0];
  if(action==='apply'&&current)return;
  if(job.status!=='OPEN')throw new Error('CLOSED');
  if(!current||current.status==='REJECTED'){const used=await tx.execute(sql`select count(*)::int as n from quick_submissions where job_id=${id} and status<>'REJECTED'`);if(Number(used[0]?.n)>=Number(job.capacity))throw new Error('FULL');}
  if(action==='apply'){await tx.execute(sql`insert into quick_submissions(job_id,partner_id,reward_snapshot) values(${id},${user.partnerId!},${job.reward})`);return;}
  if(!current)throw new Error('INVALID_INPUT');if(!['APPLIED','REJECTED'].includes(String(current.status)))throw new Error('LOCKED');
  await tx.execute(sql`update quick_submissions set account=${account},worked_at=${workedAt},note=${note},proofs=${JSON.stringify(proofs)}::jsonb,status='SUBMITTED',submitted_at=now(),reason=null,reviewer_id=null,reviewed_at=null where id=${current.id}`);
 });return Response.json({ok:true});
 }catch(e){return quickError(e);}}
