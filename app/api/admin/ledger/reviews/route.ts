import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { conversions, cpaLedgerReviews } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.status !== "ACTIVE" || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin) return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { conversionId, status, note } = body as Record<string, unknown>;
  if (typeof conversionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversionId) || typeof status !== "string" || !["IN_REVIEW", "RESOLVED", "REOPENED"].includes(status) || typeof note !== "string" || note.length > 1000) return NextResponse.json({ error: "Invalid review" }, { status: 400 });
  if (status === "RESOLVED" && !note.trim()) return NextResponse.json({ error: "Resolution note required" }, { status: 400 });
  const db = getDb();
  const [conversion] = await db.select({ id: conversions.id, status: conversions.status }).from(conversions).where(eq(conversions.id, conversionId)).limit(1);
  if (!conversion || conversion.status !== "APPROVED") return NextResponse.json({ error: "Conversion not found" }, { status: 404 });
  const [review] = await db.insert(cpaLedgerReviews).values({ conversionId, reviewerUserId: user.id, status, note: note.trim() }).returning({ id: cpaLedgerReviews.id });
  return NextResponse.json({ ok: true, review });
}
