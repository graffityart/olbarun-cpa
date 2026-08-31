import DashboardShell from "@/components/DashboardShell";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { partners, settlements } from "@/db/schema";

export const dynamic="force-dynamic";

export default async function Page(){
  const rows=await getDb().select({id:settlements.id,code:settlements.settlementCode,partnerCode:partners.partnerCode,partnerName:partners.name,requested:settlements.requestedAmount,payment:settlements.paymentAmount,status:settlements.status,requestedAt:settlements.requestedAt}).from(settlements).leftJoin(partners,eq(settlements.partnerId,partners.id)).orderBy(desc(settlements.requestedAt));
  return <DashboardShell title="정산 관리" description="파트너 정산 요청을 승인하고 지급완료 처리합니다." nav={[{href:"/admin",label:"대시보드"},{href:"/admin/ledger",label:"광고비·수익"},{href:"/admin/settlements",label:"정산"}]}><section className="panel card"><div className="table-wrap"><table><thead><tr><th>정산번호</th><th>파트너</th><th>신청금액</th><th>지급금액</th><th>상태</th><th>신청일</th><th>관리</th></tr></thead><tbody>{rows.length?rows.map(r=><tr key={r.id}><td>{r.code}</td><td>{r.partnerName??"-"}<br/><span className="muted">{r.partnerCode??""}</span></td><td>{r.requested.toLocaleString("ko-KR")}원</td><td>{r.payment.toLocaleString("ko-KR")}원</td><td><span className="badge">{r.status}</span></td><td>{r.requestedAt.toLocaleString("ko-KR")}</td><td><a href={`/admin/settlements/${r.id}`}>처리</a></td></tr>):<tr><td colSpan={7} className="empty-cell">정산 요청이 없습니다.</td></tr>}</tbody></table></div></section></DashboardShell>
}
