import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
export async function POST(){const user=await getCurrentUser();if(!user)return Response.json({ok:false,error:"UNAUTHORIZED"},{status:401});await getDb().update(notifications).set({isRead:true}).where(eq(notifications.userId,user.id));return Response.json({ok:true});}
