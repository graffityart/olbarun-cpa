import {getDb} from "@/db";
import {sql} from "drizzle-orm";
import {getCurrentUser} from "@/lib/auth/session";
import {requireSameOrigin} from "@/lib/security/origin";
export async function POST(request:Request){
 try{requireSameOrigin(request);}catch{return Response.json({ok:false,error:"INVALID_ORIGIN"},{status:403});}
 const user=await getCurrentUser();
 if(!user||user.status!=="ACTIVE"||!["ADMIN","SUPER_ADMIN"].includes(user.role))return Response.json({ok:false,error:"FORBIDDEN"},{status:403});
 let body:Record<string,unknown>;try{body=await request.json();}catch{return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});}
 const title=typeof body.title==="string"?body.title.trim():"",content=typeof body.content==="string"?body.content.trim():"",status=typeof body.status==="string"?body.status:"DRAFT";
 if(title.length<2||title.length>160||content.length<5||content.length>20000||!["DRAFT","OPEN","ENDED"].includes(status))return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});
 try{const rows=await getDb().execute(sql`INSERT INTO customer_events(title,content,status,author_user_id) VALUES (${title},${content},${status},${user.id}::uuid) RETURNING id`);return Response.json({ok:true,id:rows[0]?.id},{status:201});}
 catch(error){console.error("Event create failed",error);return Response.json({ok:false,error:"SERVICE_UNAVAILABLE"},{status:503});}
}
