import DashboardShell from "@/components/DashboardShell";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaignRates, campaigns, postingCampaigns } from "@/db/schema";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/partner", label: "대시보드" },
  { href: "/partner/campaigns", label: "CPA 캠페인" },
  { href: "/partner/posting", label: "포스팅 광고" },
  { href: "/partner/posting/my", label: "내 포스팅" },
  { href: "/partner/earnings", label: "수익" },
  { href: "/partner/settlements", label: "정산" },
];

async function loadCampaigns() {
  try {
    return await getDb()
      .select({
        id: campaigns.id,
        name: campaigns.name,
        category: campaigns.category,
        description: campaigns.description,
        status: campaigns.status,
        endAt: campaigns.endAt,
        mediaType: postingCampaigns.mediaType,
        participantLimit: postingCampaigns.participantLimit,
        totalSubmissionLimit: postingCampaigns.totalSubmissionLimit,
        perPartnerLimit: postingCampaigns.perPartnerLimit,
        partnerRate: campaignRates.partnerBaseRate,
      })
      .from(campaigns)
      .innerJoin(postingCampaigns, eq(postingCampaigns.campaignId, campaigns.id))
      .leftJoin(campaignRates, eq(campaignRates.campaignId, campaigns.id))
      .where(eq(campaigns.type, "POSTING"))
      .orderBy(desc(campaigns.createdAt));
  } catch {
    return [];
  }
}

export default async function PartnerPostingPage() {
  const rows = await loadCampaigns();
  return (
    <DashboardShell title="포스팅 광고" description="참여 가능한 블로그·카페·SNS 작업을 확인합니다." nav={nav}>
      <div className="page-toolbar"><div className="muted">전체 {rows.length}개</div><div className="badge">모집 캠페인</div></div>
      <section className="campaign-market-grid">
        {rows.length ? rows.map((row) => (
          <a key={row.id} className="panel card campaign-market-card" href={`/partner/posting/${row.id}`}>
            <div className="campaign-card-head"><span className="badge">{row.mediaType}</span><span className="muted">{row.status}</span></div>
            <h2>{row.name}</h2>
            <p>{row.description || "캠페인 상세 가이드를 확인하고 참여할 수 있습니다."}</p>
            <div className="campaign-card-metrics">
              <div><span>건당수익</span><strong>{(row.partnerRate ?? 0).toLocaleString("ko-KR")}원</strong></div>
              <div><span>총 작업</span><strong>{row.totalSubmissionLimit ?? "제한없음"}</strong></div>
              <div><span>1인 한도</span><strong>{row.perPartnerLimit}건</strong></div>
            </div>
            <div className="campaign-card-foot">상세보기 →</div>
          </a>
        )) : <div className="panel card empty-cell">현재 표시할 포스팅 캠페인이 없습니다.</div>}
      </section>
    </DashboardShell>
  );
}
