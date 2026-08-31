import DashboardShell from "@/components/DashboardShell";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { advertiserLedger, campaigns, conversions } from "@/db/schema";
import { requireAdvertiser } from "@/lib/auth/advertiser";

const nav = [
  { href: "/advertiser", label: "대시보드" }, { href: "/advertiser/campaigns", label: "캠페인" }, { href: "/advertiser/conversions", label: "전환 DB" },
  { href: "/advertiser/posting", label: "포스팅 작업" }, { href: "/advertiser/ledger", label: "광고비" }, { href: "/advertiser/reports", label: "통계" }, { href: "/advertiser/profile", label: "회사정보" },
];

export const dynamic = "force-dynamic";

export default async function AdvertiserPage() {
  const advertiser = await requireAdvertiser();
  const db = getDb();
  const today = new Date(); today.setHours(0,0,0,0);
  const month = new Date(today.getFullYear(), today.getMonth(), 1);

  const [todayRow] = await db.select({
    total: sql<number>`count(*)`,
    approved: sql<number>`count(*) filter (where ${conversions.status} = 'APPROVED')`,
  }).from(conversions).innerJoin(campaigns, eq(conversions.campaignId, campaigns.id))
    .where(and(eq(campaigns.advertiserId, advertiser.advertiserId), gte(conversions.submittedAt, today)));

  const [balanceRow] = await db.select({ balance: sql<number>`coalesce(sum(${advertiserLedger.amount}), 0)` })
    .from(advertiserLedger).where(eq(advertiserLedger.advertiserId, advertiser.advertiserId));

  const [monthRow] = await db.select({ spend: sql<number>`coalesce(sum(case when ${advertiserLedger.amount} < 0 then -${advertiserLedger.amount} else 0 end), 0)` })
    .from(advertiserLedger).where(and(eq(advertiserLedger.advertiserId, advertiser.advertiserId), gte(advertiserLedger.createdAt, month)));

  const total = Number(todayRow?.total ?? 0); const approved = Number(todayRow?.approved ?? 0); const balance = Number(balanceRow?.balance ?? 0); const spend = Number(monthRow?.spend ?? 0);
  return <DashboardShell title="광고주센터" description={`${advertiser.companyName} · ${advertiser.advertiserCode}`} nav={nav}>
    <section className="stats"><div className="panel stat"><span>오늘 DB</span><strong>{total}</strong></div><div className="panel stat"><span>오늘 승인</span><strong>{approved}</strong></div><div className="panel stat"><span>승인율</span><strong>{total ? ((approved/total)*100).toFixed(1) : "0"}%</strong></div><div className="panel stat"><span>현재 예치금</span><strong>{balance.toLocaleString("ko-KR")}원</strong></div></section>
    <section className="grid-3" style={{marginBottom:20}}><div className="panel card"><h3>이번달 광고비</h3><p>{spend.toLocaleString("ko-KR")}원</p></div><div className="panel card"><h3>오늘 검수대기</h3><p>{Math.max(0,total-approved)}건</p></div><div className="panel card"><h3>광고상품</h3><p>CPA + 포스팅 통합 관리</p></div></section>
    <section className="panel card"><h3>캠페인 성과</h3><p className="muted">캠페인별 DB·승인율·광고비는 캠페인 메뉴에서 확인할 수 있습니다.</p></section>
  </DashboardShell>;
}
