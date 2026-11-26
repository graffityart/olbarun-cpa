import { and, asc, eq, inArray } from "drizzle-orm";
import { settlementAmountsMatch, hasUniqueSettlementEarnings } from "@/lib/settlement-validation";
import { settlementAuditMatches } from "@/lib/settlement-validation";
import { getDb } from "@/db";
import { auditLogs, earnings, settlementItems, settlements } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
const privateResponseHeaders = { "Cache-Control": "no-store" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: privateResponseHeaders });
    if (user.status !== "ACTIVE" || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: privateResponseHeaders });
    }
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return Response.json({ ok: false, error: "INVALID_ID" }, { status: 400, headers: privateResponseHeaders });
    }
    return await getDb().transaction(async (tx) => {
    const [row] = await tx.select({
      status: settlements.status,
      partnerId: settlements.partnerId, requestedAt: settlements.requestedAt,
      requestedAmount: settlements.requestedAmount,
      paymentAmount: settlements.paymentAmount,
      deductionAmount: settlements.deductionAmount,
      approvedAt: settlements.approvedAt,
      paidAt: settlements.paidAt,
    }).from(settlements).where(eq(settlements.id, id)).limit(1);
    if (!row) return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: privateResponseHeaders });
    const audit = await tx.select({ action: auditLogs.action, createdAt: auditLogs.createdAt }).from(auditLogs)
      .where(and(eq(auditLogs.targetType, "SETTLEMENT"), eq(auditLogs.targetId, id),
        inArray(auditLogs.action, ["SETTLEMENT_APPROVE", "SETTLEMENT_PAID", "SETTLEMENT_REJECT"])))
      .orderBy(asc(auditLogs.createdAt), asc(auditLogs.id));
    const auditVerified = settlementAuditMatches(row.status as "REQUESTED"|"APPROVED"|"PAID"|"REJECTED", audit.map(entry => entry.action));
    const items = await tx.select({ amount: settlementItems.amount, earningId: settlementItems.earningId }).from(settlementItems)
      .where(eq(settlementItems.settlementId, id));
    let amountVerified = hasUniqueSettlementEarnings(items.map(item => item.earningId)) && settlementAmountsMatch(items.map(item => item.amount), row.requestedAmount, row.paymentAmount, row.deductionAmount);
    const linkedEarnings = items.length ? await tx.select({ id: earnings.id, status: earnings.status, amount: earnings.amount, partnerId: earnings.partnerId }).from(earnings).where(inArray(earnings.id, items.map(item => item.earningId))) : [];
    const expectedEarningStatus = row.status === "PAID" ? "PAID" : row.status === "REJECTED" ? "AVAILABLE" : row.status === "REQUESTED" || row.status === "APPROVED" ? "HOLD" : null;
    const allocations = row.status === "REJECTED" && items.length ? await tx.select({ earningId: settlementItems.earningId, amount: settlementItems.amount, status: settlements.status, partnerId: settlements.partnerId, requestedAt: settlements.requestedAt }).from(settlementItems).innerJoin(settlements, eq(settlements.id, settlementItems.settlementId)).where(and(inArray(settlementItems.earningId, items.map(item => item.earningId)), inArray(settlements.status, ["REQUESTED", "APPROVED", "PAID"]))) : [];
    const rejectedAt = audit.find(entry => entry.action === "SETTLEMENT_REJECT")?.createdAt;
    const earningsVerified = expectedEarningStatus !== null && linkedEarnings.length === items.length && items.every(item => {
      const earning = linkedEarnings.find(e => e.id === item.earningId);
      if (!earning || earning.amount !== item.amount || earning.partnerId !== row.partnerId) return false;
      if (row.status !== "REJECTED") return earning.status === expectedEarningStatus;
      if (!auditVerified || !rejectedAt) return false;
      const matches = allocations.filter(a => a.earningId === item.earningId);
      if (earning.status === "AVAILABLE") return matches.length === 0;
      if (matches.length !== 1) return false;
      const a = matches[0];
      return a.amount === item.amount && a.partnerId === row.partnerId &&
        a.requestedAt >= rejectedAt && a.requestedAt > row.requestedAt &&
        ((earning.status === "HOLD" && (a.status === "REQUESTED" || a.status === "APPROVED")) ||
         (earning.status === "PAID" && a.status === "PAID"));
    });
    amountVerified = amountVerified && earningsVerified;
    return Response.json({ ok: true, status: row.status, approvedAt: row.approvedAt, paidAt: row.paidAt, auditVerified, amountVerified }, { headers: privateResponseHeaders });
    }, { isolationLevel: "repeatable read" });
  } catch (error) {
    console.error("Settlement status lookup failed", error);
    return Response.json({ ok: false, error: "STATUS_LOOKUP_FAILED" }, { status: 500, headers: privateResponseHeaders });
  }
}
