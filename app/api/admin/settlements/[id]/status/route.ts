import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { settlements } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return Response.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }
    const [row] = await getDb().select({
      status: settlements.status,
      approvedAt: settlements.approvedAt,
      paidAt: settlements.paidAt,
    }).from(settlements).where(eq(settlements.id, id)).limit(1);
    if (!row) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    return Response.json({ ok: true, ...row }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Settlement status lookup failed", error);
    return Response.json({ ok: false, error: "STATUS_LOOKUP_FAILED" }, { status: 500 });
  }
}
