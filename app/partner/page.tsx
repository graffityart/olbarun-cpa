import Link from "next/link";
import "./dashboard.css";
import { quickReady } from "@/lib/quick";
import DashboardShell from "@/components/DashboardShell";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { requirePartner } from "@/lib/auth/guards";
import { getDb } from "@/db";
import { campaigns, clicks, conversions, earnings } from "@/db/schema";

export const dynamic="force-dynamic";
const nav=[{href:"/partner",label:"대시보드"},{href:"/partner/campaigns",label:"CPA알바"},{href:"/partner/posting",label:"포스팅알바"},{href:"/partner/quick",label:"1초알바"},{href:"/partner/earnings",label:"수익"},{href:"/partner/settlements",label:"출금 신청"}];
type WorkSummary={active:number;waiting:number;revision:number};
const money=(v:unknown)=>Number(v??0).toLocaleString("ko-KR")+"원";
function kstStart(kind:"day"|"month"){const now=new Date();const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);return new Date(kind==="day"?p+"T00:00:00+09:00":p.slice(0,7)+"-01T00:00:00+09:00")}
const statusName:Record<string,string>={RECEIVED:"접수",DELIVERED:"전달",REVIEWING:"검수중",APPROVED:"승인",REJECTION_REQUESTED:"반려요청",REJECTED:"반려",DISPUTED:"이의제기",CANCELLED:"취소",TEST:"테스트"};

