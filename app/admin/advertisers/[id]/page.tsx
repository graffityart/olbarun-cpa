import { desc, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import AdvertiserAccountManager from "@/components/AdvertiserAccountManager";
import { getDb } from "@/db";
import { advertiserLedger, advertiserUsers, advertisers, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdvertiserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params; const db = getDb();
  const [advertiser] = await db.select().from(advertisers).where(eq(advertisers.id, id)).limit(1); if (!advertiser) notFound();
  const [account] = await db.select({ email: users.email, status: users.status, role: advertiserUsers.role }).from(advertiserUsers).innerJoin(users, eq(users.id, advertiserUsers.userId)).where(eq(advertiserUsers.advertiserId, id)).limit(1);
  const [balanceRow] = await db.select({ balance: sql<number>`coalesce(sum(${advertiserLedger.amount}),0)` }).from(advertiserLedger).where(eq(advertiserLedger.advertiserId, id));
  const ledger = await db.select().from(advertiserLedger).where(eq(advertiserLedger.advertiserId, id)).orderBy(desc(advertiserLedger.createdAt)).limit(20);
  const nav = [{ href: "/admin/advertisers", label: "← 광고주 관리" }, { href: "/admin/campaigns", label: "캠페인 관리" }, { href: "/admin/ledger", label: "광고비·수익" }];
  return <DashboardShell title={advertiser.companyName} description={`${advertiser.advertiserCode} · ${advertiser.contractStatus}`} nav={nav}>
    <section className="grid-3" style={{marginBottom:18}}><div className="panel card"><h3>현재 예치금</h3><p>{Number(balanceRow?.balance??0).toLocaleString("ko-KR")}원</p></div><div className="panel card"><h3>광고주 계정</h3><p>{account ? account.email : "미생성"}</p></div><div className="panel card"><h3>결제방식</h3><p>{advertiser.paymentType}</p></div></section>
    {!account ? <AdvertiserAccountManager advertiserId={id} /> : <div className="grid-2"><section className="panel card"><h2>로그인 계정</h2><p><strong>{account.email}</strong></p><p className="muted">상태 {account.status} · 권한 {account.role}</p></section><AdvertiserAccountManager advertiserId={id} /></div>}
    <section className="panel card" style={{marginTop:18}}><h2>최근 광고비 장부</h2><div className="table-wrap"><table><thead><tr><th>일시</th><th>구분</th><th>금액</th><th>잔액</th><th>내용</th></tr></thead><tbody>{ledger.length?ledger.map(row=><tr key={row.id}><td>{row.createdAt.toLocaleString("ko-KR")}</td><td>{row.type}</td><td>{row.amount.toLocaleString("ko-KR")}원</td><td>{row.balanceAfter==null?"-":`${row.balanceAfter.toLocaleString("ko-KR")}원`}</td><td>{row.description??"-"}</td></tr>):<tr><td colSpan={5} className="empty-cell">광고비 내역이 없습니다.</td></tr>}</tbody></table></div></section>
  </DashboardShell>;
}
