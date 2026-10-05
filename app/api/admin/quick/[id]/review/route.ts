import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { earnings } from '@/db/schema';
import { quickUser,quickError,uuid } from '@/lib/quick';
import { requireSameOrigin } from '@/lib/security/origin';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{requireSameOrigin(request);const admin=await quickUser(true);const id=uuid((await params).id),b=await request.json();const decision=String(b.decision),reason=String(b.reason??'').trim();if(!['APPROVED','REJECTED'].includes(decision)||reason.length>2000)throw new Error('INVALID_INPUT');if(decision==='REJECTED'&&!reason)throw new Error('REASON_REQUIRED');
 await getDb().transaction(async tx=>{
  // Match submission lock order: job first, then submission. Approval and earning are atomic.
  const found=await tx.execute(sql`select job_id from quick_submissions where id=${id}`);if(!found.length)throw new Error('NOT_FOUND');
  await tx.execute(sql`select id from quick_jobs where id=${found[0].job_id} for update`);
  const rows=await tx.execute(sql`select s.*,j.title from quick_submissions s join quick_jobs j on j.id=s.job_id where s.id=${id} for update of s`);const s=rows[0];if(!s)throw new Error('NOT_FOUND');if(s.status!=='SUBMITTED')throw new Error('LOCKED');
  let earningId:string|null=null;if(decision==='APPROVED'){const [earning]=await tx.insert(earnings).values({partnerId:String(s.partner_id),type:'QUICK_APPROVAL',amount:Number(s.reward_snapshot),status:'AVAILABLE',description:`${s.title} 1초알바 승인 수익`}).returning({id:earnings.id});earningId=earning.id;}
  await tx.execute(sql`update quick_submissions set status=${decision},reason=${reason||null},reviewer_id=${admin.id},reviewed_at=now(),earning_id=${earningId} where id=${id}`);
 });return Response.json({ok:true});}catch(e){return quickError(e);}}
