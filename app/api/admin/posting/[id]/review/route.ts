import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { postingReviews, postingSubmissions } from "@/db/schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const decision = String(body.decision ?? "");
    const reason = String(body.reason ?? "").trim();
    if (!["APPROVED", "REVISION_REQUESTED", "REJECTED"].includes(decision)) {
      return Response.json({ ok: false, error: "INVALID_DECISION" }, { status: 400 });
    }

    const db = getDb();
    await db.transaction(async (tx) => {
      await tx.insert(postingReviews).values({ submissionId: id, decision, reason: reason || null });
      const [current] = await tx.select({ revisionCount: postingSubmissions.revisionCount }).from(postingSubmissions).where(eq(postingSubmissions.id, id));
      if (!current) throw new Error("SUBMISSION_NOT_FOUND");
      await tx.update(postingSubmissions).set({
        status: decision,
        revisionCount: decision === "REVISION_REQUESTED" ? current.revisionCount + 1 : current.revisionCount,
        reviewedAt: new Date(),
      }).where(eq(postingSubmissions.id, id));
    });

    return Response.json({ ok: true, status: decision });
  } catch (error) {
    console.error("Posting review failed", error);
    return Response.json({ ok: false, error: "REVIEW_FAILED" }, { status: 500 });
  }
}
