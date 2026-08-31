import DashboardShell from "@/components/DashboardShell";
import { requirePartner } from "@/lib/auth/guards";

const nav = [
  { href: "/partner", label: "대시보드" }, { href: "/partner/campaigns", label: "CPA 캠페인" }, { href: "/partner/posting", label: "포스팅 광고" },
  { href: "/partner/links", label: "광고링크" }, { href: "/partner/conversions", label: "전환 실적" }, { href: "/partner/earnings", label: "수익" },
  { href: "/partner/settlements", label: "정산" }, { href: "/partner/profile", label: "내 정보" },
];

export default async function PartnerPage() {
  const user = await requirePartner();
  return <DashboardShell title="파트너센터" description={`${user.partnerName ?? user.email}님 · ${user.partnerCode ?? ""}`} nav={nav}>
    <section className="stats"><div className="panel stat"><span>오늘 클릭</span><strong>0</strong></div><div className="panel stat"><span>오늘 DB</span><strong>0</strong></div><div className="panel stat"><span>오늘 승인</span><strong>0</strong></div><div className="panel stat"><span>오늘 수익</span><strong>0원</strong></div></section>
    <section className="grid-3" style={{ marginBottom: 20 }}><div className="panel card"><h3>검수중 수익</h3><p>0원</p></div><div className="panel card"><h3>확정수익</h3><p>0원</p></div><div className="panel card"><h3>출금가능</h3><p>0원</p></div></section>
    <section className="panel card"><h3>내 캠페인 TOP</h3><p className="muted">캠페인 운영 데이터가 쌓이면 클릭, DB, 승인율, 확정수익 기준으로 표시됩니다.</p></section>
  </DashboardShell>;
}
