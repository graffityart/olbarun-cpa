import { destroySession } from "@/lib/auth/session";
import { requireSameOrigin } from "@/lib/security/origin";
export async function POST(request:Request){
 try{
  requireSameOrigin(request);
  await destroySession();
  // Native header/mobile forms navigate; fetch callers retain the JSON contract.
  if(request.headers.get('accept')?.includes('text/html'))return new Response(null,{status:303,headers:{Location:new URL('/login',request.url).toString(),'Cache-Control':'no-store'}});
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(e){const error=e instanceof Error?e.message:"LOGOUT_FAILED";return Response.json({ok:false,error},{status:error==="INVALID_ORIGIN"||error==="ORIGIN_CHECK_FAILED"?403:500});}
}
