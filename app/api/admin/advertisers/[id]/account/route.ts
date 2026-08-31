import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { advertiserUsers, advertisers, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email.includes("@") || password.length < 8) return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });

    const db = getDb();
    const [advertiser] = await db.select({ id: advertisers.id }).from(advertisers).where(eq(advertisers.id, id)).limit(1);
    if (!advertiser) return Response.json({ ok: false, error: "ADVERTISER_NOT_FOUND" }, { status: 404 });
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length) return Response.json({ ok: false, error: "EMAIL_ALREADY_EXISTS" }, { status: 409 });

    const result = await db.transaction(async tx => {
      const [user] = await tx.insert(users).values({ email, passwordHash: hashPassword(password), role: "ADVERTISER", status: "ACTIVE" }).returning();
      const [membership] = await tx.insert(advertiserUsers).values({ advertiserId: id, userId: user.id, role: "OWNER" }).returning();
      return { user, membership };
    });
    return Response.json({ ok: true, userId: result.user.id }, { status: 201 });
  } catch (error) {
    console.error("Advertiser account create failed", error);
    return Response.json({ ok: false, error: "CREATE_FAILED" }, { status: 500 });
  }
}
