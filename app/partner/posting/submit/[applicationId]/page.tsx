import DashboardShell from "@/components/DashboardShell";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, postingApplications, postingCampaigns, postingSubmissions } from "@/db/schema";

export const dynamic = "force-dynamic";
const nav = [{ href: "/partner/posting/my", label: "← 내 포스팅" }];

async function loadApplication(applicationId: string) {
  try {
    const [row] = await getDb().select({
      applicationId: postingApplications.id,
      partnerId: postingApplications.partnerId,
      campaignName: campaigns.name,
      mediaType: postingCampaigns.mediaType,
      submissionId: postingSubmissions.id,
      title: postingSubmissions.title,
      postUrl: postingSubmissions.postUrl,
      note: postingSubmissions.note,
      status: postingSubmissions.status,
    }).from(postingApplications)
      .innerJoin(postingCampaigns, eq(postingApplications.postingCampaignId, postingCampaigns.id))
      .innerJoin(campaigns, eq(postingCampaigns.campaignId, campaigns.id))
      .leftJoin(postingSubmissions, eq(postingSubmissions.applicationId, postingApplications.id))
      .where(eq(postingApplications.id, applicationId));
    return row ?? null;
  } catch { return null; }
}

export default async function SubmitPostingPage({ params, searchParams }: { params: Promise<{ applicationId: string }>, searchParams: Promise<{ partnerId?: string }> }) {
  const { applicationId } = await params;
  const { partnerId = "" } = await searchParams;
  const row = await loadApplication(applicationId);
  if (!row) return <DashboardShell title="작업결과 등록" description="작업을 찾을 수 없습니다." nav={nav}><section className="panel card">작업정보가 없습니다.</section></DashboardShell>;
  if (partnerId && partnerId !== row.partnerId) return <DashboardShell title="작업결과 등록" description="접근할 수 없습니다." nav={nav}><section className="panel card">파트너 정보가 일치하지 않습니다.</section></DashboardShell>;

  return <DashboardShell title="작업결과 등록" description={`${row.campaignName} · ${row.mediaType}`} nav={nav}>
    <section className="panel card form-card">
      <h2>{row.submissionId ? "작업결과 수정·재제출" : "새 작업결과 제출"}</h2>
      {row.status && <p><span className="badge">현재 상태: {row.status}</span></p>}
      <form action="/api/partner/posting/submit" method="post">
        <input type="hidden" name="applicationId" value={row.applicationId} />
        <input type="hidden" name="partnerId" value={row.partnerId} />
        <div className="form-grid">
          <label className="full">게시물 제목 *<input name="title" required defaultValue={row.title ?? ""} placeholder="게시한 콘텐츠 제목" /></label>
          <label className="full">게시 URL *<input name="postUrl" required defaultValue={row.postUrl ?? ""} placeholder="https://..." /></label>
          <label>게시일<input name="publishedAt" type="date" /></label>
          <label className="full">작업 메모<textarea name="note" rows={5} defaultValue={row.note ?? ""} placeholder="검수자가 참고할 내용을 입력하세요." /></label>
        </div>
        <div className="notice-box" style={{ marginTop: 18 }}>제출 전 캠페인의 필수 키워드, 이미지 수, 링크, 금지 표현, 유지기간을 다시 확인해 주세요.</div>
        <div className="form-actions"><a className="btn" href={`/partner/posting/my?partnerId=${row.partnerId}`}>취소</a><button type="submit">{row.submissionId ? "재제출" : "검수 요청"}</button></div>
      </form>
    </section>
  </DashboardShell>;
}
