import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { campaigns, trackingLinks } from "@/db/schema";

function makeCode() { return randomBytes(9).toString("base64url"); }

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE" || user.role !== "PARTNER" || !user.partnerId) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json(); const campaignId = String(body.campaignId ?? ""); const subId = String(body.subId ?? "").trim().slice(0, 120) || null;
  const db = getDb(); const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, campaignId), eq(campaigns.type, "CPA"))).limit(1);
  if (!campaign) return Response.json({ ok: false, error: "CAMPAIGN_NOT_FOUND" }, { status: 404 });
  const [row] = await db.insert(trackingLinks).values({ trackingCode: makeCode(), campaignId, partnerId: user.partnerId, subId, isActive: true }).returning();
  return Response.json({ ok: true, link: row, url: `/c/${row.trackingCode}` }, { status: 201 });
}
