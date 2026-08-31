import DashboardShell from "@/components/DashboardShell";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaignRates, campaigns, postingCampaigns } from "@/db/schema";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/partner/posting", label: "← 포스팅 광고" },
  { href: "/partner/posting/my", label: "내 포스팅" },
];

async function loadCampaign(id: string) {
  try {
    const [row] = await getDb()
      .select({
        id: campaigns.id,
        name: campaigns.name,
        description: campaigns.description,
        category: campaigns.category,
        startAt: campaigns.startAt,
        endAt: campaigns.endAt,
        status: campaigns.status,
        mediaType: postingCampaigns.mediaType,
        participantLimit: postingCampaigns.participantLimit,
        totalSubmissionLimit: postingCampaigns.totalSubmissionLimit,
        perPartnerLimit: postingCampaigns.perPartnerLimit,
        minimumCharacters: postingCampaigns.minimumCharacters,
        minimumImages: postingCampaigns.minimumImages,
        maintenanceDays: postingCampaigns.maintenanceDays,
        reviewDays: postingCampaigns.reviewDays,
        revisionLimit: postingCampaigns.revisionLimit,
        rules: postingCampaigns.rules,
        partnerRate: campaignRates.partnerBaseRate,
      })
      .from(campaigns)
      .innerJoin(postingCampaigns, eq(postingCampaigns.campaignId, campaigns.id))
      .leftJoin(campaignRates, eq(campaignRates.campaignId, campaigns.id))
      .where(eq(campaigns.id, id));
    return row ?? null;
  } catch {
    return null;
  }
}

export default async function PartnerPostingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await loadCampaign(id);
  if (!row) return <DashboardShell title="포스팅 광고" description="캠페인을 찾을 수 없습니다." nav={nav}><section className="panel card">캠페인 정보가 없습니다.</section></DashboardShell>;

  const rules = (row.rules ?? {}) as Record<string, unknown>;
  return (
    <DashboardShell title={row.name} description="작성조건을 확인한 뒤 참여신청을 진행하세요." nav={nav}>
      <section className="grid-3" style={{ marginBottom: 20 }}>
        <div className="panel card"><h3>건당 수익</h3><p><strong>{(row.partnerRate ?? 0).toLocaleString("ko-KR")}원</strong></p></div>
        <div className="panel card"><h3>매체</h3><p>{row.mediaType}</p></div>
        <div className="panel card"><h3>1인 작업한도</h3><p>{row.perPartnerLimit}건</p></div>
      </section>

      <section className="detail-grid">
        <div className="panel card">
          <h2>캠페인 안내</h2>
          <p className="muted">{row.description || "별도 설명 없음"}</p>
          <div className="condition-list">
            <div><span>최소 글자수</span><strong>{row.minimumCharacters ?? "제한없음"}</strong></div>
            <div><span>최소 이미지</span><strong>{row.minimumImages ?? "제한없음"}</strong></div>
            <div><span>게시 유지기간</span><strong>{row.maintenanceDays ? `${row.maintenanceDays}일` : "별도없음"}</strong></div>
            <div><span>검수기간</span><strong>{row.reviewDays}일</strong></div>
            <div><span>수정 가능횟수</span><strong>{row.revisionLimit}회</strong></div>
          </div>
        </div>
        <div className="panel card">
          <h2>작성가이드</h2>
          <dl className="guide-list">
            <dt>필수 키워드</dt><dd>{String(rules.keywords ?? "-")}</dd>
            <dt>제목 규칙</dt><dd>{String(rules.titleRule ?? "-")}</dd>
            <dt>필수 링크</dt><dd>{String(rules.requiredLink ?? "-")}</dd>
            <dt>금지 표현</dt><dd>{String(rules.prohibitedWords ?? "-")}</dd>
            <dt>작성 가이드</dt><dd>{String(rules.guide ?? "-")}</dd>
          </dl>
        </div>
      </section>

      <section className="panel card" style={{ marginTop: 20 }}>
        <h2>참여신청</h2>
        <p className="muted">로그인 연동 전 개발 단계에서는 파트너 ID를 직접 입력합니다. 인증 기능 연결 후 자동으로 현재 계정이 적용됩니다.</p>
        <form action="/api/partner/posting/apply" method="post" className="form-grid">
          <input type="hidden" name="campaignId" value={row.id} />
          <label className="full">파트너 ID<input name="partnerId" required placeholder="파트너 UUID" /></label>
          <div className="full form-actions"><button type="submit">포스팅 참여신청</button></div>
        </form>
      </section>
    </DashboardShell>
  );
}
