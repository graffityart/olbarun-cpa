import {advertiserAccountStatuses,advertiserManagementHistory} from '@/lib/admin-advertiser-queue';
import {contractStatus,paymentTypes} from '@/lib/admin-members';
import {ledgerTypeLabels} from '@/lib/advertiser-ui';
import AdvertiserApprovalButton from "@/components/AdvertiserApprovalButton";
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
  const { id } = await params; if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound(); const db = getDb();
  const [advertiser] = await db.select().from(advertisers).where(eq(advertisers.id, id)).limit(1); if (!advertiser) notFound();
  const [account] = await db.select({ email: users.email, status: users.status, role: advertiserUsers.role }).from(advertiserUsers).innerJoin(users, eq(users.id, advertiserUsers.userId)).where(eq(advertiserUsers.advertiserId, id)).orderBy(sql`(${advertiserUsers.role}='OWNER') desc`,advertiserUsers.id).limit(1);
  const [balanceRow] = await db.select({ balance: sql<number>`coalesce(sum(${advertiserLedger.amount}),0)` }).from(advertiserLedger).where(eq(advertiserLedger.advertiserId, id));
  const ledger = await db.select().from(advertiserLedger).where(eq(advertiserLedger.advertiserId, id)).orderBy(desc(advertiserLedger.createdAt)).limit(20);
  const history=await advertiserManagementHistory(id);
  const formatDate=(date:Date)=>date.toLocaleString("ko-KR",{timeZone:"Asia/Seoul"});
  const nav = [{ href: "/admin/advertisers", label: "← 광고주 관리" }, { href: "/admin/campaigns", label: "캠페인 관리" }, { href: "/admin/ledger", label: "광고비·수익" }];
  return <DashboardShell title={advertiser.companyName} description={`${advertiser.advertiserCode} · ${contractStatus[advertiser.contractStatus]??advertiser.contractStatus}`} nav={nav}>
    <section className="grid-3" style={{marginBottom:18}}><div className="panel card"><h3>현재 예치금</h3><p>{Number(balanceRow?.balance??0).toLocaleString("ko-KR")}원</p></div><div className="panel card"><h3>광고주 계정</h3><p>{account ? account.email : "미생성"}</p></div><div className="panel card"><h3>결제방식</h3><p>{paymentTypes[advertiser.paymentType]??advertiser.paymentType}</p></div></section>
    <section className="panel card" style={{marginBottom:18}}><h2>광고주 가입 정보</h2><div className="grid-3"><div><h3>회사명</h3><p>{advertiser.companyName}</p></div><div><h3>대표자·담당자</h3><p>{advertiser.representativeName||"미입력"}</p></div><div><h3>사업자등록번호</h3><p>{advertiser.businessNumber||"미입력"}</p></div></div><p className="muted">등록일 {formatDate(advertiser.createdAt)} · 계약 상태 {contractStatus[advertiser.contractStatus]??advertiser.contractStatus}</p></section>
    {!account ? <AdvertiserAccountManager advertiserId={id} /> : <div className="grid-2"><section className="panel card"><h2>로그인 계정</h2><p><strong>{account.email}</strong></p><p className="muted">상태 {advertiserAccountStatuses[account.status]??account.status} · 권한 {account.role==='OWNER'?'소유자':account.role}</p>{account.status==="PENDING"&&<><p className="muted">가입 정보를 확인하고 승인하면 광고주가 로그인할 수 있습니다. 계약 상태는 별도로 유지됩니다.</p><AdvertiserApprovalButton advertiserId={id}/></>}</section><AdvertiserAccountManager advertiserId={id} hasAccount /></div>}
    <section className="panel card" style={{marginTop:18}}><h2>최근 광고비 장부</h2><div className="table-wrap"><table><thead><tr><th>일시</th><th>구분</th><th>금액</th><th>잔액</th><th>내용</th></tr></thead><tbody>{ledger.length?ledger.map(row=><tr key={row.id}><td>{formatDate(row.createdAt)}</td><td>{ledgerTypeLabels[row.type]??row.type}</td><td>{row.amount.toLocaleString("ko-KR")}원</td><td>{row.balanceAfter==null?"-":`${row.balanceAfter.toLocaleString("ko-KR")}원`}</td><td>{row.description??"-"}</td></tr>):<tr><td colSpan={5} className="empty-cell">광고비 내역이 없습니다.</td></tr>}</tbody></table></div></section>
    <section className="panel card" style={{marginTop:18}}><h2>최근 관리 이력</h2><p className="muted">이 광고주의 계정 승인·생성·예치금 처리 등 기록된 최신 20건을 표시합니다.</p><div className="table-wrap"><table><thead><tr><th>일시</th><th>처리</th><th>내용</th></tr></thead><tbody>{history.length?history.map(row=><tr key={row.id}><td>{formatDate(row.createdAt)}</td><td>{({ADVERTISER_APPROVED:'가입 승인',ADVERTISER_ACCOUNT_CREATED:'계정 생성',ADVERTISER_DEPOSIT:'예치금 충전'} as Record<string,string>)[row.action]??row.action}</td><td>{row.summary}</td></tr>):<tr><td colSpan={3} className="empty-cell">기록된 관리 이력이 없습니다.</td></tr>}</tbody></table></div></section>
  </DashboardShell>;
}
