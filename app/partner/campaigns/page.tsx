import DashboardShell from "@/components/DashboardShell";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/auth/guards";
import { campaignRates, campaigns } from "@/db/schema";

export const dynamic = "force-dynamic";
const nav = [{ href: "/partner", label: "대시보드" }, { href: "/partner/campaigns", label: "CPA 캠페인" }, { href: "/partner/posting", label: "포스팅 광고" }, { href: "/partner/links", label: "광고링크" }];

export default async function PartnerCampaignsPage() {
  await requirePartner();
  const rows = await getDb().select({ id: campaigns.id, name: campaigns.name, category: campaigns.category, description: campaigns.description, status: campaigns.status, partnerRate: campaignRates.partnerBaseRate, duplicateDays: campaigns.duplicateDays, reviewDays: campaigns.reviewDays })
    .from(campaigns).leftJoin(campaignRates, eq(campaignRates.campaignId, campaigns.id)).where(eq(campaigns.type, "CPA")).orderBy(desc(campaigns.createdAt));
  return <DashboardShell title="CPA 캠페인" description="참여 가능한 CPA 광고를 확인하고 개인 광고링크를 생성합니다." nav={nav}>
    <section className="campaign-market-grid">{rows.length ? rows.map(row => <a key={row.id} className="panel card campaign-market-card" href={`/partner/campaigns/${row.id}`}><div className="campaign-card-head"><span className="badge">{row.category ?? "CPA"}</span><span className="muted">{row.status}</span></div><h2>{row.name}</h2><p>{row.description ?? "상세 조건을 확인하세요."}</p><div className="campaign-card-metrics"><div><span>승인 수익</span><strong>{(row.partnerRate ?? 0).toLocaleString("ko-KR")}원</strong></div><div><span>중복기간</span><strong>{row.duplicateDays}일</strong></div><div><span>검수기간</span><strong>{row.reviewDays}일</strong></div></div><div className="campaign-card-foot">상세보기 →</div></a>) : <div className="panel card empty-cell">현재 표시할 CPA 캠페인이 없습니다.</div>}</section>
  </DashboardShell>;
}
