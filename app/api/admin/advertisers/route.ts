import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { advertisers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";
function makeAdvertiserCode() { return `ADV-${Date.now().toString(36).toUpperCase()}`; }

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
    const body = await request.json();
    const companyName = String(body.companyName ?? "").trim();
    if (!companyName) return Response.json({ ok: false, error: "COMPANY_NAME_REQUIRED" }, { status: 400 });
    const contractStatus = String(body.contractStatus ?? "LEAD");
    const paymentType = String(body.paymentType ?? "PREPAID");
    if (!["LEAD","REVIEW","ACTIVE","PAUSED","TERMINATED"].includes(contractStatus)) return Response.json({ ok:false,error:"INVALID_CONTRACT_STATUS"},{status:400});
    if (!["PREPAID","POSTPAID","CONTRACT"].includes(paymentType)) return Response.json({ ok:false,error:"INVALID_PAYMENT_TYPE"},{status:400});
    const [row] = await getDb().insert(advertisers).values({ advertiserCode: makeAdvertiserCode(), companyName, businessNumber: String(body.businessNumber ?? "").trim() || null, representativeName: String(body.representativeName ?? "").trim() || null, websiteUrl: String(body.websiteUrl ?? "").trim() || null, contractStatus, paymentType }).returning();
    return Response.json({ ok: true, advertiser: row }, { status: 201 });
  } catch (error) {
    console.error("Failed to create advertiser", error);
    return Response.json({ ok: false, error: "CREATE_FAILED" }, { status: 500 });
  }
}
