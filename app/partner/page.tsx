import DashboardShell from "@/components/DashboardShell";
import { and, eq, gte, sql } from "drizzle-orm";
import { requirePartner } from "@/lib/auth/guards";
import { getDb } from "@/db";
import { clicks, conversions, earnings } from "@/db/schema";

const nav = [
  { href: "/partner", label: "대시보드" }, { href: "/partner/campaigns", label: "CPA 캠페인" }, { href: "/partner/posting", label: "포스팅 광고" },
  { href: "/partner/links", label: "광고링크" }, { href: "/partner/conversions", label: "전환 실적" }, { href: "/partner/earnings", label: "수익" },
  { href: "/partner/settlements", label: "정산" }, { href: "/partner/profile", label: "내 정보" },
];

function startOfTodayKst() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return new Date(`${parts}T00:00:00+09:00`);
}

export default async function PartnerPage() {
  const user = await requirePartner(); const db = getDb(); const today = startOfTodayKst(); const partnerId = user.partnerId!;
  const [clickSummary] = await db.select({ count: sql<number>`count(*)::int` }).from(clicks).where(and(eq(clicks.partnerId, partnerId), gte(clicks.clickedAt, today)));
  const [conversionSummary] = await db.select({ db: sql<number>`count(*)::int`, approved: sql<number>`count(*) filter (where ${conversions.status} = 'APPROVED')::int` }).from(conversions).where(and(eq(conversions.partnerId, partnerId), gte(conversions.submittedAt, today)));
  const [todayEarningSummary] = await db.select({ amount: sql<number>`coalesce(sum(${earnings.amount}),0)::int` }).from(earnings).where(and(eq(earnings.partnerId, partnerId), gte(earnings.createdAt, today)));
  const [earningSummary] = await db.select({ confirmed: sql<number>`coalesce(sum(${earnings.amount}),0)::int`, available: sql<number>`coalesce(sum(case when ${earnings.status} = 'AVAILABLE' then ${earnings.amount} else 0 end),0)::int` }).from(earnings).where(eq(earnings.partnerId, partnerId));
  const [reviewSummary] = await db.select({ amount: sql<number>`coalesce(sum(${conversions.partnerRateSnapshot}) filter (where ${conversions.status} in ('RECEIVED','DELIVERED','REVIEWING')),0)::int` }).from(conversions).where(eq(conversions.partnerId, partnerId));

  return <DashboardShell title="파트너센터" description={`${user.partnerName ?? user.email}님 · ${user.partnerCode ?? ""}`} nav={nav}>
    <section className="stats"><div className="panel stat"><span>오늘 클릭</span><strong>{clickSummary?.count ?? 0}</strong></div><div className="panel stat"><span>오늘 DB</span><strong>{conversionSummary?.db ?? 0}</strong></div><div className="panel stat"><span>오늘 승인</span><strong>{conversionSummary?.approved ?? 0}</strong></div><div className="panel stat"><span>오늘 수익</span><strong>{Number(todayEarningSummary?.amount ?? 0).toLocaleString("ko-KR")}원</strong></div></section>
    <section className="grid-3" style={{ marginBottom: 20 }}><div className="panel card"><h3>검수중 예상수익</h3><p>{Number(reviewSummary?.amount ?? 0).toLocaleString("ko-KR")}원</p></div><div className="panel card"><h3>확정수익</h3><p>{Number(earningSummary?.confirmed ?? 0).toLocaleString("ko-KR")}원</p></div><div className="panel card"><h3>출금가능</h3><p>{Number(earningSummary?.available ?? 0).toLocaleString("ko-KR")}원</p></div></section>
    <section className="panel card"><h3>운영 바로가기</h3><p className="muted">CPA 캠페인에서 광고링크를 생성한 뒤 전환 실적과 승인 수익을 실시간으로 확인할 수 있습니다.</p><div className="actions" style={{marginTop:16}}><a className="btn primary" href="/partner/campaigns">CPA 캠페인</a><a className="btn" href="/partner/links">광고링크</a><a className="btn" href="/partner/conversions">전환 실적</a></div></section>
  </DashboardShell>;
}
