import DashboardShell from "@/components/DashboardShell";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/auth/guards";
import { conversions, earnings } from "@/db/schema";

export const dynamic = "force-dynamic";
const nav = [{ href: "/partner", label: "대시보드" }, { href: "/partner/conversions", label: "전환 실적" }, { href: "/partner/earnings", label: "수익" }, { href: "/partner/settlements", label: "정산" }];

export default async function PartnerEarningsPage() {
  const user = await requirePartner(); const db = getDb();
  const [summary] = await db.select({ total: sql<number>`coalesce(sum(${earnings.amount}),0)::int`, available: sql<number>`coalesce(sum(case when ${earnings.status} = 'AVAILABLE' then ${earnings.amount} else 0 end),0)::int`, settled: sql<number>`coalesce(sum(case when ${earnings.status} = 'SETTLED' then ${earnings.amount} else 0 end),0)::int` }).from(earnings).where(eq(earnings.partnerId, user.partnerId!));
  const rows = await db.select({ id: earnings.id, amount: earnings.amount, status: earnings.status, type: earnings.type, description: earnings.description, createdAt: earnings.createdAt, conversionCode: conversions.conversionCode }).from(earnings).leftJoin(conversions, eq(earnings.conversionId, conversions.id)).where(eq(earnings.partnerId, user.partnerId!)).orderBy(desc(earnings.createdAt));
  return <DashboardShell title="수익" description="승인된 CPA·포스팅 수익과 정산 가능 금액을 확인합니다." nav={nav}>
    <section className="stats"><div className="panel stat"><span>누적 확정수익</span><strong>{Number(summary?.total ?? 0).toLocaleString("ko-KR")}원</strong></div><div className="panel stat"><span>출금가능</span><strong>{Number(summary?.available ?? 0).toLocaleString("ko-KR")}원</strong></div><div className="panel stat"><span>정산완료</span><strong>{Number(summary?.settled ?? 0).toLocaleString("ko-KR")}원</strong></div></section>
    <section className="panel card"><div className="table-wrap"><table><thead><tr><th>일시</th><th>구분</th><th>접수번호</th><th>설명</th><th>금액</th><th>상태</th></tr></thead><tbody>{rows.length ? rows.map(r=><tr key={r.id}><td>{new Date(r.createdAt).toLocaleString("ko-KR")}</td><td>{r.type}</td><td>{r.conversionCode ?? "-"}</td><td>{r.description ?? "-"}</td><td><strong>{r.amount.toLocaleString("ko-KR")}원</strong></td><td><span className="badge">{r.status}</span></td></tr>) : <tr><td colSpan={6} className="empty-cell">아직 확정된 수익이 없습니다.</td></tr>}</tbody></table></div></section>
  </DashboardShell>;
}
