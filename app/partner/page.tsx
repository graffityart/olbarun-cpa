import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { requirePartner } from "@/lib/auth/guards";
import { getDb } from "@/db";
import { campaigns, clicks, conversions, earnings } from "@/db/schema";

const nav=[{href:"/partner",label:"대시보드"},{href:"/partner/campaigns",label:"CPA 캠페인"},{href:"/partner/posting",label:"포스팅 광고"},{href:"/partner/links",label:"광고링크"},{href:"/partner/conversions",label:"전환 실적"},{href:"/partner/earnings",label:"수익"},{href:"/partner/settlements",label:"정산"},{href:"/partner/profile",label:"내 정보"}];
const money=(v:unknown)=>Number(v??0).toLocaleString("ko-KR")+"원";
function kstStart(kind:"day"|"month"){const now=new Date();const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);return new Date(kind==="day"?p+"T00:00:00+09:00":p.slice(0,7)+"-01T00:00:00+09:00")}
const statusName:Record<string,string>={RECEIVED:"접수",DELIVERED:"전달",REVIEWING:"검수중",APPROVED:"승인",REJECTION_REQUESTED:"반려요청",REJECTED:"반려",DISPUTED:"이의제기",CANCELLED:"취소",TEST:"테스트"};

export default async function PartnerPage(){
 const user=await requirePartner();const db=getDb();const partnerId=user.partnerId!;const today=kstStart("day"),month=kstStart("month");
 const [[clickToday],[convToday],[todayEarn],[earnAll],[review],[monthConv],[monthEarn],recent]=await Promise.all([
  db.select({count:sql<number>`count(*)::int`}).from(clicks).where(and(eq(clicks.partnerId,partnerId),gte(clicks.clickedAt,today))),
  db.select({db:sql<number>`count(*)::int`,approved:sql<number>`count(*) filter (where ${conversions.status}='APPROVED')::int`}).from(conversions).where(and(eq(conversions.partnerId,partnerId),gte(conversions.submittedAt,today))),
  db.select({amount:sql<number>`coalesce(sum(${earnings.amount}),0)::int`}).from(earnings).where(and(eq(earnings.partnerId,partnerId),gte(earnings.createdAt,today))),
  db.select({confirmed:sql<number>`coalesce(sum(${earnings.amount}),0)::int`,available:sql<number>`coalesce(sum(case when ${earnings.status}='AVAILABLE' then ${earnings.amount} else 0 end),0)::int`}).from(earnings).where(eq(earnings.partnerId,partnerId)),
  db.select({amount:sql<number>`coalesce(sum(${conversions.partnerRateSnapshot}) filter (where ${conversions.status} in ('RECEIVED','DELIVERED','REVIEWING')),0)::int`}).from(conversions).where(eq(conversions.partnerId,partnerId)),
  db.select({total:sql<number>`count(*)::int`,approved:sql<number>`count(*) filter (where ${conversions.status}='APPROVED')::int`}).from(conversions).where(and(eq(conversions.partnerId,partnerId),gte(conversions.submittedAt,month))),
  db.select({amount:sql<number>`coalesce(sum(${earnings.amount}),0)::int`}).from(earnings).where(and(eq(earnings.partnerId,partnerId),gte(earnings.createdAt,month))),
  db.select({id:conversions.id,status:conversions.status,amount:conversions.partnerRateSnapshot,submittedAt:conversions.submittedAt,campaignName:campaigns.name}).from(conversions).leftJoin(campaigns,eq(conversions.campaignId,campaigns.id)).where(eq(conversions.partnerId,partnerId)).orderBy(desc(conversions.submittedAt)).limit(5)
 ]);
 const approvalRate=monthConv?.total?Math.round(((monthConv.approved??0)/monthConv.total)*100):0;
 return <DashboardShell title="파트너센터" description={`${user.partnerName??user.email}님 · ${user.partnerCode??""}`} nav={nav}>
  <div className="partner-home">
   <section className="ph-welcome"><div><span className="ph-eyebrow">MY PICKUP PARTNER</span><h1>{user.partnerName??"파트너"}님, 오늘도 좋은 성과를 만들어보세요.</h1><p>캠페인 참여부터 전환 확인, 수익과 정산까지 한 화면에서 빠르게 확인할 수 있습니다.</p></div><div className="ph-welcome-actions"><Link href="/partner/campaigns">CPA 캠페인 찾기</Link><Link href="/partner/posting">포스팅 광고 찾기</Link></div></section>
   <section className="ph-today"><div className="ph-section-title"><div><span>TODAY</span><h2>오늘의 활동</h2></div><small>오늘 00:00부터 현재까지</small></div><div className="ph-stat-grid">
    <article><i>↗</i><span>오늘 클릭</span><strong>{clickToday?.count??0}<small>회</small></strong><p>광고링크 유입</p></article>
    <article><i>＋</i><span>오늘 DB</span><strong>{convToday?.db??0}<small>건</small></strong><p>신규 전환 접수</p></article>
    <article><i>✓</i><span>오늘 승인</span><strong>{convToday?.approved??0}<small>건</small></strong><p>승인 완료 성과</p></article>
    <article className="accent"><i>₩</i><span>오늘 수익</span><strong>{money(todayEarn?.amount)}</strong><p>오늘 반영된 수익</p></article>
   </div></section>
   <section className="ph-money"><div className="ph-section-title"><div><span>EARNINGS</span><h2>수익 현황</h2></div><Link href="/partner/earnings">상세보기 →</Link></div><div className="ph-money-grid">
    <article><span>검수중 예상수익</span><strong>{money(review?.amount)}</strong><p>승인 전 예상 금액</p></article>
    <article><span>누적 확정수익</span><strong>{money(earnAll?.confirmed)}</strong><p>승인 후 반영된 전체 수익</p></article>
    <article className="primary"><span>출금 가능</span><strong>{money(earnAll?.available)}</strong><p>현재 정산 신청 가능한 금액</p><Link href="/partner/settlements">정산 신청 →</Link></article>
   </div></section>
   <section className="ph-lower"><div className="ph-recent"><div className="ph-section-title"><div><span>RECENT RESULTS</span><h2>최근 전환 실적</h2></div><Link href="/partner/conversions">전체보기 →</Link></div>
    {recent.length?<div className="ph-table">{recent.map(r=><div className="ph-row" key={r.id}><div><b>{r.campaignName??"캠페인"}</b><small>{new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(r.submittedAt)}</small></div><span className={`status s-${r.status.toLowerCase()}`}>{statusName[r.status]??r.status}</span><strong>{money(r.amount)}</strong></div>)}</div>:<div className="ph-empty"><b>아직 전환 실적이 없습니다.</b><p>CPA 캠페인에 참여하고 광고링크를 생성해 첫 성과를 시작해 보세요.</p><Link href="/partner/campaigns">캠페인 둘러보기</Link></div>}
   </div><aside className="ph-side"><div className="ph-month"><span>이번 달 성과</span><div><strong>{monthConv?.total??0}</strong><small>전체 전환</small></div><div><strong>{approvalRate}%</strong><small>승인율</small></div><div><strong>{money(monthEarn?.amount)}</strong><small>이번 달 수익</small></div></div><div className="ph-quick"><span>빠른 메뉴</span><Link href="/partner/campaigns"><b>CPA 캠페인</b><small>참여할 광고 찾기</small>→</Link><Link href="/partner/links"><b>광고링크</b><small>내 추적 링크 관리</small>→</Link><Link href="/partner/settlements"><b>정산 관리</b><small>수익 출금 신청</small>→</Link></div></aside></section>
  </div>
 </DashboardShell>
}