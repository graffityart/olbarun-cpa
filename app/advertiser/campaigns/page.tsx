import DashboardShell from "@/components/DashboardShell";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { advertiserLedger, campaigns, conversions } from "@/db/schema";
import { requireAdvertiser } from "@/lib/auth/advertiser";

export const dynamic = "force-dynamic";
const nav = [{href:"/advertiser",label:"대시보드"},{href:"/advertiser/campaigns",label:"캠페인"},{href:"/advertiser/conversions",label:"전환 DB"},{href:"/advertiser/ledger",label:"광고비"}];

export default async function Page(){
  const advertiser=await requireAdvertiser(); const db=getDb();
  const rows=await db.select({id:campaigns.id,name:campaigns.name,type:campaigns.type,status:campaigns.status,total:sql<number>`count(distinct ${conversions.id})`,approved:sql<number>`count(distinct ${conversions.id}) filter (where ${conversions.status}='APPROVED')`,spend:sql<number>`coalesce(sum(distinct case when ${advertiserLedger.amount}<0 then -${advertiserLedger.amount} else 0 end),0)`})
    .from(campaigns).leftJoin(conversions,eq(conversions.campaignId,campaigns.id)).leftJoin(advertiserLedger,eq(advertiserLedger.conversionId,conversions.id)).where(eq(campaigns.advertiserId,advertiser.advertiserId)).groupBy(campaigns.id).orderBy(desc(campaigns.createdAt));
  return <DashboardShell title="캠페인" description="광고상품별 성과를 확인합니다." nav={nav}><section className="panel card"><div className="table-wrap"><table><thead><tr><th>캠페인</th><th>유형</th><th>상태</th><th>DB</th><th>승인</th><th>승인율</th><th>사용금액</th></tr></thead><tbody>{rows.length?rows.map(r=>{const t=Number(r.total||0),a=Number(r.approved||0);return <tr key={r.id}><td><strong>{r.name}</strong></td><td>{r.type}</td><td><span className="badge">{r.status}</span></td><td>{t}</td><td>{a}</td><td>{t?((a/t)*100).toFixed(1):"0"}%</td><td>{Number(r.spend||0).toLocaleString("ko-KR")}원</td></tr>}):<tr><td colSpan={7} className="empty-cell">등록된 캠페인이 없습니다.</td></tr>}</tbody></table></div></section></DashboardShell>;
}
