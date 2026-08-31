import DashboardShell from "@/components/DashboardShell";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, postingApplications, postingCampaigns, postingSubmissions } from "@/db/schema";

export const dynamic = "force-dynamic";
const nav = [{ href: "/partner/posting", label: "← 포스팅 광고" }, { href: "/partner/posting/my", label: "내 포스팅" }];

async function loadRows(partnerId: string) {
  if (!partnerId) return [];
  try {
    return await getDb().select({
      applicationId: postingApplications.id,
      applicationStatus: postingApplications.status,
      campaignName: campaigns.name,
      mediaType: postingCampaigns.mediaType,
      submissionId: postingSubmissions.id,
      submissionStatus: postingSubmissions.status,
      postUrl: postingSubmissions.postUrl,
      submittedAt: postingSubmissions.submittedAt,
    }).from(postingApplications)
      .innerJoin(postingCampaigns, eq(postingApplications.postingCampaignId, postingCampaigns.id))
      .innerJoin(campaigns, eq(postingCampaigns.campaignId, campaigns.id))
      .leftJoin(postingSubmissions, eq(postingSubmissions.applicationId, postingApplications.id))
      .where(eq(postingApplications.partnerId, partnerId))
      .orderBy(desc(postingApplications.appliedAt));
  } catch { return []; }
}

export default async function MyPostingPage({ searchParams }: { searchParams: Promise<{ partnerId?: string }> }) {
  const { partnerId = "" } = await searchParams;
  const rows = await loadRows(partnerId);
  return <DashboardShell title="내 포스팅" description="참여 중인 작업과 제출·수정 상태를 확인합니다." nav={nav}>
    {!partnerId && <section className="panel card notice-box">인증 기능 연결 전에는 URL에 <code>?partnerId=파트너UUID</code>를 넣어 개발 테스트합니다.</section>}
    <section className="panel card">
      <div className="table-wrap"><table><thead><tr><th>캠페인</th><th>매체</th><th>상태</th><th>게시 URL</th><th>관리</th></tr></thead>
      <tbody>{rows.length ? rows.map(row => <tr key={`${row.applicationId}-${row.submissionId ?? "new"}`}>
        <td><strong>{row.campaignName}</strong></td><td>{row.mediaType}</td><td><span className="badge">{row.submissionStatus ?? row.applicationStatus}</span></td>
        <td>{row.postUrl ? <a href={row.postUrl} target="_blank" rel="noreferrer">게시물 보기</a> : "-"}</td>
        <td>{row.submissionId ? <a href={`/partner/posting/submit/${row.applicationId}?partnerId=${partnerId}`}>수정/재제출</a> : <a href={`/partner/posting/submit/${row.applicationId}?partnerId=${partnerId}`}>작업결과 등록</a>}</td>
      </tr>) : <tr><td colSpan={5} className="empty-cell">참여 중인 포스팅 작업이 없습니다.</td></tr>}</tbody></table></div>
    </section>
  </DashboardShell>;
}
