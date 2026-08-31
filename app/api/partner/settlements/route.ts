import { randomBytes } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { earnings, settlementItems, settlements } from "@/db/schema";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "PARTNER" || user.status !== "ACTIVE" || !user.partnerId) return Response.json({ ok:false, error:"UNAUTHORIZED" }, { status:401 });
  const body = await request.json(); const amount = Number(body.amount || 0);
  if (amount <= 0 || !body.bankName || !body.accountNumber || !body.accountHolder) return Response.json({ ok:false, error:"INVALID_INPUT" }, { status:400 });
  try {
    const result = await getDb().transaction(async tx => {
      const available = await tx.select().from(earnings).where(and(eq(earnings.partnerId, user.partnerId!), eq(earnings.status, "AVAILABLE"))).orderBy(asc(earnings.createdAt));
      const total = available.reduce((sum,row)=>sum+row.amount,0);
      if (total <= 0) throw new Error("NO_AVAILABLE_EARNINGS");
      if (amount !== total) throw new Error("REQUEST_FULL_AVAILABLE_AMOUNT");
      const settlementCode = `SET-${randomBytes(6).toString("hex").toUpperCase()}`;
      const [settlement] = await tx.insert(settlements).values({ settlementCode, partnerId:user.partnerId!, requestedAmount:amount, deductionAmount:0, paymentAmount:amount, status:"REQUESTED", bankAccountSnapshot:{ bankName:String(body.bankName), accountNumber:String(body.accountNumber), accountHolder:String(body.accountHolder) } }).returning();
      for (const earning of available) {
        await tx.insert(settlementItems).values({ settlementId:settlement.id, earningId:earning.id, conversionId:earning.conversionId, amount:earning.amount });
        await tx.update(earnings).set({ status:"HOLD" }).where(eq(earnings.id, earning.id));
      }
      return settlementCode;
    });
    return Response.json({ ok:true, settlementCode:result }, { status:201 });
  } catch (e) { const error=e instanceof Error?e.message:"CREATE_FAILED"; return Response.json({ ok:false, error }, { status:409 }); }
}
