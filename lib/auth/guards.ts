import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";

export async function requirePartner() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/partner");
  if (user.status !== "ACTIVE") redirect("/login?error=account_not_active");
  if (user.role !== "PARTNER" || !user.partnerId) redirect("/");
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.status !== "ACTIVE") redirect("/login?error=account_not_active");
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") redirect("/");
  return user;
}
