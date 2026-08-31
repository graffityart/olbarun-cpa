import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { advertiserUsers, advertisers } from "@/db/schema";
import { getCurrentUser } from "./session";

export async function requireAdvertiser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/advertiser");
  if (user.status !== "ACTIVE") redirect("/login?error=account_not_active");
  if (user.role !== "ADVERTISER") redirect("/");

  try {
    const [row] = await getDb().select({
      advertiserId: advertiserUsers.advertiserId,
      advertiserCode: advertisers.advertiserCode,
      companyName: advertisers.companyName,
    }).from(advertiserUsers)
      .innerJoin(advertisers, eq(advertisers.id, advertiserUsers.advertiserId))
      .where(eq(advertiserUsers.userId, user.id))
      .limit(1);
    if (!row) redirect("/login?error=advertiser_not_linked");
    return { ...user, ...row };
  } catch {
    redirect("/login?error=advertiser_setup_required");
  }
}
