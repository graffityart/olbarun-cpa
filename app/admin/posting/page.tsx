import DashboardShell from "@/components/DashboardShell";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, partners, postingApplications, postingCampaigns, postingSubmissions } from "@/db/schema";

export const dynamic = "force-dynamic";

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

async function loadRows() {
  try {
    return await getDb()
      .select({
        id: postingSubmissions.id,
        title: postingSubmissions.title,
        postUrl: postingSubmissions.postUrl,
        status: postingSubmissions.status,
        submittedAt: postingSubmissions.submittedAt,
        campaignName: campaigns.name,
        partnerName: partners.name,
        partnerCode: partners.partnerCode,
      })
      .from(postingSubmissions)
      .innerJoin(postingApplications, eq(postingSubmissions.applicationId, postingApplications.id))
      .innerJoin(postingCampaigns, eq(postingApplications.postingCampaignId, postingCampaigns.id))
      .innerJoin(campaigns, eq(postingCampaigns.campaignId, campaigns.id))
      .innerJoin(partners, eq(postingApplications.partnerId, partners.id))
      .orderBy(desc(postingSubmissions.submittedAt));
  } catch {
    return [];
  }
}

export default async function PostingAdminPage() {
  const rows = await loadRows();
  const counts = rows.reduce<Record<string, number>>((acc, row) => { acc[row.status] = (acc[row.status] ?? 0) + 1; return acc; }, {});

  return (
    <DashboardShell title="포스팅 작업관리" description="제출된 게시물의 검수·수정요청·승인·거절을 관리합니다." nav={nav}>
      <section className="stats">
        <div className="panel stat"><span>전체 제출</span><strong>{rows.length}</strong></div>
        <div className="panel stat"><span>검수중</span><strong>{counts.SUBMITTED ?? 0}</strong></div>
        <div className="panel stat"><span>수정요청</span><strong>{counts.REVISION_REQUESTED ?? 0}</strong></div>
        <div className="panel stat"><span>승인</span><strong>{counts.APPROVED ?? 0}</strong></div>
      </section>

      <section className="panel card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>캠페인</th><th>파트너</th><th>제목</th><th>제출일</th><th>상태</th><th>관리</th></tr></thead>
            <tbody>
              {rows.length ? rows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.campaignName}</strong></td>
                  <td>{row.partnerName} <span className="muted">({row.partnerCode})</span></td>
                  <td>{row.title || "제목 없음"}</td>
                  <td>{row.submittedAt.toLocaleString("ko-KR")}</td>
                  <td><span className="badge">{row.status}</span></td>
                  <td><a className="btn" href={`/admin/posting/${row.id}`}>검수</a></td>
                </tr>
              )) : <tr><td colSpan={6} className="empty-cell">아직 제출된 포스팅 작업이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
