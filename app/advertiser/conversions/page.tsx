import DashboardShell from "@/components/DashboardShell";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, conversionData, conversions, partners } from "@/db/schema";
import { requireAdvertiser } from "@/lib/auth/advertiser";

export const dynamic="force-dynamic";
const nav=[{href:"/advertiser",label:"대시보드"},{href:"/advertiser/campaigns",label:"캠페인"},{href:"/advertiser/conversions",label:"전환 DB"},{href:"/advertiser/ledger",label:"광고비"}];

export default async function Page(){const advertiser=await requireAdvertiser();const rows=await getDb().select({id:conversions.id,code:conversions.conversionCode,campaign:campaigns.name,status:conversions.status,customer:conversionData.customerName,region:conversionData.region,partner:partners.partnerCode,cost:conversions.advertiserRateSnapshot,submittedAt:conversions.submittedAt}).from(conversions).innerJoin(campaigns,eq(conversions.campaignId,campaigns.id)).leftJoin(conversionData,eq(conversionData.conversionId,conversions.id)).leftJoin(partners,eq(conversions.partnerId,partners.id)).where(eq(campaigns.advertiserId,advertiser.advertiserId)).orderBy(desc(conversions.submittedAt));return <DashboardShell title="전환 DB" description="내 캠페인에서 접수된 CPA 신청내역입니다." nav={nav}><section className="panel card"><div className="table-wrap"><table><thead><tr><th>접수번호</th><th>캠페인</th><th>고객</th><th>파트너</th><th>상태</th><th>광고비</th><th>접수일</th></tr></thead><tbody>{rows.length?rows.map(r=><tr key={r.id}><td>{r.code}</td><td>{r.campaign}</td><td>{r.customer??"-"}<br/><span className="muted">{r.region??""}</span></td><td>{r.partner??"직접유입"}</td><td><span className="badge">{r.status}</span></td><td>{r.cost.toLocaleString("ko-KR")}원</td><td>{new Date(r.submittedAt).toLocaleString("ko-KR")}</td></tr>):<tr><td colSpan={7} className="empty-cell">접수된 DB가 없습니다.</td></tr>}</tbody></table></div></section></DashboardShell>}
