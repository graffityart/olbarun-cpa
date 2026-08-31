import DashboardShell from "@/components/DashboardShell";

const nav = [
  { href: "/advertiser", label: "대시보드" },
  { href: "/advertiser/campaigns", label: "캠페인" },
  { href: "/advertiser/conversions", label: "전환 DB" },
  { href: "/advertiser/posting", label: "포스팅 작업" },
  { href: "/advertiser/ledger", label: "광고비" },
  { href: "/advertiser/reports", label: "통계" },
  { href: "/advertiser/profile", label: "회사정보" },
];

export default function AdvertiserPage() {
  return (
    <DashboardShell title="광고주센터" description="캠페인 성과와 광고비 사용 현황을 확인합니다." nav={nav}>
      <section className="stats">
        <div className="panel stat"><span>오늘 DB</span><strong>0</strong></div>
        <div className="panel stat"><span>오늘 승인</span><strong>0</strong></div>
        <div className="panel stat"><span>승인율</span><strong>0%</strong></div>
        <div className="panel stat"><span>현재 예치금</span><strong>0원</strong></div>
      </section>
      <section className="grid-3" style={{ marginBottom: 20 }}>
        <div className="panel card"><h3>이번달 CPA 광고비</h3><p>0원</p></div>
        <div className="panel card"><h3>이번달 포스팅 광고비</h3><p>0원</p></div>
        <div className="panel card"><h3>검수대기</h3><p>0건</p></div>
      </section>
      <section className="panel card">
        <h3>캠페인 성과</h3>
        <p className="muted">캠페인이 시작되면 DB, 승인율, 광고비, 파트너별 성과를 이곳에서 확인합니다.</p>
      </section>
    </DashboardShell>
  );
}
