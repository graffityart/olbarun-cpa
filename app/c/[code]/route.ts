import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, clicks, partners, users, trackingLinks } from "@/db/schema";

function hashIp(value: string) { return createHash("sha256").update(value).digest("hex"); }

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params; const db = getDb();
  if(!/^[A-Za-z0-9_-]{8,80}$/.test(code))return Response.redirect(new URL("/partner/campaigns",request.url),302);
  const [row] = await db.select({ linkId: trackingLinks.id, campaignId: trackingLinks.campaignId, partnerId: trackingLinks.partnerId, subId: trackingLinks.subId, linkActive: trackingLinks.isActive, slug: campaigns.slug, settings: campaigns.settings, campaignStatus: campaigns.status, campaignType: campaigns.type, partnerStatus: users.status,partnerRole:users.role })
    .from(trackingLinks).innerJoin(campaigns, eq(trackingLinks.campaignId, campaigns.id)).innerJoin(partners,eq(trackingLinks.partnerId,partners.id)).innerJoin(users,eq(partners.userId,users.id)).where(eq(trackingLinks.trackingCode, code)).limit(1);
  if (!row || !row.linkActive || row.campaignType!=="CPA" || row.campaignStatus!=="ACTIVE" || row.partnerStatus!=="ACTIVE" || row.partnerRole!=="PARTNER") return Response.redirect(new URL("/partner/campaigns", request.url), 302);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const clickCode = `CLK-${randomBytes(7).toString("hex").toUpperCase()}`;
  const settings=(row.settings??{}) as Record<string,unknown>;
  const external=typeof settings.landingUrl==="string"?settings.landingUrl.trim():"";
  let landingUrl=`/l/${row.slug}`;
  if(external){try{const target=new URL(external);if(["https:","http:"].includes(target.protocol)&&!target.username&&!target.password&&target.hostname!=="localhost"&&!target.hostname.endsWith(".localhost"))landingUrl=target.toString();}catch{/* Fall back to hosted landing */}}
  await db.insert(clicks).values({ clickCode, trackingLinkId: row.linkId, campaignId: row.campaignId, partnerId: row.partnerId, subId: row.subId, referrer: request.headers.get("referer"), landingUrl, ipHash: hashIp(forwarded), userAgent: request.headers.get("user-agent") });
  const destination=new URL(landingUrl,request.url);destination.searchParams.set("click",clickCode);
  const response = new Response(null, {status:302,headers:{Location:destination.toString(),"Cache-Control":"private, no-store"}});
  response.headers.append("Set-Cookie", `olbarun_click=${encodeURIComponent(clickCode)}; Path=/; Max-Age=2592000; SameSite=Lax; Secure; HttpOnly`);
  return response;
}
