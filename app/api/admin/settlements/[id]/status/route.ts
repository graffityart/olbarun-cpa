import { and, asc, eq, inArray } from "drizzle-orm";
import { settlementAmountsMatch } from "@/lib/settlement-validation";
import { settlementAuditMatches } from "@/lib/settlement-validation";
import { getDb } from "@/db";
import { auditLogs, settlementItems, settlements } from "@/db/schema";
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
      requestedAmount: settlements.requestedAmount,
      paymentAmount: settlements.paymentAmount,
      deductionAmount: settlements.deductionAmount,
      approvedAt: settlements.approvedAt,
      paidAt: settlements.paidAt,
    }).from(settlements).where(eq(settlements.id, id)).limit(1);
    if (!row) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    const audit = await getDb().select({ action: auditLogs.action }).from(auditLogs)
      .where(and(eq(auditLogs.targetType, "SETTLEMENT"), eq(auditLogs.targetId, id),
        inArray(auditLogs.action, ["SETTLEMENT_APPROVE", "SETTLEMENT_PAID", "SETTLEMENT_REJECT"])))
      .orderBy(asc(auditLogs.createdAt), asc(auditLogs.id));
    const auditVerified = settlementAuditMatches(row.status as "REQUESTED"|"APPROVED"|"PAID"|"REJECTED", audit.map(entry => entry.action));
    const items = await getDb().select({ amount: settlementItems.amount }).from(settlementItems)
      .where(eq(settlementItems.settlementId, id));
    const amountVerified = settlementAmountsMatch(items.map(item => item.amount), row.requestedAmount, row.paymentAmount, row.deductionAmount);
    return Response.json({ ok: true, status: row.status, approvedAt: row.approvedAt, paidAt: row.paidAt, auditVerified, amountVerified }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Settlement status lookup failed", error);
    return Response.json({ ok: false, error: "STATUS_LOOKUP_FAILED" }, { status: 500 });
  }
}
