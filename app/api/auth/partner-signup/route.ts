import {randomBytes} from "node:crypto";
import {requireSameOrigin} from "@/lib/security/origin";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { partners, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";

function makePartnerCode() {
  return `P-${randomBytes(8).toString("hex").toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const memberType = String(body.memberType ?? "INDIVIDUAL");

    if (!email || email.length>320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length>128 || !name || name.length>100 || phone.length>40 || !["INDIVIDUAL","SOLE_PROPRIETOR","CORPORATION"].includes(memberType)) {
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
    const e=error as {code?:string;cause?:{code?:string}};if(e.code==="23505"||e.cause?.code==="23505")return Response.json({ok:false,error:"EMAIL_ALREADY_EXISTS"},{status:409});
    if(error instanceof SyntaxError)return Response.json({ok:false,error:"INVALID_INPUT"},{status:400});
    if(error instanceof Error&&["INVALID_ORIGIN","ORIGIN_CHECK_FAILED"].includes(error.message))return Response.json({ok:false,error:error.message},{status:403});
    console.error("Partner signup failed", error);
    return Response.json({ ok: false, error: "SIGNUP_FAILED" }, { status: 500 });
  }
}
