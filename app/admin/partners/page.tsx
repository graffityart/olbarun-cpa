import DashboardShell from "@/components/DashboardShell";
import PartnerApprovalButton from "@/components/PartnerApprovalButton";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { partners, users } from "@/db/schema";

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

async function loadPartners() {
  try {
    return await getDb().select({ id: partners.id, partnerCode: partners.partnerCode, name: partners.name, phone: partners.phone, memberType: partners.memberType, grade: partners.grade, approvedAt: partners.approvedAt, createdAt: partners.createdAt, email: users.email, status: users.status })
      .from(partners).innerJoin(users, eq(partners.userId, users.id)).orderBy(desc(partners.createdAt));
  } catch { return []; }
}

export default async function PartnersPage() {
  const rows = await loadPartners();
  const pending = rows.filter((row) => row.status === "PENDING").length;
  return <DashboardShell title="파트너 관리" description="가입 신청, 승인 상태, 등급을 관리합니다." nav={nav}>
    <section className="stats">
      <div className="panel stat"><span>전체 파트너</span><strong>{rows.length}</strong></div>
      <div className="panel stat"><span>승인대기</span><strong>{pending}</strong></div>
      <div className="panel stat"><span>활동중</span><strong>{rows.filter(r => r.status === "ACTIVE").length}</strong></div>
      <div className="panel stat"><span>중지/탈퇴</span><strong>{rows.filter(r => r.status === "SUSPENDED" || r.status === "WITHDRAWN").length}</strong></div>
    </section>
    <section className="panel card"><div className="table-wrap"><table>
      <thead><tr><th>파트너</th><th>이메일</th><th>회원유형</th><th>등급</th><th>상태</th><th>가입일</th><th>처리</th></tr></thead>
      <tbody>{rows.length ? rows.map(row => <tr key={row.id}>
        <td><strong>{row.name}</strong><br/><span className="muted">{row.partnerCode}</span></td><td>{row.email}</td><td>{row.memberType}</td><td>{row.grade}</td><td><span className="badge">{row.status}</span></td><td>{row.createdAt.toLocaleDateString("ko-KR")}</td><td>{row.status === "PENDING" ? <PartnerApprovalButton partnerId={row.id} /> : row.approvedAt ? `승인 ${row.approvedAt.toLocaleDateString("ko-KR")}` : "-"}</td>
      </tr>) : <tr><td colSpan={7} className="empty-cell">등록된 파트너가 없습니다.</td></tr>}</tbody>
    </table></div></section>
  </DashboardShell>;
}
