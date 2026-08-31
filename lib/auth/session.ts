import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { advertiserUsers, advertisers, authSessions, partners, users } from "@/db/schema";

const COOKIE_NAME = "olbarun_session";
const SESSION_DAYS = 14;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, meta?: { userAgent?: string | null; ipHash?: string | null }) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getDb().insert(authSessions).values({ userId, tokenHash: hashToken(token), expiresAt, userAgent: meta?.userAgent ?? null, ipHash: meta?.ipHash ?? null });
  const store = await cookies();
  store.set(COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) await getDb().delete(authSessions).where(eq(authSessions.tokenHash, hashToken(token)));
  store.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const now = new Date();
  const rows = await getDb().select({
    id: users.id,
    email: users.email,
    role: users.role,
    status: users.status,
    partnerId: partners.id,
    partnerCode: partners.partnerCode,
    partnerName: partners.name,
    advertiserId: advertiserUsers.advertiserId,
    advertiserCode: advertisers.advertiserCode,
    advertiserName: advertisers.companyName,
  })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .leftJoin(partners, eq(partners.userId, users.id))
    .leftJoin(advertiserUsers, eq(advertiserUsers.userId, users.id))
    .leftJoin(advertisers, eq(advertisers.id, advertiserUsers.advertiserId))
    .where(and(eq(authSessions.tokenHash, hashToken(token)), gt(authSessions.expiresAt, now)))
    .limit(1);
  return rows[0] ?? null;
}
