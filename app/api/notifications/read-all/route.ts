import {and,eq} from 'drizzle-orm';import {getDb} from '@/db';import {notifications} from '@/db/schema';import {getCurrentUser} from '@/lib/auth/session';import {requireSameOrigin} from '@/lib/security/origin';
export async function POST(request:Request){
 try{requireSameOrigin(request);}catch{return Response.json({ok:false,error:'INVALID_ORIGIN'},{status:403});}
 const user=await getCurrentUser();if(!user||user.status!=='ACTIVE')return Response.json({ok:false,error:'UNAUTHORIZED'},{status:401});
 try{await getDb().update(notifications).set({isRead:true}).where(and(eq(notifications.userId,user.id),eq(notifications.isRead,false)));return Response.json({ok:true});}catch(error){console.error('Notification read-all failed',error);return Response.json({ok:false,error:'READ_FAILED'},{status:500});}
}