export default async function PartnerPage(){
 const user=await requirePartner();const db=getDb();const partnerId=user.partnerId!;const today=kstStart("day"),month=kstStart("month");const ready=await quickReady();
 const [[clickToday],[convToday],[todayEarn],[earnAll],[monthConv],[monthEarn],recent,quickRows,postingRows,[approvedToday]]=await Promise.all([
  db.select({count:sql<number>`count(*)::int`}).from(clicks).where(and(eq(clicks.partnerId,partnerId),gte(clicks.clickedAt,today))),
  db.select({db:sql<number>`count(*)::int`}).from(conversions).where(and(eq(conversions.partnerId,partnerId),gte(conversions.submittedAt,today))),
  db.select({amount:sql<number>`coalesce(sum(case when ${earnings.status}<>'CANCELLED' then ${earnings.amount} else 0 end),0)::int`}).from(earnings).where(and(eq(earnings.partnerId,partnerId),gte(earnings.createdAt,today))),
  db.select({confirmed:sql<number>`coalesce(sum(case when ${earnings.status}<>'CANCELLED' then ${earnings.amount} else 0 end),0)::int`,available:sql<number>`coalesce(sum(case when ${earnings.status}='AVAILABLE' then ${earnings.amount} else 0 end),0)::int`,hold:sql<number>`coalesce(sum(case when ${earnings.status}='HOLD' then ${earnings.amount} else 0 end),0)::int`,paid:sql<number>`coalesce(sum(case when ${earnings.status}='PAID' then ${earnings.amount} else 0 end),0)::int`}).from(earnings).where(eq(earnings.partnerId,partnerId)),
  db.select({total:sql<number>`count(*)::int`,approved:sql<number>`count(*) filter (where ${conversions.status}='APPROVED')::int`}).from(conversions).where(and(eq(conversions.partnerId,partnerId),gte(conversions.submittedAt,month))),
  db.select({amount:sql<number>`coalesce(sum(case when ${earnings.status}<>'CANCELLED' then ${earnings.amount} else 0 end),0)::int`}).from(earnings).where(and(eq(earnings.partnerId,partnerId),gte(earnings.createdAt,month))),
  db.select({id:conversions.id,status:conversions.status,amount:conversions.partnerRateSnapshot,submittedAt:conversions.submittedAt,campaignName:campaigns.name}).from(conversions).leftJoin(campaigns,eq(conversions.campaignId,campaigns.id)).where(eq(conversions.partnerId,partnerId)).orderBy(desc(conversions.submittedAt)).limit(5),
  ready?db.execute(sql`select count(*) filter (where status='APPLIED')::int as active,count(*) filter (where status='SUBMITTED')::int as waiting,count(*) filter (where status='REJECTED')::int as revision from quick_submissions where partner_id=${partnerId}::uuid`):Promise.resolve([{active:0,waiting:0,revision:0}]),
  db.execute(sql`select count(*) filter (where coalesce(s.status,a.status)='APPLIED')::int as active,count(*) filter (where coalesce(s.status,a.status)='SUBMITTED')::int as waiting,count(*) filter (where coalesce(s.status,a.status)='REVISION_REQUESTED')::int as revision from posting_applications a left join lateral (select status from posting_submissions where application_id=a.id order by submitted_at desc,id desc limit 1) s on true where a.partner_id=${partnerId}::uuid`),
  db.select({count:sql<number>`count(*)::int`}).from(conversions).where(and(eq(conversions.partnerId,partnerId),eq(conversions.status,'APPROVED'),gte(conversions.approvedAt,today)))
 ]);
 const quick=quickRows[0] as unknown as WorkSummary|undefined,posting=postingRows[0] as unknown as WorkSummary|undefined;
 const approvalRate=monthConv?.total?Math.round(((monthConv.approved??0)/monthConv.total)*100):0;
 return <DashboardShell title="파트너센터" description={`${user.partnerName??user.email}님 · ${user.partnerCode??""}`} nav={nav}>
  <div className="partner-home partner-overview">
   <section className="ph-welcome"><div><span className="ph-eyebrow">MY PICKUP PARTNER</span><h1>{user.partnerName??"파트너"}님의 활동 대시보드</h1><p>수익과 진행 중인 작업을 확인하고 다음 활동을 이어가세요.</p></div><div className="ph-welcome-actions"><Link href="/partner/quick">1초알바 찾기</Link><Link href="/partner/campaigns">CPA알바 찾기</Link><Link href="/partner/posting">포스팅알바 찾기</Link></div></section>
   <section className="pd-wallet" aria-label="수익 현황"><div className="ph-section-title"><div><span>MY EARNINGS</span><h2>내 수익과 출금</h2></div><Link href="/partner/earnings">수익 내역 →</Link></div><div className="pd-wallet-grid">
    <article className="pd-available"><span>출금 가능</span><strong>{money(earnAll?.available)}</strong><p>승인된 수익 중 지금 신청할 수 있는 금액</p><Link href="/partner/settlements#request">출금 신청하기 →</Link></article>
    <article><span>출금 처리 중</span><strong>{money(earnAll?.hold)}</strong><p>검토 또는 지급을 기다리는 신청 금액</p><Link href="/partner/settlements">신청 상태 확인 →</Link></article>
    <article><span>지급 완료</span><strong>{money(earnAll?.paid)}</strong><p>지급이 완료된 수익</p><Link href="/partner/settlements?status=PAID">지급 내역 →</Link></article>
   </div><p className="pd-caption">누적 확정 수익 {money(earnAll?.confirmed)} · 검수 중인 작업은 승인 후 수익에 반영됩니다.</p></section>
   <section className="pd-work"><div className="ph-section-title"><div><span>MY WORK</span><h2>진행 중인 작업</h2></div><small>제출·보완할 작업을 확인하세요</small></div><div className="pd-work-grid">
    {[{title:'1초알바',data:quick,href:'/partner/quick/my',hint:'반려 사유와 작업 모집 상태를 확인하고 보완하세요.'},{title:'포스팅알바',data:posting,href:'/partner/posting/my',hint:'수정 요청의 검수 의견과 제출 가능 여부를 확인하세요.'}].map(work=><article key={work.title}><h3>{work.title}</h3><dl><div><dt>제출 전</dt><dd>{work.data?.active??0}건</dd></div><div><dt>검수 대기</dt><dd>{work.data?.waiting??0}건</dd></div><div className={Number(work.data?.revision??0)>0?'pd-attention':''}><dt>{work.title==='1초알바'?'반려':'수정 요청'}</dt><dd>{work.data?.revision??0}건</dd></div></dl><p>{Number(work.data?.revision??0)>0?work.hint:Number(work.data?.active??0)>0?'완료한 작업의 결과를 제출해 주세요.':Number(work.data?.waiting??0)>0?'제출한 작업을 검수 중입니다. 내역에서 결과를 확인하세요.':'참여한 작업이 생기면 이곳에서 진행 상태를 확인할 수 있습니다.'}</p><Link href={work.href}>내 작업 확인 →</Link></article>)}
   </div>{!ready&&<p className="pd-caption">1초알바 참여 기능을 준비 중입니다.</p>}</section>
   <section className="ph-today"><div className="ph-section-title"><div><span>TODAY</span><h2>오늘의 활동</h2></div><small>한국 시간 00:00부터 현재까지</small></div><div className="ph-stat-grid">
    <article><i>↗</i><span>오늘 클릭</span><strong>{clickToday?.count??0}<small>회</small></strong><p>광고링크 유입</p></article>
    <article><i>＋</i><span>오늘 CPA 접수</span><strong>{convToday?.db??0}<small>건</small></strong><p>신규 전환 접수</p></article>
    <article><i>✓</i><span>오늘 CPA 승인</span><strong>{approvedToday?.count??0}<small>건</small></strong><p>승인 완료 성과</p></article>
    <article className="accent"><i>₩</i><span>오늘 수익</span><strong>{money(todayEarn?.amount)}</strong><p>오늘 반영된 수익</p></article>
   </div></section>
   <section className="ph-lower"><div className="ph-recent"><div className="ph-section-title"><div><span>RECENT RESULTS</span><h2>최근 전환 실적</h2></div><Link href="/partner/conversions">전체보기 →</Link></div>
    {recent.length?<div className="ph-table">{recent.map(r=><div className="ph-row" key={r.id}><div><b>{r.campaignName??"캠페인"}</b><small>{new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(r.submittedAt)}</small></div><span className={`status s-${r.status.toLowerCase()}`}>{statusName[r.status]??r.status}</span><strong>{money(r.amount)}</strong></div>)}</div>:<div className="ph-empty"><b>아직 전환 실적이 없습니다.</b><p>CPA 캠페인에 참여하고 광고링크를 생성해 첫 성과를 시작해 보세요.</p><Link href="/partner/campaigns">캠페인 둘러보기</Link></div>}
   </div><aside className="ph-side"><div className="ph-month"><span>이번 달 CPA 성과</span><div><strong>{monthConv?.total??0}</strong><small>전체 전환</small></div><div><strong>{approvalRate}%</strong><small>이번 달 접수 중 승인율</small></div><div><strong>{money(monthEarn?.amount)}</strong><small>전체 작업의 이번 달 수익</small></div></div><div className="ph-quick"><span>활동 바로가기</span><Link href="/partner/campaigns"><b>CPA 캠페인</b><small>참여할 광고 찾기</small>→</Link><Link href="/partner/links"><b>광고링크</b><small>내 추적 링크 관리</small>→</Link><Link href="/partner/quick/my"><b>내 1초알바</b><small>제출·검수 확인</small>→</Link><Link href="/partner/posting/my"><b>내 포스팅</b><small>작업 결과와 수정 요청</small>→</Link></div></aside></section>
  </div>
 </DashboardShell>
}