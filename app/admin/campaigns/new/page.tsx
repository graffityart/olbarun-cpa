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
];

export default function NewCampaignPage() {
  return (
    <DashboardShell title="새 캠페인 만들기" description="광고 목적에 맞는 상품 유형을 선택하세요." nav={nav}>
      <section className="grid-2">
        <a className="panel card campaign-choice" href="/admin/campaigns/new/cpa">
          <span className="badge">CPA</span>
          <h2>CPA 광고</h2>
          <p>상담신청, 견적신청, 예약신청 등 고객 DB가 발생했을 때 과금하는 캠페인입니다.</p>
          <strong>CPA 캠페인 만들기 →</strong>
        </a>
        <a className="panel card campaign-choice" href="/admin/campaigns/new/posting">
          <span className="badge">POSTING</span>
          <h2>포스팅 광고</h2>
          <p>블로그, 카페, SNS 콘텐츠 작성 후 URL을 제출하고 검수 승인 시 수익이 발생합니다.</p>
          <strong>포스팅 캠페인 만들기 →</strong>
        </a>
      </section>
    </DashboardShell>
  );
}
