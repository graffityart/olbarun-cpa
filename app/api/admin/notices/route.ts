import {getDb} from '@/db';
import {customerNotices} from '@/db/schema/notices';
import {auditLogs} from '@/db/schema';
import {getCurrentUser} from '@/lib/auth/session';
import {requireSameOrigin} from '@/lib/security/origin';
export async function POST(request:Request){
 try{requireSameOrigin(request);}catch{return Response.json({ok:false,error:'INVALID_ORIGIN'},{status:403});}
 const admin=await getCurrentUser();
 if(!admin||admin.status!=='ACTIVE')return Response.json({ok:false,error:'UNAUTHORIZED'},{status:401});
 if(!['ADMIN','SUPER_ADMIN'].includes(admin.role))return Response.json({ok:false,error:'FORBIDDEN'},{status:403});
 let body;try{body=await request.json();}catch{return Response.json({ok:false,error:'INVALID_INPUT'},{status:400});}
 if(!body||typeof body.title!=='string'||typeof body.content!=='string')return Response.json({ok:false,error:'INVALID_INPUT'},{status:400});
 const title=body.title.trim(),content=body.content.trim();
 if(title.length<2||title.length>160||content.length<5||content.length>20000)return Response.json({ok:false,error:'INVALID_INPUT'},{status:400});
 try{const id=await getDb().transaction(async tx=>{const [notice]=await tx.insert(customerNotices).values({title,content,authorUserId:admin.id}).returning({id:customerNotices.id});await tx.insert(auditLogs).values({actorUserId:admin.id,action:'CUSTOMER_NOTICE_CREATED',targetType:'CUSTOMER_NOTICE',targetId:notice.id,summary:'공지사항 등록',metadata:{title}});return notice.id;});return Response.json({ok:true,id},{status:201});}
 catch(error){console.error('Notice create failed',error);return Response.json({ok:false,error:'CREATE_FAILED'},{status:500});}
}
