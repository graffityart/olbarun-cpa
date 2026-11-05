import {sql} from "drizzle-orm";
import {getDb} from "@/db";
import {getCurrentUser} from "@/lib/auth/session";
import {requireSameOrigin} from "@/lib/security/origin";
import {quickError} from "@/lib/quick";

export async function POST(request:Request){
 try{
  requireSameOrigin(request);
  const user=await getCurrentUser();
  if(!user||user.role!=="ADVERTISER"||user.status!=="ACTIVE")return Response.json({error:"UNAUTHORIZED"},{status:401});
  const body=await request.json();
  const title=String(body.title??"").trim(),category=String(body.category??"").trim();
  const description=String(body.description??"").trim(),instructions=String(body.instructions??"").trim(),notice=String(body.notice??"").trim(),targetUrl=String(body.target_url??"").trim();
  const reward=Number(body.reward),capacity=Number(body.capacity);
  let url:URL;try{url=new URL(targetUrl);}catch{return Response.json({error:"INVALID_INPUT"},{status:400});}
  if(!title||title.length>200||!category||category.length>40||![description,instructions,notice].every(v=>v.length>0&&v.length<=10000)||targetUrl.length>2000||!["https:","http:"].includes(url.protocol)||url.username||url.password||!Number.isSafeInteger(reward)||reward<1||reward>10000000||!Number.isSafeInteger(capacity)||capacity<1||capacity>1000000)return Response.json({error:"INVALID_INPUT"},{status:400});
  const rows=await getDb().execute(sql`insert into quick_jobs(title,category,description,instructions,notice,target_url,reward,capacity,status,registration_source,advertiser_id,approval_status)
  select ${title},${category},${description},${instructions},${notice},${targetUrl},${reward},${capacity},'DRAFT','ADVERTISER',au.advertiser_id,'PENDING'
  from advertiser_users au join advertisers a on a.id=au.advertiser_id where au.user_id=${user.id} and a.status='ACTIVE'
  returning id`);
  if(!rows.length)return Response.json({error:"ADVERTISER_NOT_APPROVED"},{status:403});
  return Response.json({ok:true,id:rows[0].id,status:"PENDING"},{status:201});
 }catch(e){return quickError(e);}
}
