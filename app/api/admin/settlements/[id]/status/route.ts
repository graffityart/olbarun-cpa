import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, settlements } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    if (user.status !== "ACTIVE" || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
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
    const expectedAction = row.status === "APPROVED" ? "SETTLEMENT_APPROVE" : row.status === "PAID" ? "SETTLEMENT_PAID" : row.status === "REJECTED" ? "SETTLEMENT_REJECT" : null;
    const audit = expectedAction ? await getDb().select({ id: auditLogs.id }).from(auditLogs).where(and(eq(auditLogs.targetType, "SETTLEMENT"), eq(auditLogs.targetId, id), eq(auditLogs.action, expectedAction))).limit(1) : [];
    return Response.json({ ok: true, ...row, auditVerified: expectedAction ? audit.length > 0 : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Settlement status lookup failed", error);
    return Response.json({ ok: false, error: "STATUS_LOOKUP_FAILED" }, { status: 500 });
  }
}
