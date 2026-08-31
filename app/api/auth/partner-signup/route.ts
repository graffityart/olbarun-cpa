import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { partners, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";

function makePartnerCode() {
  return `P-${Date.now().toString(36).toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const memberType = String(body.memberType ?? "INDIVIDUAL");

    if (!email || !email.includes("@") || password.length < 8 || !name) {
      return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }

    const db = getDb();
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length) return Response.json({ ok: false, error: "EMAIL_ALREADY_EXISTS" }, { status: 409 });

    const result = await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ email, passwordHash: hashPassword(password), role: "PARTNER", status: "PENDING" }).returning();
      const [partner] = await tx.insert(partners).values({ userId: user.id, partnerCode: makePartnerCode(), name, phone: phone || null, memberType, grade: "NEW" }).returning();
      return { user, partner };
    });

    return Response.json({ ok: true, partnerCode: result.partner.partnerCode, status: "PENDING" }, { status: 201 });
  } catch (error) {
    console.error("Partner signup failed", error);
    return Response.json({ ok: false, error: "SIGNUP_FAILED" }, { status: 500 });
  }
}
