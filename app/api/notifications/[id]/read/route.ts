import {and,eq} from 'drizzle-orm';
import {getDb} from '@/db';
import {notifications} from '@/db/schema';
import {getCurrentUser} from '@/lib/auth/session';
import {requireSameOrigin} from '@/lib/security/origin';
import {notificationDestination} from '@/lib/notification-destination';
async function markRead(id:string,userId:string){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return null;
  const [item]=await getDb().update(notifications).set({isRead:true}).where(and(eq(notifications.id,id),eq(notifications.userId,userId))).returning({href:notifications.href});
  return item?notificationDestination(item.href):null;
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{requireSameOrigin(request);}catch{return Response.json({ok:false,error:'INVALID_ORIGIN'},{status:403});}
  const user=await getCurrentUser();if(!user||user.status!=='ACTIVE')return Response.json({ok:false,error:'UNAUTHORIZED'},{status:401});
  try{const {id}=await params;const href=await markRead(id,user.id);if(!href)return Response.json({ok:false,error:'NOT_FOUND'},{status:404});return Response.json({ok:true,href},{headers:{'Cache-Control':'private, no-store'}});}catch(error){console.error('Notification read failed',error);return Response.json({ok:false,error:'READ_FAILED'},{status:500});}
}
// Preserve old notification links; destinations always come from the user's own stored notification.
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser();if(!user||user.status!=='ACTIVE')return Response.redirect(new URL('/login?next=/notifications',request.url),302);
  try{const {id}=await params;const href=await markRead(id,user.id);return new Response(null,{status:303,headers:{Location:new URL(href??'/notifications',request.url).toString(),'Cache-Control':'private, no-store'}});}catch(error){console.error('Notification read failed',error);return Response.json({ok:false,error:'READ_FAILED'},{status:500});}
}
