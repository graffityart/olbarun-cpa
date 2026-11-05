import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { requireSameOrigin } from "@/lib/security/origin";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  requireSameOrigin(req);
  await requireAdmin();
  const {id}=await params;
  if(!uuid.test(id))return Response.json({ok:false,error:"INVALID_ID"},{status:400});
  const body=await req.json();
  const image=body?.image;
  if(image!==null&&(typeof image!=="string"||image.length>200000||!/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(image)))return Response.json({ok:false,error:"INVALID_IMAGE"},{status:400});
  const db=getDb();
  const updated=await db.transaction(async tx=>{
   const [row]=await tx.select({id:campaigns.id,type:campaigns.type,settings:campaigns.settings}).from(campaigns).where(eq(campaigns.id,id)).for("update").limit(1);
   if(!row||row.type!=="POSTING")return false;
   const settings={...((row.settings??{}) as Record<string,unknown>)};
   if(image===null)delete settings.mainImage;else settings.mainImage=image;
   await tx.update(campaigns).set({settings,updatedAt:new Date()}).where(eq(campaigns.id,id));
   return true;
  });
  return updated?Response.json({ok:true}):Response.json({ok:false,error:"NOT_FOUND"},{status:404});
 }catch{return Response.json({ok:false,error:"SAVE_FAILED"},{status:500});}
}
