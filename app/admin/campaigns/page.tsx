import DashboardShell from "@/components/DashboardShell";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { advertisers, campaigns } from "@/db/schema";

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

async function loadCampaigns() {
  try {
    const db = getDb();
    return await db
      .select({
        id: campaigns.id,
        code: campaigns.campaignCode,
        type: campaigns.type,
        name: campaigns.name,
        status: campaigns.status,
        company: advertisers.companyName,
        createdAt: campaigns.createdAt,
      })
      .from(campaigns)
      .leftJoin(advertisers, eq(campaigns.advertiserId, advertisers.id))
      .orderBy(desc(campaigns.createdAt));
  } catch {
    return [];
  }
}

export default async function CampaignsPage() {
  const rows = await loadCampaigns();

  return (
    <DashboardShell title="캠페인 관리" description="CPA와 포스팅 광고를 한 곳에서 관리합니다." nav={nav}>
      <div className="page-toolbar">
        <div className="muted">전체 캠페인 {rows.length}건</div>
        <a className="btn primary" href="/admin/campaigns/new">+ 새 캠페인</a>
      </div>
      <section className="panel card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>유형</th><th>캠페인</th><th>광고주</th><th>코드</th><th>상태</th><th>등록일</th></tr></thead>
            <tbody>
              {rows.length ? rows.map((row) => (
                <tr key={row.id}>
                  <td><span className="badge">{row.type}</span></td>
                  <td><strong>{row.name}</strong></td>
                  <td>{row.company || "-"}</td>
                  <td>{row.code}</td>
                  <td>{row.status}</td>
                  <td>{row.createdAt.toLocaleDateString("ko-KR")}</td>
                </tr>
              )) : <tr><td colSpan={6} className="empty-cell">등록된 캠페인이 없습니다. 새 캠페인을 만들어 주세요.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
