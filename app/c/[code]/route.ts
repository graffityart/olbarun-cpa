import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, clicks, trackingLinks } from "@/db/schema";

function hashIp(value: string) { return createHash("sha256").update(value).digest("hex"); }

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params; const db = getDb();
  const [row] = await db.select({ linkId: trackingLinks.id, campaignId: trackingLinks.campaignId, partnerId: trackingLinks.partnerId, subId: trackingLinks.subId, isActive: trackingLinks.isActive, slug: campaigns.slug })
    .from(trackingLinks).innerJoin(campaigns, eq(trackingLinks.campaignId, campaigns.id)).where(eq(trackingLinks.trackingCode, code)).limit(1);
  if (!row || !row.isActive) return Response.redirect(new URL("/", request.url), 302);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const clickCode = `CLK-${randomBytes(7).toString("hex").toUpperCase()}`;
  const landingUrl = `/l/${row.slug}`;
  await db.insert(clicks).values({ clickCode, trackingLinkId: row.linkId, campaignId: row.campaignId, partnerId: row.partnerId, subId: row.subId, referrer: request.headers.get("referer"), landingUrl, ipHash: hashIp(forwarded), userAgent: request.headers.get("user-agent") });
  const response = Response.redirect(new URL(`${landingUrl}?click=${encodeURIComponent(clickCode)}`, request.url), 302);
  response.headers.append("Set-Cookie", `olbarun_click=${encodeURIComponent(clickCode)}; Path=/; Max-Age=2592000; SameSite=Lax; Secure; HttpOnly`);
  return response;
}
