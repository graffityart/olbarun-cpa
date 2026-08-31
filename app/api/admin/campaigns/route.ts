import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { advertisers, campaignRates, campaigns, postingCampaigns } from "@/db/schema";

export const dynamic = "force-dynamic";

function makeCampaignCode(type: "CPA" | "POSTING") { return `${type}-${Date.now().toString(36).toUpperCase()}`; }
function makeSlug(name: string) { return `${name.toLowerCase().trim().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`; }
const optionalNumber = (value: unknown) => Number(value) > 0 ? Number(value) : null;

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select({ id: campaigns.id, campaignCode: campaigns.campaignCode, type: campaigns.type, name: campaigns.name, status: campaigns.status, companyName: advertisers.companyName, createdAt: campaigns.createdAt })
      .from(campaigns).leftJoin(advertisers, eq(campaigns.advertiserId, advertisers.id)).orderBy(desc(campaigns.createdAt));
    return Response.json({ ok: true, campaigns: rows });
  } catch (error) { console.error("Failed to list campaigns", error); return Response.json({ ok: false, campaigns: [], error: "DATABASE_NOT_READY" }, { status: 503 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const type: "CPA" | "POSTING" = body.type === "POSTING" ? "POSTING" : "CPA";
    const advertiserId = String(body.advertiserId ?? "").trim(); const name = String(body.name ?? "").trim();
    if (!advertiserId || !name) return Response.json({ ok: false, error: "ADVERTISER_AND_NAME_REQUIRED" }, { status: 400 });

    const advertiserRate = Number(body.advertiserRate ?? 0); const partnerBaseRate = Number(body.partnerBaseRate ?? 0);
    if (advertiserRate < 0 || partnerBaseRate < 0 || partnerBaseRate > advertiserRate) return Response.json({ ok: false, error: "INVALID_RATE" }, { status: 400 });

    const db = getDb();
    const [campaign] = await db.insert(campaigns).values({
      campaignCode: makeCampaignCode(type), advertiserId, type, name, slug: makeSlug(name), category: String(body.category ?? "").trim() || null,
      description: String(body.description ?? "").trim() || null, status: "DRAFT", startAt: body.startAt ? new Date(body.startAt) : null, endAt: body.endAt ? new Date(body.endAt) : null,
      dailyConversionLimit: optionalNumber(body.dailyConversionLimit), monthlyConversionLimit: optionalNumber(body.monthlyConversionLimit), dailyBudgetLimit: optionalNumber(body.dailyBudgetLimit), monthlyBudgetLimit: optionalNumber(body.monthlyBudgetLimit),
      duplicateDays: Number(body.duplicateDays ?? 30), reviewDays: Number(body.reviewDays ?? 7), settings: body.settings ?? {},
    }).returning();

    if (advertiserRate || partnerBaseRate) await db.insert(campaignRates).values({ campaignId: campaign.id, advertiserRate, partnerBaseRate, minimumMargin: Math.max(0, advertiserRate - partnerBaseRate) });
    if (type === "POSTING") await db.insert(postingCampaigns).values({ campaignId: campaign.id, mediaType: String(body.mediaType ?? "BLOG"), participantLimit: optionalNumber(body.participantLimit), totalSubmissionLimit: optionalNumber(body.totalSubmissionLimit), perPartnerLimit: Number(body.perPartnerLimit ?? 1), minimumCharacters: optionalNumber(body.minimumCharacters), minimumImages: optionalNumber(body.minimumImages), maintenanceDays: optionalNumber(body.maintenanceDays), reviewDays: Number(body.postingReviewDays ?? 3), revisionLimit: Number(body.revisionLimit ?? 2), rules: body.postingRules ?? {} });

    return Response.json({ ok: true, campaign }, { status: 201 });
  } catch (error) { console.error("Failed to create campaign", error); return Response.json({ ok: false, error: "CREATE_FAILED" }, { status: 500 }); }
}
