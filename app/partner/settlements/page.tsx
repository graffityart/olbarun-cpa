import DashboardShell from "@/components/DashboardShell";
import SettlementRequest from "@/components/SettlementRequest";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/auth/guards";
import { earnings, settlements } from "@/db/schema";

export const dynamic="force-dynamic";

export default async function Page(){
  const user=await requirePartner(); const db=getDb();
  const availableRows=await db.select().from(earnings).where(and(eq(earnings.partnerId,user.partnerId!),eq(earnings.status,"AVAILABLE")));
  const available=availableRows.reduce((s,r)=>s+r.amount,0);
  const rows=await db.select().from(settlements).where(eq(settlements.partnerId,user.partnerId!)).orderBy(desc(settlements.requestedAt));
  return <DashboardShell title="정산" description="확정수익을 정산 신청하고 처리상태를 확인합니다." nav={[{href:"/partner",label:"대시보드"},{href:"/partner/earnings",label:"수익"},{href:"/partner/settlements",label:"정산"}]}>
    <SettlementRequest available={available}/>
    <section className="panel card" style={{marginTop:18}}><h2>정산 내역</h2><div className="table-wrap"><table><thead><tr><th>정산번호</th><th>신청금액</th><th>실지급액</th><th>상태</th><th>신청일</th></tr></thead><tbody>{rows.length?rows.map(r=><tr key={r.id}><td>{r.settlementCode}</td><td>{r.requestedAmount.toLocaleString("ko-KR")}원</td><td>{r.paymentAmount.toLocaleString("ko-KR")}원</td><td><span className="badge">{r.status}</span></td><td>{r.requestedAt.toLocaleString("ko-KR")}</td></tr>):<tr><td colSpan={5} className="empty-cell">정산 신청 내역이 없습니다.</td></tr>}</tbody></table></div></section>
  </DashboardShell>
}
