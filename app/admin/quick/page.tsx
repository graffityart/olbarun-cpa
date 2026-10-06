import Link from 'next/link';
import DashboardShell from '@/components/DashboardShell';
import QuickHistory from '@/components/QuickHistory';
import {QuickJobEditor} from '@/components/QuickActions';
import {requireAdmin} from '@/lib/auth/guards';
import {quickReady,listJobs,listSubmissions,adminNav,labels} from '@/lib/quick';
import '../../partner/quick/quick.css';
export const dynamic='force-dynamic';
type Query=Record<string,string|string[]|undefined>;
const value=(v:string|string[]|undefined)=>typeof v==='string'?v:'';
const jobStates=[['ALL','전체'],['OPEN','모집중'],['DRAFT','작성중'],['CLOSED','마감']];
const reviewStates=[['ALL','전체'],['SUBMITTED','검수 대기'],['APPLIED','참여중'],['APPROVED','승인'],['REJECTED','반려']];
export default async function Page({searchParams}:{searchParams:Promise<Query>}){
 await requireAdmin();
 const params=await searchParams;
 const q=value(params.q).trim().slice(0,200);
 const status=jobStates.some(([s])=>s===value(params.status))?value(params.status):'ALL';
 const review=reviewStates.some(([s])=>s===value(params.review))?value(params.review):'ALL';
 const ready=await quickReady();
 const [jobs,submissions]=ready?await Promise.all([listJobs(true),listSubmissions()]):[[],[]];
 const visibleJobs=jobs.filter(j=>(status==='ALL'||j.status===status)&&(!q||(j.title+' '+j.category).toLowerCase().includes(q.toLowerCase())));
 const visibleSubmissions=submissions.filter(s=>review==='ALL'||s.status===review);
 const count=(s:string)=>jobs.filter(j=>j.status===s).length;
 const waiting=submissions.filter(s=>s.status==='SUBMITTED').length;
 function filterLink(key:'status'|'review',next:string,clearSearch=false){const query=new URLSearchParams();if(q&&!clearSearch)query.set('q',q);query.set('status',key==='status'?next:status);query.set('review',key==='review'?next:review);return '/admin/quick?'+query.toString()+(key==='review'?'#review':'#jobs');}
 return <DashboardShell title="1초알바 관리" description="모집 현황을 확인하고 제출된 작업을 검수하세요." nav={adminNav}><main className="quick-market qj-admin">
  <header className="qja-heading"><div><span>QUICK JOB OPERATIONS</span><h1>작업 관리</h1><p>작업을 준비하고, 모집하고, 제출된 증빙을 확인하세요.</p></div><a className="qja-primary" href="#create">＋ 새 작업 등록</a></header>
  <section className="qja-stats" aria-label="운영 현황"><a href={filterLink('status','OPEN')}><span>모집중 작업</span><strong>{count('OPEN')}<small>개</small></strong></a><a href={filterLink('status','DRAFT')}><span>작성중 작업</span><strong>{count('DRAFT')}<small>개</small></strong></a><a href={filterLink('status','CLOSED')}><span>마감 작업</span><strong>{count('CLOSED')}<small>개</small></strong></a><a className="qja-waiting" href={filterLink('review','SUBMITTED')}><span>검수 대기</span><strong>{waiting}<small>건</small></strong></a></section>
  {!ready&&<div className="qjd-warn"><b>운영 DB 준비가 필요합니다.</b><p>1초알바 테이블 준비 후 등록·제출·검수가 활성화됩니다.</p></div>}
  <details id="create" className="qja-create"><summary><span><b>새 작업 등록</b><small>참여 조건·보상·모집 수량을 입력합니다.</small></span><span className="qja-expand" aria-hidden="true">＋</span></summary><div className="qja-form"><div className="qja-tip">작성중으로 저장하면 일반 목록에 표시되지 않습니다. 실제 링크와 인정 조건을 확인한 뒤 모집중으로 전환하세요.</div><QuickJobEditor disabled={!ready}/></div></details>
  <section id="jobs" className="qja-panel"><div className="qja-section-heading"><div><h2>등록 작업</h2><p>작업을 펼쳐 내용을 수정하세요.</p></div><span>{visibleJobs.length} / {jobs.length}개</span></div><form className="qja-search" action="/admin/quick" method="get"><input aria-label="작업명 또는 유형 검색" name="q" defaultValue={q} placeholder="작업명 또는 유형 검색" maxLength={200}/><input type="hidden" name="status" value={status}/><input type="hidden" name="review" value={review}/><button type="submit">검색</button>{q&&<Link href={filterLink('status',status,true)}>초기화</Link>}</form><nav className="qja-filters" aria-label="작업 상태 필터">{jobStates.map(([s,label])=><Link href={filterLink('status',s)} key={s} aria-current={status===s?'page':undefined} className={status===s?'active':''}>{label}<span>{s==='ALL'?jobs.length:count(s)}</span></Link>)}</nav><div className="qja-job-list">{visibleJobs.map(j=><details key={j.id} className="qja-job"><summary><div className="qja-job-name"><span className={'qja-badge '+j.status.toLowerCase()}>{labels[j.status]}</span><b>{j.title}</b><small>{j.category}</small></div><div className="qja-job-numbers"><span>건당 보상<b>{j.reward.toLocaleString('ko-KR')}원</b></span><span>{j.status==='CLOSED'?'모집 수량':'잔여 / 모집'}<b>{j.status==='CLOSED'?j.capacity.toLocaleString('ko-KR')+'건':j.remaining.toLocaleString('ko-KR')+' / '+j.capacity.toLocaleString('ko-KR')}</b></span><i aria-hidden="true">⌄</i></div></summary><div className="qja-form">{j.status==='DRAFT'?<p className="qja-tip">작성중 작업은 일반 목록과 상세 페이지에 공개되지 않습니다.</p>:<Link className="qja-preview" href={'/partner/quick/'+j.id}>상세 화면 보기 ↗</Link>}<QuickJobEditor job={j}/></div></details>)}{!visibleJobs.length&&<div className="qj-empty"><b>{jobs.length?'조건에 맞는 작업이 없습니다.':'첫 작업을 등록해 주세요.'}</b><p>{jobs.length?'검색어나 상태 필터를 변경해 주세요.':'작성중으로 저장해 내용을 먼저 준비할 수 있습니다.'}</p></div>}</div></section>
  <section id="review" className="qja-panel"><div className="qja-section-heading"><div><h2>참여 · 제출 검수</h2><p>최근 200건을 기준으로 표시합니다. 승인하면 확정 보상이 수익에 반영됩니다.</p></div><span>{visibleSubmissions.length}건</span></div><nav className="qja-filters" aria-label="제출 상태 필터">{reviewStates.map(([s,label])=><Link key={s} href={filterLink('review',s)} aria-current={review===s?'page':undefined} className={review===s?'active':''}>{label}<span>{s==='ALL'?submissions.length:submissions.filter(x=>x.status===s).length}</span></Link>)}</nav><QuickHistory items={visibleSubmissions} admin/></section>
 </main></DashboardShell>;
}
