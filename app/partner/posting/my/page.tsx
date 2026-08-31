import DashboardShell from "@/components/DashboardShell";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/auth/guards";
import { campaigns, postingApplications, postingCampaigns, postingSubmissions } from "@/db/schema";

export const dynamic = "force-dynamic";
const nav = [{ href: "/partner/posting", label: "← 포스팅 광고" }, { href: "/partner/posting/my", label: "내 포스팅" }];

async function loadRows(partnerId: string) {
  return await getDb().select({ applicationId: postingApplications.id, applicationStatus: postingApplications.status, campaignName: campaigns.name, mediaType: postingCampaigns.mediaType, submissionId: postingSubmissions.id, submissionStatus: postingSubmissions.status, postUrl: postingSubmissions.postUrl, submittedAt: postingSubmissions.submittedAt })
    .from(postingApplications).innerJoin(postingCampaigns, eq(postingApplications.postingCampaignId, postingCampaigns.id)).innerJoin(campaigns, eq(postingCampaigns.campaignId, campaigns.id)).leftJoin(postingSubmissions, eq(postingSubmissions.applicationId, postingApplications.id)).where(eq(postingApplications.partnerId, partnerId)).orderBy(desc(postingApplications.appliedAt));
}

export default async function MyPostingPage() {
  const user = await requirePartner(); const rows = await loadRows(user.partnerId!);
  return <DashboardShell title="내 포스팅" description={`${user.partnerName ?? user.email}님의 참여 작업과 제출·수정 상태입니다.`} nav={nav}>
    <section className="panel card"><div className="table-wrap"><table><thead><tr><th>캠페인</th><th>매체</th><th>상태</th><th>게시 URL</th><th>관리</th></tr></thead><tbody>
      {rows.length ? rows.map(row => <tr key={`${row.applicationId}-${row.submissionId ?? "new"}`}><td><strong>{row.campaignName}</strong></td><td>{row.mediaType}</td><td><span className="badge">{row.submissionStatus ?? row.applicationStatus}</span></td><td>{row.postUrl ? <a href={row.postUrl} target="_blank" rel="noreferrer">게시물 보기</a> : "-"}</td><td><a href={`/partner/posting/submit/${row.applicationId}`}>{row.submissionId ? "수정/재제출" : "작업결과 등록"}</a></td></tr>) : <tr><td colSpan={5} className="empty-cell">참여 중인 포스팅 작업이 없습니다.</td></tr>}
    </tbody></table></div></section>
  </DashboardShell>;
}
