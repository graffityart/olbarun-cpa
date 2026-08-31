import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { advertiserLedger, advertisers } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE" || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await request.json(); const amount = Number(body.amount ?? 0); const description = String(body.description ?? "").trim();
    if (!Number.isFinite(amount) || amount <= 0) return Response.json({ ok: false, error: "INVALID_AMOUNT" }, { status: 400 });
    const db = getDb(); const [adv] = await db.select({ id: advertisers.id }).from(advertisers).where(eq(advertisers.id, id)).limit(1);
    if (!adv) return Response.json({ ok: false, error: "ADVERTISER_NOT_FOUND" }, { status: 404 });
    const [balanceRow] = await db.select({ balance: sql<number>`coalesce(sum(${advertiserLedger.amount}), 0)` }).from(advertiserLedger).where(eq(advertiserLedger.advertiserId, id));
    const balanceAfter = Number(balanceRow?.balance ?? 0) + amount;
    await db.insert(advertiserLedger).values({ advertiserId: id, type: "DEPOSIT", amount, balanceAfter, description: description || "관리자 예치금 충전" });
    return Response.json({ ok: true, amount, balanceAfter }, { status: 201 });
  } catch (error) { console.error("Advertiser deposit failed", error); return Response.json({ ok: false, error: "DEPOSIT_FAILED" }, { status: 500 }); }
}
