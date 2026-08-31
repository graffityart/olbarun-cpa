import { createHash, randomBytes } from "node:crypto";
import { and, eq, gte } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { campaignRates, campaigns, clicks, conversionData, conversions, trackingLinks } from "@/db/schema";

const hash = (v: string) => createHash("sha256").update(v).digest("hex");
const normalizePhone = (v: string) => v.replace(/\D/g, "");

export async function POST(request: Request) {
  try {
    const body = await request.json(); const campaignId = String(body.campaignId ?? ""); const name = String(body.name ?? "").trim(); const phone = normalizePhone(String(body.phone ?? ""));
    if (!campaignId || !name || !/^01\d{8,9}$/.test(phone)) return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    if (!body.privacy || !body.thirdParty) return Response.json({ ok: false, error: "CONSENT_REQUIRED" }, { status: 400 });
    const db = getDb(); const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, campaignId), eq(campaigns.type, "CPA"))).limit(1); if (!campaign) return Response.json({ ok: false, error: "CAMPAIGN_NOT_FOUND" }, { status: 404 });
    const [rate] = await db.select().from(campaignRates).where(eq(campaignRates.campaignId, campaignId)).limit(1); if (!rate) return Response.json({ ok: false, error: "RATE_NOT_CONFIGURED" }, { status: 409 });
    const phoneHash = hash(phone); const duplicateSince = new Date(Date.now() - campaign.duplicateDays * 86400000);
    const duplicates = await db.select({ id: conversionData.id }).from(conversionData).innerJoin(conversions, eq(conversionData.conversionId, conversions.id)).where(and(eq(conversions.campaignId, campaignId), eq(conversionData.customerPhoneHash, phoneHash), gte(conversions.submittedAt, duplicateSince))).limit(1);
    if (duplicates.length) return Response.json({ ok: false, error: "DUPLICATE" }, { status: 409 });

    const cookieStore = await cookies(); const clickCode = cookieStore.get("olbarun_click")?.value ?? null;
    let click: { id: string; partnerId: string; trackingLinkId: string } | undefined;
    if (clickCode) [click] = await db.select({ id: clicks.id, partnerId: clicks.partnerId, trackingLinkId: clicks.trackingLinkId }).from(clicks).where(and(eq(clicks.clickCode, clickCode), eq(clicks.campaignId, campaignId))).limit(1);
    const conversionCode = `CV-${randomBytes(7).toString("hex").toUpperCase()}`; const margin = rate.advertiserRate - rate.partnerBaseRate;
    const [conversion] = await db.insert(conversions).values({ conversionCode, campaignId, partnerId: click?.partnerId ?? null, trackingLinkId: click?.trackingLinkId ?? null, clickId: click?.id ?? null, status: "RECEIVED", advertiserRateSnapshot: rate.advertiserRate, partnerRateSnapshot: rate.partnerBaseRate, platformMarginSnapshot: margin, duplicateStatus: "NORMAL", fraudStatus: "NORMAL" }).returning();
    await db.insert(conversionData).values({ conversionId: conversion.id, customerName: name, customerPhoneEncrypted: phone, customerPhoneHash: phoneHash, region: String(body.region ?? "").trim() || null, formData: {}, privacyPolicyVersion: "privacy-v1", thirdPartyPolicyVersion: "third-party-v1", privacyAgreedAt: new Date(), thirdPartyAgreedAt: new Date() });
    return Response.json({ ok: true, conversionCode }, { status: 201 });
  } catch (error) { console.error("Conversion create failed", error); return Response.json({ ok: false, error: "CREATE_FAILED" }, { status: 500 }); }
}
