import { desc } from "drizzle-orm";
import { validBusinessNumber } from "@/lib/cpa/business-number";
import { getDb } from "@/db";
import { advertisers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { requireSameOrigin } from "@/lib/security/origin";

export const dynamic = "force-dynamic";
function makeAdvertiserCode() { return `ADV-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`; }
function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length <= maxLength ? normalized || null : undefined;
}

export async function GET() {
  await requireAdmin();
  try {
    const rows = await getDb().select().from(advertisers).orderBy(desc(advertisers.createdAt));
    return Response.json({ ok: true, advertisers: rows });
  } catch (error) {
    console.error("Failed to list advertisers", error);
    return Response.json({ ok: false, advertisers: [], error: "DATABASE_NOT_READY" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  await requireAdmin();
  try {
    requireSameOrigin(request);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    if (typeof body.companyName !== "string") return Response.json({ ok: false, error: "COMPANY_NAME_REQUIRED" }, { status: 400 });
    const companyName = body.companyName.trim();
    if (!companyName) return Response.json({ ok: false, error: "COMPANY_NAME_REQUIRED" }, { status: 400 });
    if (companyName.length > 200) return Response.json({ ok: false, error: "COMPANY_NAME_TOO_LONG" }, { status: 400 });
    const businessNumber = optionalText(body.businessNumber, 30);
    if (businessNumber && !validBusinessNumber(businessNumber)) return Response.json({ ok: false, error: "INVALID_BUSINESS_NUMBER" }, { status: 400 });
    const representativeName = optionalText(body.representativeName, 100);
    const websiteUrl = optionalText(body.websiteUrl, 2048);
    if (businessNumber === undefined || representativeName === undefined || websiteUrl === undefined) return Response.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    if (websiteUrl) {
      try { const parsed = new URL(websiteUrl); if (!["https:", "http:"].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) throw new Error("INVALID_URL"); }
      catch { return Response.json({ ok: false, error: "INVALID_WEBSITE_URL" }, { status: 400 }); }
    }
    const contractStatus = body.contractStatus ?? "LEAD";
    const paymentType = body.paymentType ?? "PREPAID";
    if (!["LEAD","REVIEW","ACTIVE","PAUSED","TERMINATED"].includes(contractStatus)) return Response.json({ ok:false,error:"INVALID_CONTRACT_STATUS"},{status:400});
    if (!["PREPAID","POSTPAID","CONTRACT"].includes(paymentType)) return Response.json({ ok:false,error:"INVALID_PAYMENT_TYPE"},{status:400});
    const [row] = await getDb().insert(advertisers).values({ advertiserCode: makeAdvertiserCode(), companyName, businessNumber, representativeName, websiteUrl, contractStatus, paymentType }).returning();
    return Response.json({ ok: true, advertiser: row }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && ["INVALID_ORIGIN", "ORIGIN_CHECK_FAILED"].includes(error.message)) return Response.json({ ok: false, error: error.message }, { status: 403 });
    console.error("Failed to create advertiser", error);
    return Response.json({ ok: false, error: "CREATE_FAILED" }, { status: 500 });
  }
}
