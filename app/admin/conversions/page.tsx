import DashboardShell from "@/components/DashboardShell";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, conversionData, conversions, partners } from "@/db/schema";

export const dynamic = "force-dynamic";
const nav = [{ href: "/admin", label: "대시보드" }, { href: "/admin/campaigns", label: "캠페인 관리" }, { href: "/admin/conversions", label: "전환 DB" }, { href: "/admin/posting", label: "포스팅 작업" }, { href: "/admin/ledger", label: "광고비·수익" }];

export default async function AdminConversionsPage() {
  const rows = await getDb().select({ id: conversions.id, code: conversions.conversionCode, status: conversions.status, campaign: campaigns.name, partnerCode: partners.partnerCode, customerName: conversionData.customerName, region: conversionData.region, advertiserRate: conversions.advertiserRateSnapshot, partnerRate: conversions.partnerRateSnapshot, submittedAt: conversions.submittedAt })
    .from(conversions).innerJoin(campaigns, eq(conversions.campaignId, campaigns.id)).leftJoin(partners, eq(conversions.partnerId, partners.id)).leftJoin(conversionData, eq(conversionData.conversionId, conversions.id)).orderBy(desc(conversions.submittedAt));
  return <DashboardShell title="전환 DB" description="CPA 신청 DB를 검수하고 승인·거절합니다." nav={nav}><section className="panel card"><div className="table-wrap"><table><thead><tr><th>접수번호</th><th>캠페인</th><th>고객</th><th>파트너</th><th>상태</th><th>광고주비용</th><th>파트너수익</th><th>관리</th></tr></thead><tbody>{rows.length ? rows.map(r => <tr key={r.id}><td>{r.code}</td><td>{r.campaign}</td><td>{r.customerName ?? "-"}<br/><span className="muted">{r.region ?? ""}</span></td><td>{r.partnerCode ?? "직접유입"}</td><td><span className="badge">{r.status}</span></td><td>{r.advertiserRate.toLocaleString("ko-KR")}원</td><td>{r.partnerRate.toLocaleString("ko-KR")}원</td><td><a href={`/admin/conversions/${r.id}`}>검수</a></td></tr>) : <tr><td colSpan={8} className="empty-cell">접수된 DB가 없습니다.</td></tr>}</tbody></table></div></section></DashboardShell>;
}
