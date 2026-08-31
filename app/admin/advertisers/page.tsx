import DashboardShell from "@/components/DashboardShell";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { advertisers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";
const nav = [{ href: "/admin", label: "대시보드" }, { href: "/admin/partners", label: "파트너 관리" }, { href: "/admin/advertisers", label: "광고주 관리" }, { href: "/admin/campaigns", label: "캠페인 관리" }, { href: "/admin/conversions", label: "전환 DB" }, { href: "/admin/posting", label: "포스팅 작업" }, { href: "/admin/ledger", label: "광고비·수익" }, { href: "/admin/settlements", label: "정산" }];

export default async function AdvertisersPage() {
  await requireAdmin();
  let rows: typeof advertisers.$inferSelect[] = []; try { rows = await getDb().select().from(advertisers).orderBy(desc(advertisers.createdAt)); } catch {}
  return <DashboardShell title="광고주 관리" description="광고주 기본정보, 로그인 계정, 예치금을 관리합니다." nav={nav}>
    <div className="page-toolbar"><div className="muted">등록 광고주 {rows.length}곳</div><a className="btn primary" href="/admin/advertisers/new">+ 광고주 등록</a></div>
    <section className="panel card"><div className="table-wrap"><table><thead><tr><th>광고주 코드</th><th>업체명</th><th>대표자</th><th>계약상태</th><th>결제방식</th><th>등록일</th><th>관리</th></tr></thead><tbody>
      {rows.length ? rows.map(row=><tr key={row.id}><td>{row.advertiserCode}</td><td><strong>{row.companyName}</strong></td><td>{row.representativeName||"-"}</td><td><span className="badge">{row.contractStatus}</span></td><td>{row.paymentType}</td><td>{row.createdAt.toLocaleDateString("ko-KR")}</td><td><a href={`/admin/advertisers/${row.id}`}>상세관리</a></td></tr>) : <tr><td colSpan={7} className="empty-cell">아직 등록된 광고주가 없습니다.</td></tr>}
    </tbody></table></div></section>
  </DashboardShell>;
}
