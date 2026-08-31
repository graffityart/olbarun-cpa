import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { postingApplications, postingCampaigns } from "@/db/schema";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const campaignId = String(form.get("campaignId") ?? "").trim();
    const partnerId = String(form.get("partnerId") ?? "").trim();
    if (!campaignId || !partnerId) return new Response("campaignId and partnerId are required", { status: 400 });

    const db = getDb();
    const [postingCampaign] = await db.select().from(postingCampaigns).where(eq(postingCampaigns.campaignId, campaignId));
    if (!postingCampaign) return new Response("Posting campaign not found", { status: 404 });

    const existing = await db.select().from(postingApplications).where(eq(postingApplications.partnerId, partnerId));
    const sameCampaignCount = existing.filter((row) => row.postingCampaignId === postingCampaign.id).length;
    if (sameCampaignCount >= postingCampaign.perPartnerLimit) return new Response("Per-partner limit reached", { status: 409 });

    const [application] = await db.insert(postingApplications).values({ postingCampaignId: postingCampaign.id, partnerId, status: "APPLIED" }).returning();
    return Response.redirect(new URL(`/partner/posting/my?partnerId=${partnerId}&applied=${application.id}`, request.url), 303);
  } catch (error) {
    console.error("Posting apply failed", error);
    return new Response("Apply failed", { status: 500 });
  }
}
