import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { postingApplications, postingSubmissions } from "@/db/schema";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const applicationId = String(form.get("applicationId") ?? "").trim();
    const partnerId = String(form.get("partnerId") ?? "").trim();
    const title = String(form.get("title") ?? "").trim();
    const postUrl = String(form.get("postUrl") ?? "").trim();
    const note = String(form.get("note") ?? "").trim() || null;
    const publishedAtRaw = String(form.get("publishedAt") ?? "").trim();

    if (!applicationId || !partnerId || !title || !postUrl) return new Response("Required fields missing", { status: 400 });
    if (!/^https?:\/\//i.test(postUrl)) return new Response("Invalid URL", { status: 400 });

    const db = getDb();
    const [application] = await db.select().from(postingApplications).where(eq(postingApplications.id, applicationId));
    if (!application || application.partnerId !== partnerId) return new Response("Forbidden", { status: 403 });

    const [existing] = await db.select().from(postingSubmissions).where(eq(postingSubmissions.applicationId, applicationId));
    if (existing) {
      await db.update(postingSubmissions).set({
        title,
        postUrl,
        note,
        publishedAt: publishedAtRaw ? new Date(publishedAtRaw) : null,
        status: "SUBMITTED",
        revisionCount: existing.status === "REVISION_REQUESTED" ? existing.revisionCount + 1 : existing.revisionCount,
        submittedAt: new Date(),
        reviewedAt: null,
      }).where(eq(postingSubmissions.id, existing.id));
    } else {
      await db.insert(postingSubmissions).values({
        applicationId,
        title,
        postUrl,
        note,
        publishedAt: publishedAtRaw ? new Date(publishedAtRaw) : null,
        status: "SUBMITTED",
      });
    }

    await db.update(postingApplications).set({ status: "SUBMITTED" }).where(eq(postingApplications.id, applicationId));
    return Response.redirect(new URL(`/partner/posting/my?partnerId=${partnerId}`, request.url), 303);
  } catch (error) {
    console.error("Posting submit failed", error);
    return new Response("Submit failed", { status: 500 });
  }
}
