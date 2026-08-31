import { destroySession } from "@/lib/auth/session";
import { requireSameOrigin } from "@/lib/security/origin";
export async function POST(request:Request){try{requireSameOrigin(request);await destroySession();return Response.json({ok:true});}catch(e){const error=e instanceof Error?e.message:"LOGOUT_FAILED";return Response.json({ok:false,error},{status:error==="INVALID_ORIGIN"?403:500});}}
