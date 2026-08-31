import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { partners, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  try {
    const { id } = await context.params;
    const db = getDb();
    const [partner] = await db.select({ id: partners.id, userId: partners.userId }).from(partners).where(eq(partners.id, id)).limit(1);
    if (!partner) return Response.json({ ok: false, error: "PARTNER_NOT_FOUND" }, { status: 404 });
    await db.transaction(async (tx) => {
      await tx.update(users).set({ status: "ACTIVE", updatedAt: new Date() }).where(eq(users.id, partner.userId));
      await tx.update(partners).set({ approvedAt: new Date(), updatedAt: new Date() }).where(eq(partners.id, partner.id));
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Partner approval failed", error);
    return Response.json({ ok: false, error: "APPROVAL_FAILED" }, { status: 500 });
  }
}
