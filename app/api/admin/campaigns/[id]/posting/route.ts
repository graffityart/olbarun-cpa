import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, postingCampaigns } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { requireSameOrigin } from "@/lib/security/origin";
import { validatePostingLimits } from "@/lib/cpa/posting-limits.mjs";

const optionalInt = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error("INVALID_LIMIT");
  return n;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    await requireAdmin();
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) return Response.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    const input: unknown = await request.json().catch(() => null);
    if (!input || typeof input !== "object" || Array.isArray(input)) return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    const data = input as Record<string, unknown>;
    const validation = validatePostingLimits(data);
    if (validation) return Response.json({ ok: false, error: validation }, { status: 400 });
    const minimumCharacters = optionalInt(data.minimumCharacters);
    const minimumImages = optionalInt(data.minimumImages);
    const maintenanceDays = optionalInt(data.maintenanceDays);
    const updated = await getDb().transaction(async tx => {
      const [campaign] = await tx.select({ type: campaigns.type }).from(campaigns).where(eq(campaigns.id, id)).for("update").limit(1);
      if (!campaign || campaign.type !== "POSTING") return null;
      const [row] = await tx.update(postingCampaigns).set({
        mediaType: String(data.mediaType ?? "BLOG"),
        participantLimit: optionalInt(data.participantLimit),
        totalSubmissionLimit: optionalInt(data.totalSubmissionLimit),
        perPartnerLimit: Number(data.perPartnerLimit ?? 1),
        minimumCharacters, minimumImages, maintenanceDays,
        reviewDays: Number(data.postingReviewDays ?? 3),
        revisionLimit: Number(data.revisionLimit ?? 2),
        updatedAt: new Date(),
      }).where(eq(postingCampaigns.campaignId, id)).returning({ id: postingCampaigns.id });
      return row ?? null;
    });
    if (!updated) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UPDATE_FAILED";
    const status = code === "INVALID_ORIGIN" || code === "ORIGIN_CHECK_FAILED" ? 403 : code.startsWith("INVALID_") ? 400 : 500;
    if (status === 500) console.error("Failed to update posting campaign", error);
    return Response.json({ ok: false, error: status === 500 ? "UPDATE_FAILED" : code }, { status });
  }
}
