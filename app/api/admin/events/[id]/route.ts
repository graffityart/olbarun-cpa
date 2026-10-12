import {sql} from "drizzle-orm";
import {getDb} from "@/db";
import {parseEventSchedule} from "@/lib/event-schedule";
import {getCurrentUser} from "@/lib/auth/session";
import {requireSameOrigin} from "@/lib/security/origin";
export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){try{requireSameOrigin(request);}catch{return Response.json({ok:false,error:"INVALID_ORIGIN"},{status:403});}
const user=await getCurrentUser();if(!user||user.status!=="ACTIVE"||!["ADMIN","SUPER_ADMIN"].includes(user.role))return Response.json({ok:false,error:"FORBIDDEN"},{status:403});
const {id}=await context.params;if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return Response.json({ok:false,error:"INVALID_ID"},{status:400});
let body:Record<string,unknown>;try{body=await request.json();}catch{return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});}
const title=typeof body.title==="string"?body.title.trim():"",content=typeof body.content==="string"?body.content.trim():"",status=body.status;
if(title.length<2||title.length>160||content.length<5||content.length>20000||typeof status!=="string"||!["DRAFT","OPEN","ENDED"].includes(status))return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});
const viewCount=body.viewCount;if(typeof viewCount!=="number"||!Number.isInteger(viewCount)||viewCount<0||viewCount>2147483647)return Response.json({ok:false,error:"INVALID_VIEWS"},{status:400});
let dates:ReturnType<typeof parseEventSchedule>;try{dates=parseEventSchedule(body);}catch{return Response.json({ok:false,error:"INVALID_DATES"},{status:400});}
try{const rows=await getDb().execute(sql`UPDATE customer_events SET title=${title},content=${content},status=${status},view_count=${viewCount},starts_at=${dates.startsAt?.toISOString()??null}::timestamptz,ends_at=${dates.endsAt?.toISOString()??null}::timestamptz,updated_at=now() WHERE id=${id}::uuid RETURNING id`);if(!rows.length)return Response.json({ok:false,error:"NOT_FOUND"},{status:404});return Response.json({ok:true,id});}catch(e){console.error("Event update failed",e);return Response.json({ok:false,error:"SERVICE_UNAVAILABLE"},{status:503});}}

export async function DELETE(request:Request,context:{params:Promise<{id:string}>}){try{requireSameOrigin(request);}catch{return Response.json({ok:false,error:"INVALID_ORIGIN"},{status:403});}
const user=await getCurrentUser();if(!user||user.status!=="ACTIVE"||!["ADMIN","SUPER_ADMIN"].includes(user.role))return Response.json({ok:false,error:"FORBIDDEN"},{status:403});
const {id}=await context.params;if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return Response.json({ok:false,error:"INVALID_ID"},{status:400});
try{const rows=await getDb().execute(sql`DELETE FROM customer_events WHERE id=${id}::uuid RETURNING id`);if(!rows.length)return Response.json({ok:false,error:"NOT_FOUND"},{status:404});return Response.json({ok:true});}catch(e){console.error("Event delete failed",e);return Response.json({ok:false,error:"SERVICE_UNAVAILABLE"},{status:503});}}
