import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { advertisers } from "@/db/schema";

export const dynamic = "force-dynamic";

function makeAdvertiserCode() {
  const stamp = Date.now().toString(36).toUpperCase();
  return `ADV-${stamp}`;
}

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select().from(advertisers).orderBy(desc(advertisers.createdAt));
    return Response.json({ ok: true, advertisers: rows });
  } catch (error) {
    console.error("Failed to list advertisers", error);
    return Response.json({ ok: false, advertisers: [], error: "DATABASE_NOT_READY" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companyName = String(body.companyName ?? "").trim();
    if (!companyName) {
      return Response.json({ ok: false, error: "COMPANY_NAME_REQUIRED" }, { status: 400 });
    }

    const db = getDb();
    const [row] = await db
      .insert(advertisers)
      .values({
        advertiserCode: makeAdvertiserCode(),
        companyName,
        businessNumber: String(body.businessNumber ?? "").trim() || null,
        representativeName: String(body.representativeName ?? "").trim() || null,
        websiteUrl: String(body.websiteUrl ?? "").trim() || null,
        contractStatus: String(body.contractStatus ?? "LEAD"),
        paymentType: String(body.paymentType ?? "PREPAID"),
      })
      .returning();

    return Response.json({ ok: true, advertiser: row }, { status: 201 });
  } catch (error) {
    console.error("Failed to create advertiser", error);
    return Response.json({ ok: false, error: "CREATE_FAILED" }, { status: 500 });
  }
}
