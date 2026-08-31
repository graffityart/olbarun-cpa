import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){const user=await getCurrentUser();if(!user)return Response.redirect(new URL("/login",request.url),302);const{id}=await params;await getDb().update(notifications).set({isRead:true}).where(and(eq(notifications.id,id),eq(notifications.userId,user.id)));const next=new URL(request.url).searchParams.get("next")||"/notifications";const safe=next.startsWith("/")&&!next.startsWith("//")?next:"/notifications";return Response.redirect(new URL(safe,request.url),303);}
