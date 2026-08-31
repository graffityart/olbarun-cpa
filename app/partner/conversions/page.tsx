import DashboardShell from "@/components/DashboardShell";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/auth/guards";
import { campaigns, conversions } from "@/db/schema";

export const dynamic = "force-dynamic";
const nav = [{ href: "/partner", label: "대시보드" }, { href: "/partner/campaigns", label: "CPA 캠페인" }, { href: "/partner/conversions", label: "전환 실적" }, { href: "/partner/earnings", label: "수익" }];

export default async function PartnerConversionsPage() {
  const user = await requirePartner();
  const rows = await getDb().select({ id: conversions.id, code: conversions.conversionCode, campaign: campaigns.name, status: conversions.status, partnerRate: conversions.partnerRateSnapshot, duplicateStatus: conversions.duplicateStatus, submittedAt: conversions.submittedAt, approvedAt: conversions.approvedAt }).from(conversions).innerJoin(campaigns, eq(conversions.campaignId, campaigns.id)).where(eq(conversions.partnerId, user.partnerId!)).orderBy(desc(conversions.submittedAt));
  const received = rows.length; const approved = rows.filter(r=>r.status==="APPROVED").length; const rejected = rows.filter(r=>r.status==="REJECTED").length; const approvalRate = received ? Math.round((approved/received)*1000)/10 : 0;
  return <DashboardShell title="전환 실적" description="내 광고링크에서 발생한 CPA 접수·승인 실적입니다." nav={nav}>
    <section className="stats"><div className="panel stat"><span>전체 DB</span><strong>{received}</strong></div><div className="panel stat"><span>승인</span><strong>{approved}</strong></div><div className="panel stat"><span>거절</span><strong>{rejected}</strong></div><div className="panel stat"><span>승인율</span><strong>{approvalRate}%</strong></div></section>
    <section className="panel card"><div className="table-wrap"><table><thead><tr><th>접수일</th><th>접수번호</th><th>캠페인</th><th>상태</th><th>중복</th><th>승인수익</th></tr></thead><tbody>{rows.length ? rows.map(r=><tr key={r.id}><td>{new Date(r.submittedAt).toLocaleString("ko-KR")}</td><td>{r.code}</td><td>{r.campaign}</td><td><span className="badge">{r.status}</span></td><td>{r.duplicateStatus}</td><td>{r.partnerRate.toLocaleString("ko-KR")}원</td></tr>) : <tr><td colSpan={6} className="empty-cell">발생한 전환 DB가 없습니다.</td></tr>}</tbody></table></div></section>
  </DashboardShell>;
}
