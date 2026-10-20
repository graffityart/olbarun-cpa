import {requireSameOrigin} from "@/lib/security/origin";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { campaigns, trackingLinks } from "@/db/schema";

function makeCode() { return randomBytes(9).toString("base64url"); }

export async function POST(request: Request) {
  try{requireSameOrigin(request);const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE" || user.role !== "PARTNER" || !user.partnerId) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const body: unknown = await request.json(); if(!body || typeof body!=="object" || Array.isArray(body)) return Response.json({ok:false,error:"INVALID_INPUT"},{status:400}); const input=body as Record<string,unknown>; if(typeof input.campaignId!=="string" || (input.subId!==undefined && typeof input.subId!=="string"))return Response.json({ok:false,error:"INVALID_INPUT"},{status:400}); const campaignId=input.campaignId; const subId=(input.subId??"") as string; const normalizedSubId=subId.trim(); if(normalizedSubId.length>120 || !/^[a-zA-Z0-9_-]*$/.test(normalizedSubId))return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campaignId))return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});
  const db = getDb(); const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, campaignId), eq(campaigns.type, "CPA"))).limit(1);
  if (!campaign) return Response.json({ ok: false, error: "CAMPAIGN_NOT_FOUND" }, { status: 404 });
  const now=new Date();const error=campaign.status!=="ACTIVE"?"NOT_ACTIVE":campaign.startAt&&campaign.startAt>now?"NOT_STARTED":campaign.endAt&&campaign.endAt<=now?"ENDED":null;if(error)return Response.json({ok:false,error},{status:409});
  const [row] = await db.insert(trackingLinks).values({ trackingCode: makeCode(), campaignId, partnerId: user.partnerId, subId: normalizedSubId || null, isActive: true }).returning();
  return Response.json({ ok: true, link: row, url: `/c/${row.trackingCode}` }, { status: 201 });
  }catch(error){const code=error instanceof Error?error.message:"";if(code==="INVALID_ORIGIN"||code==="ORIGIN_CHECK_FAILED")return Response.json({ok:false,error:code},{status:403});if(error instanceof SyntaxError)return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});console.error("Tracking link failed",error);return Response.json({ok:false,error:"SERVICE_UNAVAILABLE"},{status:503});}
}
