import DashboardShell from "@/components/DashboardShell";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { advertiserLedger, campaigns, conversions } from "@/db/schema";
import { requireAdvertiser } from "@/lib/auth/advertiser";

import Link from 'next/link';
import {advertiserNav as nav,koreanPeriod} from '@/lib/advertiser-ui';
import './advertiser.css';

export const dynamic = "force-dynamic";

export default async function AdvertiserPage() {
  const advertiser = await requireAdvertiser();
  const db = getDb();
  const {today,month}=koreanPeriod();

  const [todayRow] = await db.select({
    total: sql<number>`count(*)`,
    approved: sql<number>`count(*) filter (where ${conversions.status} = 'APPROVED')`,
    pending: sql<number>`count(*) filter (where ${conversions.status} in ('RECEIVED','DELIVERED','REVIEWING','REJECTION_REQUESTED','DISPUTED'))`,
  }).from(conversions).innerJoin(campaigns, eq(conversions.campaignId, campaigns.id))
    .where(and(eq(campaigns.advertiserId, advertiser.advertiserId), gte(conversions.submittedAt, today)));

  const [balanceRow] = await db.select({ balance: sql<number>`coalesce(sum(${advertiserLedger.amount}), 0)` })
    .from(advertiserLedger).where(eq(advertiserLedger.advertiserId, advertiser.advertiserId));

  const [monthRow] = await db.select({ spend: sql<number>`coalesce(sum(case when ${advertiserLedger.amount} < 0 then -${advertiserLedger.amount} else 0 end), 0)` })
    .from(advertiserLedger).where(and(eq(advertiserLedger.advertiserId, advertiser.advertiserId), gte(advertiserLedger.createdAt, month)));

  const total = Number(todayRow?.total ?? 0); const approved = Number(todayRow?.approved ?? 0); const balance = Number(balanceRow?.balance ?? 0); const spend = Number(monthRow?.spend ?? 0);
  return <DashboardShell title="광고주센터" description={`${advertiser.companyName} · ${advertiser.advertiserCode}`} nav={nav}>
    <section className="stats"><div className="panel stat"><span>오늘 DB</span><strong>{total}</strong></div><div className="panel stat"><span>오늘 접수 중 승인</span><strong>{approved}</strong></div><div className="panel stat"><span>오늘 접수분 승인율</span><strong>{total ? ((approved/total)*100).toFixed(1) : "0"}%</strong></div><div className="panel stat"><span>현재 예치금</span><strong>{balance.toLocaleString("ko-KR")}원</strong></div></section>
    <section className="grid-3" style={{marginBottom:20}}><div className="panel card"><h3>이번달 광고비</h3><p>{spend.toLocaleString("ko-KR")}원</p></div><div className="panel card"><h3>오늘 접수 중 검수 대기</h3><p>{Number(todayRow?.pending??0)}건</p></div><div className="panel card"><h3>광고상품</h3><p>CPA + 포스팅 통합 관리</p></div></section>
    <section className="panel card"><h3>캠페인 성과</h3><p className="muted">오늘·이번 달 집계는 한국 시간 기준입니다. CPA 승인과 포스팅 승인 광고비는 실제 장부에 차감된 금액으로 집계합니다.</p><div className="ad-actions"><Link href="/advertiser/campaigns">캠페인 성과</Link><Link href="/advertiser/conversions?status=DELIVERED">CPA 검수 요청</Link><Link href="/advertiser/posting">포스팅 현황</Link><Link href="/advertiser/ledger">광고비 내역</Link></div></section>
  </DashboardShell>;
}
