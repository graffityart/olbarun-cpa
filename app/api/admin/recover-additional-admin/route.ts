import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { authSessions, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireSameOrigin } from "@/lib/security/origin";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const current = await getCurrentUser();
    if (!current || current.status !== "ACTIVE" || !["ADMIN", "SUPER_ADMIN"].includes(current.role))
      return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    const body = await request.json();
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    if (newPassword.length < 12 || newPassword.length > 128)
      return Response.json({ ok: false, error: "PASSWORD_LENGTH" }, { status: 400 });
    const db = getDb();
    const [actor] = await db.select().from(users).where(eq(users.id, current.id)).limit(1);
    if (!actor || !verifyPassword(currentPassword, actor.passwordHash))
      return Response.json({ ok: false, error: "CURRENT_PASSWORD_INVALID" }, { status: 403 });
    const [target] = await db.select().from(users).where(eq(users.email, "admin@naver.com")).limit(1);
    if (!target || target.role !== "ADMIN" || target.id === actor.id)
      return Response.json({ ok: false, error: "TARGET_NOT_FOUND" }, { status: 404 });
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() }).where(eq(users.id, target.id));
      await tx.delete(authSessions).where(eq(authSessions.userId, target.id));
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "RESET_FAILED" }, { status: 500 });
  }
}
