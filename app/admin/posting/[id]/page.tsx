import DashboardShell from "@/components/DashboardShell";
import PostingReviewForm from "@/components/PostingReviewForm";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { campaigns, partners, postingApplications, postingCampaigns, postingSubmissions } from "@/db/schema";

export const dynamic = "force-dynamic";

const nav = [{ href: "/admin/posting", label: "← 포스팅 작업관리" }];

export default async function PostingReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let row: any = null;

  try {
    const [result] = await getDb()
      .select({
        id: postingSubmissions.id,
        title: postingSubmissions.title,
        postUrl: postingSubmissions.postUrl,
        note: postingSubmissions.note,
        status: postingSubmissions.status,
        revisionCount: postingSubmissions.revisionCount,
        submittedAt: postingSubmissions.submittedAt,
        campaignName: campaigns.name,
        campaignSettings: campaigns.settings,
        partnerName: partners.name,
        partnerCode: partners.partnerCode,
        minimumCharacters: postingCampaigns.minimumCharacters,
        minimumImages: postingCampaigns.minimumImages,
        maintenanceDays: postingCampaigns.maintenanceDays,
        rules: postingCampaigns.rules,
      })
      .from(postingSubmissions)
      .innerJoin(postingApplications, eq(postingSubmissions.applicationId, postingApplications.id))
      .innerJoin(postingCampaigns, eq(postingApplications.postingCampaignId, postingCampaigns.id))
      .innerJoin(campaigns, eq(postingCampaigns.campaignId, campaigns.id))
      .innerJoin(partners, eq(postingApplications.partnerId, partners.id))
      .where(eq(postingSubmissions.id, id));
    row = result;
  } catch {}

  if (!row) notFound();
  const rules = (row.rules ?? {}) as Record<string, unknown>;

  return <DashboardShell title="포스팅 검수" description={`${row.campaignName} · ${row.partnerName} (${row.partnerCode})`} nav={nav}>
    <section className="grid-2" style={{ marginBottom: 20 }}>
      <div className="panel card">
        <h3>캠페인 조건</h3>
        <table><tbody>
          <tr><th>최소 글자수</th><td>{row.minimumCharacters ?? "-"}</td></tr>
          <tr><th>최소 이미지</th><td>{row.minimumImages ?? "-"}</td></tr>
          <tr><th>게시 유지</th><td>{row.maintenanceDays ? `${row.maintenanceDays}일` : "-"}</td></tr>
          <tr><th>필수 키워드</th><td>{String(rules.keywords ?? "-")}</td></tr>
          <tr><th>필수 링크</th><td>{String(rules.requiredLink ?? "-")}</td></tr>
          <tr><th>금지 표현</th><td>{String(rules.prohibitedExpressions ?? "-")}</td></tr>
        </tbody></table>
      </div>
      <div className="panel card">
        <h3>파트너 제출</h3>
        <table><tbody>
          <tr><th>제목</th><td>{row.title || "-"}</td></tr>
          <tr><th>상태</th><td><span className="badge">{row.status}</span></td></tr>
          <tr><th>수정횟수</th><td>{row.revisionCount}</td></tr>
          <tr><th>제출일</th><td>{row.submittedAt.toLocaleString("ko-KR")}</td></tr>
        </tbody></table>
        <div className="form-actions"><a className="btn primary" href={row.postUrl} target="_blank" rel="noreferrer">게시물 열기</a></div>
        {row.note && <p className="muted">파트너 메모: {row.note}</p>}
      </div>
    </section>
    <PostingReviewForm submissionId={row.id} />
  </DashboardShell>;
}
