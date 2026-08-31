import DashboardShell from "@/components/DashboardShell";

const nav = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/partners", label: "파트너 관리" },
  { href: "/admin/advertisers", label: "광고주 관리" },
  { href: "/admin/campaigns", label: "캠페인 관리" },
  { href: "/admin/conversions", label: "전환 DB" },
  { href: "/admin/posting", label: "포스팅 작업" },
  { href: "/admin/ledger", label: "광고비·수익" },
  { href: "/admin/settlements", label: "정산" },
  { href: "/admin/audit", label: "감사로그" },
];

export default function AdminPage() {
  return (
    <DashboardShell title="올바른광고 ADMIN" description="운영자가 오늘 처리할 업무와 주요 성과를 한눈에 확인합니다." nav={nav}>
      <section className="stats">
        <div className="panel stat"><span>오늘 클릭</span><strong>0</strong></div>
        <div className="panel stat"><span>오늘 DB</span><strong>0</strong></div>
        <div className="panel stat"><span>승인</span><strong>0</strong></div>
        <div className="panel stat"><span>승인율</span><strong>0%</strong></div>
      </section>

      <section className="grid-3" style={{ marginBottom: 20 }}>
        <div className="panel card"><h3>광고주 매출</h3><p>0원</p></div>
        <div className="panel card"><h3>파트너 확정수익</h3><p>0원</p></div>
        <div className="panel card"><h3>매출총차액</h3><p>0원</p></div>
      </section>

      <section className="panel card">
        <h3>처리 필요</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>항목</th><th>건수</th><th>상태</th></tr></thead>
            <tbody>
              <tr><td>검수중 전환</td><td>0</td><td><span className="badge">대기</span></td></tr>
              <tr><td>거절 요청</td><td>0</td><td><span className="badge">대기</span></td></tr>
              <tr><td>포스팅 검수</td><td>0</td><td><span className="badge">대기</span></td></tr>
              <tr><td>정산 신청</td><td>0</td><td><span className="badge">대기</span></td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
