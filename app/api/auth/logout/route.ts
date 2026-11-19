import { destroySession } from "@/lib/auth/session";
import { requireSameOrigin } from "@/lib/security/origin";
export async function POST(request:Request){
 try{
  requireSameOrigin(request);
  await destroySession();
  // Native header/mobile forms navigate; fetch callers retain the JSON contract.
  if(request.headers.get('accept')?.includes('text/html'))return new Response(null,{status:303,headers:{Location:new URL('/login',request.url).toString(),'Cache-Control':'no-store'}});
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(e){const message=e instanceof Error?e.message:"LOGOUT_FAILED";const forbidden=message==="INVALID_ORIGIN"||message==="ORIGIN_CHECK_FAILED";if(!forbidden)console.error("Logout failed",e);return Response.json({ok:false,error:forbidden?message:"LOGOUT_FAILED"},{status:forbidden?403:500,headers:{"Cache-Control":"no-store"}});}
}
