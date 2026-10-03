import DashboardShell from "@/components/DashboardShell";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/auth/guards";
import { campaignRates, campaigns } from "@/db/schema";
import "./cpa-market.css";

export const dynamic = "force-dynamic";
const nav = [{ href: "/partner", label: "대시보드" }, { href: "/partner/campaigns", label: "CPA 캠페인" }, { href: "/partner/posting", label: "포스팅 광고" }, { href: "/partner/links", label: "광고링크" }];
const categories=["전체","이사/청소","인터넷/통신","렌탈","교육","금융","자동차","생활서비스","기타"];
const fallback=[
 {id:"demo-move",name:"포장이사 무료견적 상담",category:"이사/청소",description:"이사 예정 고객의 무료 비교견적 상담 신청 캠페인",status:"ACTIVE",partnerRate:24000,duplicateDays:30,reviewDays:7},
 {id:"demo-clean",name:"입주·이사청소 견적 신청",category:"이사/청소",description:"입주청소 및 이사청소 상담을 원하는 고객 모집",status:"ACTIVE",partnerRate:18000,duplicateDays:30,reviewDays:5},
 {id:"demo-internet",name:"인터넷 신규가입 상담",category:"인터넷/통신",description:"인터넷·TV 신규가입 및 통신상품 비교 상담",status:"ACTIVE",partnerRate:32000,duplicateDays:45,reviewDays:7},
 {id:"demo-rental",name:"생활가전 렌탈 상담",category:"렌탈",description:"정수기·공기청정기 등 렌탈 상담 신청 캠페인",status:"ACTIVE",partnerRate:21000,duplicateDays:30,reviewDays:7},
 {id:"demo-edu",name:"온라인 교육 무료상담",category:"교육",description:"자격증 및 온라인 교육과정 상담 신청",status:"ACTIVE",partnerRate:14500,duplicateDays:30,reviewDays:5},
 {id:"demo-car",name:"신차 장기렌트 비교견적",category:"자동차",description:"신차 장기렌트·리스 비교견적을 원하는 고객 모집",status:"ACTIVE",partnerRate:28000,duplicateDays:60,reviewDays:7},
 {id:"demo-office",name:"사무실 이전 상담",category:"이사/청소",description:"기업·사업장 사무실 이전 견적 상담 캠페인",status:"ACTIVE",partnerRate:26000,duplicateDays:30,reviewDays:7},
 {id:"demo-home",name:"홈케어 서비스 상담",category:"생활서비스",description:"에어컨·세탁기 등 생활가전 홈케어 상담",status:"ACTIVE",partnerRate:12500,duplicateDays:30,reviewDays:5},
];
function tone(i:number){return ["blue","violet","mint","orange","rose","navy"][i%6]}
export default async function PartnerCampaignsPage(){
 await requirePartner();
 let dbRows:any[]=[]; try{dbRows=await getDb().select({ id: campaigns.id, name: campaigns.name, category: campaigns.category, description: campaigns.description, status: campaigns.status, partnerRate: campaignRates.partnerBaseRate, duplicateDays: campaigns.duplicateDays, reviewDays: campaigns.reviewDays }).from(campaigns).leftJoin(campaignRates, eq(campaignRates.campaignId, campaigns.id)).where(eq(campaigns.type, "CPA")).orderBy(desc(campaigns.createdAt));}catch{}
 const rows=dbRows.length?dbRows:fallback;
 return <DashboardShell title="CPA알바" description="승인형 CPA 캠페인을 골라 나만의 광고링크로 수익을 시작하세요." nav={nav}>
  <div className="cpa-market">
   <section className="cpa-hero">
    <div><span className="cpa-kicker">MY PICKUP · CPA JOB</span><h2>원하는 캠페인을 골라<br/><em>성과만큼 수익을 쌓아보세요</em></h2><p>캠페인별 승인 조건과 수익을 한눈에 비교하고, 참여 후 전용 링크를 생성할 수 있습니다.</p><div className="hero-pills"><span>✓ 무료 참여</span><span>✓ 성과형 수익</span><span>✓ 투명한 정산</span></div></div>
    <div className="hero-stat"><small>현재 참여 가능</small><strong>{rows.filter(r=>r.status==="ACTIVE").length}</strong><span>CPA 캠페인</span><div className="hero-bars"><i/><i/><i/><i/><i/></div></div>
   </section>
   <section className="market-tools"><div className="searchbox"><span>⌕</span><input placeholder="캠페인명 또는 카테고리를 검색해보세요" /></div><div className="sort-tabs"><button className="active">전체</button><button>추천순</button><button>수익 높은순</button><button>신규순</button></div></section>
   <section className="category-panel"><div className="category-title"><b>카테고리</b><span>관심 분야를 빠르게 찾아보세요</span></div><div className="category-chips">{categories.map((x,i)=><button key={x} className={i===0?"active":""}>{x}</button>)}</div></section>
   <div className="market-heading"><div><span className="eyebrow">AVAILABLE CAMPAIGNS</span><h2>지금 참여 가능한 CPA 캠페인</h2><p>실제 등록 캠페인은 관리자·광고주 설정과 자동 연동됩니다.</p></div><span className="count"><b>{rows.length}</b>개의 캠페인</span></div>
   <section className="cpa-card-grid">{rows.map((row,i)=>{const demo=String(row.id).startsWith("demo-"); return <a key={row.id} className="cpa-card" href={demo?"#":`/partner/campaigns/${row.id}`}>
    <div className={`card-visual ${tone(i)}`}><span className="card-category">{row.category??"CPA"}</span><div className="visual-mark"><b>{["₩","↗","✓","◎","＋","★"][i%6]}</b></div><div className="visual-copy"><small>MY PICKUP CPA</small><strong>{row.name}</strong></div><span className="live-dot">● 모집중</span></div>
    <div className="card-body"><div className="card-title"><h3>{row.name}</h3><span>›</span></div><p>{row.description??"상세 조건을 확인하세요."}</p><div className="card-rate"><span>승인 수익</span><strong>{(row.partnerRate??0).toLocaleString("ko-KR")}원</strong></div><div className="card-meta"><span><small>중복기간</small><b>{row.duplicateDays}일</b></span><span><small>검수기간</small><b>{row.reviewDays}일</b></span><span><small>상태</small><b className="status-active">{row.status==="ACTIVE"?"진행중":row.status}</b></span></div><div className="card-cta">{demo?"샘플 캠페인":"상세보기 · 참여하기"} <b>→</b></div></div>
   </a>})}</section>
   <section className="cpa-guide"><div><span>처음이신가요?</span><h3>CPA알바는 이렇게 시작합니다</h3></div><ol><li><b>01</b><span><strong>캠페인 선택</strong>조건과 승인 수익 확인</span></li><li><b>02</b><span><strong>전용 링크 생성</strong>나만의 추적 링크 발급</span></li><li><b>03</b><span><strong>성과 발생</strong>상담·신청 DB 접수</span></li><li><b>04</b><span><strong>승인·정산</strong>검수 후 수익 반영</span></li></ol></section>
  </div>
 </DashboardShell>
}