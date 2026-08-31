import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import SettlementReview from "@/components/SettlementReview";
import { getDb } from "@/db";
import { partners, settlements } from "@/db/schema";

export const dynamic="force-dynamic";

export default async function Page({params}:{params:Promise<{id:string}>}){
  const{id}=await params;
  const[row]=await getDb().select({settlement:settlements,partnerName:partners.name,partnerCode:partners.partnerCode}).from(settlements).leftJoin(partners,eq(settlements.partnerId,partners.id)).where(eq(settlements.id,id)).limit(1);
  if(!row)notFound(); const s=row.settlement; const bank=(s.bankAccountSnapshot??{}) as Record<string,unknown>;
  return <DashboardShell title="정산 상세" description={s.settlementCode} nav={[{href:"/admin/settlements",label:"← 정산 관리"}]}><section className="grid-2"><div className="panel card"><h2>파트너</h2><p><strong>이름</strong><br/>{row.partnerName??"-"}</p><p><strong>파트너 코드</strong><br/>{row.partnerCode??"-"}</p><p><strong>상태</strong><br/><span className="badge">{s.status}</span></p></div><div className="panel card"><h2>지급정보</h2><p><strong>신청금액</strong><br/>{s.requestedAmount.toLocaleString("ko-KR")}원</p><p><strong>지급금액</strong><br/>{s.paymentAmount.toLocaleString("ko-KR")}원</p><p><strong>은행</strong><br/>{String(bank.bankName??"-")}</p><p><strong>계좌번호</strong><br/>{String(bank.accountNumber??"-")}</p><p><strong>예금주</strong><br/>{String(bank.accountHolder??"-")}</p></div></section><section className="panel card" style={{marginTop:18}}><h2>정산 처리</h2><SettlementReview id={s.id} status={s.status}/></section></DashboardShell>
}
