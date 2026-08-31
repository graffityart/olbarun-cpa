import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { advertiserLedger, campaigns, conversions, earnings } from "@/db/schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const body = await request.json(); const decision = body.decision === "APPROVED" ? "APPROVED" : body.decision === "REJECTED" ? "REJECTED" : null;
  if (!decision) return Response.json({ ok: false, error: "INVALID_DECISION" }, { status: 400 });
  const db = getDb();
  try {
    const result = await db.transaction(async tx => {
      const [row] = await tx.select({ conversion: conversions, advertiserId: campaigns.advertiserId }).from(conversions).innerJoin(campaigns, eq(conversions.campaignId, campaigns.id)).where(eq(conversions.id, id)).limit(1);
      if (!row) throw new Error("NOT_FOUND"); if (["APPROVED", "REJECTED"].includes(row.conversion.status)) throw new Error("ALREADY_FINAL");
      const now = new Date(); await tx.update(conversions).set({ status: decision, approvedAt: decision === "APPROVED" ? now : null, rejectedAt: decision === "REJECTED" ? now : null, updatedAt: now }).where(eq(conversions.id, id));
      if (decision === "APPROVED") {
        await tx.insert(advertiserLedger).values({ advertiserId: row.advertiserId, conversionId: id, type: "CPA_APPROVAL", amount: -row.conversion.advertiserRateSnapshot, description: `${row.conversion.conversionCode} 승인 광고비` });
        if (row.conversion.partnerId && row.conversion.partnerRateSnapshot > 0) await tx.insert(earnings).values({ partnerId: row.conversion.partnerId, conversionId: id, type: "CPA_APPROVAL", amount: row.conversion.partnerRateSnapshot, status: "AVAILABLE", description: `${row.conversion.conversionCode} CPA 승인 수익` });
      }
      return { status: decision };
    });
    return Response.json({ ok: true, ...result });
  } catch (e) { const message = e instanceof Error ? e.message : "REVIEW_FAILED"; return Response.json({ ok: false, error: message }, { status: message === "NOT_FOUND" ? 404 : 409 }); }
}
