import DashboardShell from "@/components/DashboardShell";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/auth/guards";
import { campaigns, trackingLinks } from "@/db/schema";

export const dynamic = "force-dynamic";
const nav = [{ href: "/partner", label: "대시보드" }, { href: "/partner/campaigns", label: "CPA 캠페인" }, { href: "/partner/links", label: "광고링크" }, { href: "/partner/conversions", label: "전환 실적" }];

export default async function PartnerLinksPage() {
  const user = await requirePartner();
  const rows = await getDb().select({ id: trackingLinks.id, code: trackingLinks.trackingCode, subId: trackingLinks.subId, active: trackingLinks.isActive, campaign: campaigns.name, createdAt: trackingLinks.createdAt }).from(trackingLinks).innerJoin(campaigns, eq(trackingLinks.campaignId, campaigns.id)).where(eq(trackingLinks.partnerId, user.partnerId!)).orderBy(desc(trackingLinks.createdAt));
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://olbarun-cpa.vercel.app";
  return <DashboardShell title="광고링크" description="내 CPA 추적링크와 Sub ID를 관리합니다." nav={nav}><section className="panel card"><div className="table-wrap"><table><thead><tr><th>캠페인</th><th>Sub ID</th><th>광고링크</th><th>상태</th><th>생성일</th></tr></thead><tbody>{rows.length ? rows.map(r=><tr key={r.id}><td>{r.campaign}</td><td>{r.subId ?? "-"}</td><td><a href={`${base}/c/${r.code}`} target="_blank" rel="noreferrer">{base}/c/{r.code}</a></td><td><span className="badge">{r.active ? "ACTIVE" : "PAUSED"}</span></td><td>{new Date(r.createdAt).toLocaleString("ko-KR")}</td></tr>) : <tr><td colSpan={5} className="empty-cell">생성한 광고링크가 없습니다.</td></tr>}</tbody></table></div></section></DashboardShell>;
}
