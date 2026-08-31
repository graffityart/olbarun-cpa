import DashboardShell from "@/components/DashboardShell";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { advertiserLedger } from "@/db/schema";
import { requireAdvertiser } from "@/lib/auth/advertiser";

export const dynamic="force-dynamic";
const nav=[{href:"/advertiser",label:"대시보드"},{href:"/advertiser/campaigns",label:"캠페인"},{href:"/advertiser/conversions",label:"전환 DB"},{href:"/advertiser/ledger",label:"광고비"}];

export default async function Page(){const advertiser=await requireAdvertiser();const db=getDb();const rows=await db.select().from(advertiserLedger).where(eq(advertiserLedger.advertiserId,advertiser.advertiserId)).orderBy(desc(advertiserLedger.createdAt));const [sum]=await db.select({balance:sql<number>`coalesce(sum(${advertiserLedger.amount}),0)`}).from(advertiserLedger).where(eq(advertiserLedger.advertiserId,advertiser.advertiserId));return <DashboardShell title="광고비 장부" description="충전·차감 내역과 현재 예치금을 확인합니다." nav={nav}><section className="stats"><div className="panel stat"><span>현재 예치금</span><strong>{Number(sum?.balance??0).toLocaleString("ko-KR")}원</strong></div></section><section className="panel card"><div className="table-wrap"><table><thead><tr><th>일시</th><th>구분</th><th>금액</th><th>내용</th></tr></thead><tbody>{rows.length?rows.map(r=><tr key={r.id}><td>{new Date(r.createdAt).toLocaleString("ko-KR")}</td><td>{r.type}</td><td>{r.amount>0?"+":""}{r.amount.toLocaleString("ko-KR")}원</td><td>{r.description??"-"}</td></tr>):<tr><td colSpan={4} className="empty-cell">광고비 내역이 없습니다.</td></tr>}</tbody></table></div></section></DashboardShell>}
