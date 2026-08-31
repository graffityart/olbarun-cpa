import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { postingApplications, postingCampaigns } from "@/db/schema";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "PARTNER" || user.status !== "ACTIVE" || !user.partnerId) return new Response("Unauthorized", { status: 401 });
    const form = await request.formData();
    const campaignId = String(form.get("campaignId") ?? "").trim();
    if (!campaignId) return new Response("campaignId is required", { status: 400 });

    const db = getDb();
    const [postingCampaign] = await db.select().from(postingCampaigns).where(eq(postingCampaigns.campaignId, campaignId));
    if (!postingCampaign) return new Response("Posting campaign not found", { status: 404 });

    const existing = await db.select().from(postingApplications).where(and(eq(postingApplications.partnerId, user.partnerId), eq(postingApplications.postingCampaignId, postingCampaign.id)));
    if (existing.length >= postingCampaign.perPartnerLimit) return new Response("Per-partner limit reached", { status: 409 });

    const [application] = await db.insert(postingApplications).values({ postingCampaignId: postingCampaign.id, partnerId: user.partnerId, status: "APPLIED" }).returning();
    return Response.redirect(new URL(`/partner/posting/my?applied=${application.id}`, request.url), 303);
  } catch (error) { console.error("Posting apply failed", error); return new Response("Apply failed", { status: 500 }); }
}
