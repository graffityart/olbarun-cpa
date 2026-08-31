import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { requireSameOrigin } from "@/lib/security/origin";
function hashIp(ip:string){return createHash("sha256").update(ip).digest("hex");}
export async function POST(request:Request){try{requireSameOrigin(request);const body=await request.json();const email=String(body.email??"").trim().toLowerCase();const password=String(body.password??"");const db=getDb();const[user]=await db.select().from(users).where(eq(users.email,email)).limit(1);if(!user||!verifyPassword(password,user.passwordHash))return Response.json({ok:false,error:"INVALID_CREDENTIALS"},{status:401});if(user.status==="PENDING")return Response.json({ok:false,error:"APPROVAL_PENDING"},{status:403});if(user.status!=="ACTIVE")return Response.json({ok:false,error:"ACCOUNT_DISABLED"},{status:403});const forwarded=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"";await createSession(user.id,{userAgent:request.headers.get("user-agent"),ipHash:forwarded?hashIp(forwarded):null});await db.update(users).set({lastLoginAt:new Date(),updatedAt:new Date()}).where(eq(users.id,user.id));const destination=user.role==="PARTNER"?"/partner":user.role==="ADVERTISER"?"/advertiser":"/admin";return Response.json({ok:true,role:user.role,destination});}catch(error){const message=error instanceof Error?error.message:"LOGIN_FAILED";if(message==="INVALID_ORIGIN"||message==="ORIGIN_CHECK_FAILED")return Response.json({ok:false,error:message},{status:403});console.error("Login failed",error);return Response.json({ok:false,error:"LOGIN_FAILED"},{status:500});}}
