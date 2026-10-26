import DashboardShell from "@/components/DashboardShell";
import Link from "next/link";
import { and, asc, count, desc, eq, ilike, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, partners, postingApplications, postingCampaigns, postingSubmissions } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";

export const dynamic="force-dynamic";
const nav=[{href:"/admin",label:"대시보드"},{href:"/admin/partners",label:"파트너 관리"},{href:"/admin/advertisers",label:"광고주 관리"},{href:"/admin/campaigns",label:"캠페인 관리"},{href:"/admin/conversions",label:"전환 DB"},{href:"/admin/posting",label:"포스팅 작업"},{href:"/admin/ledger",label:"광고비·수익"},{href:"/admin/settlements",label:"정산"}];
const labels:Record<string,string>={SUBMITTED:"검수대기",REVISION_REQUESTED:"수정요청",APPROVED:"승인완료",REJECTED:"거절"};
const filters=[{value:"ALL",label:"전체"},{value:"SUBMITTED",label:"검수대기"},{value:"REVISION_REQUESTED",label:"수정요청"},{value:"APPROVED",label:"승인완료"},{value:"REJECTED",label:"거절"}];
const pageSize=30;
export default async function PostingAdminPage({searchParams}:{searchParams:Promise<{status?:string;q?:string;page?:string;delay?:string}>}) {
  await requireAdmin();
  const p=await searchParams;
  const status=filters.some(f=>f.value===p.status)?p.status??"ALL":"ALL";
  const q=(p.q??"").trim().slice(0,100);
  const delay=p.delay==="6"||p.delay==="24"?p.delay:"ALL";
  const delayHours=delay==="ALL"?0:Number(delay);
  const effectiveStatus=delayHours?"SUBMITTED":status;
  const now=Date.now();
  const delayCutoff=delayHours?new Date(now-delayHours*3600000):null;
  const db=getDb();
  const base=()=>db.select({
    id:postingSubmissions.id,title:postingSubmissions.title,postUrl:postingSubmissions.postUrl,
    status:postingSubmissions.status,revisionCount:postingSubmissions.revisionCount,
    submittedAt:postingSubmissions.submittedAt,campaignName:campaigns.name,
    partnerName:partners.name,partnerCode:partners.partnerCode,
  }).from(postingSubmissions)
    .innerJoin(postingApplications,eq(postingSubmissions.applicationId,postingApplications.id))
    .innerJoin(postingCampaigns,eq(postingApplications.postingCampaignId,postingCampaigns.id))
    .innerJoin(campaigns,eq(postingCampaigns.campaignId,campaigns.id))
    .innerJoin(partners,eq(postingApplications.partnerId,partners.id));
  const escaped=q.replace(/[\\%_]/g,"\\$&");
  const search=escaped?or(ilike(campaigns.name,`%${escaped}%`),ilike(partners.name,`%${escaped}%`),ilike(partners.partnerCode,`%${escaped}%`),ilike(postingSubmissions.title,`%${escaped}%`)):undefined;
  const condition=and(effectiveStatus==="ALL"?undefined:eq(postingSubmissions.status,effectiveStatus),delayCutoff?and(eq(postingSubmissions.status,"SUBMITTED"),lte(postingSubmissions.submittedAt,delayCutoff)):undefined,search);
  const [statusRows,matchedRows,delayedRows]=await Promise.all([
    db.select({status:postingSubmissions.status,total:count()}).from(postingSubmissions).groupBy(postingSubmissions.status),
    db.select({total:count()}).from(postingSubmissions)
      .innerJoin(postingApplications,eq(postingSubmissions.applicationId,postingApplications.id))
      .innerJoin(postingCampaigns,eq(postingApplications.postingCampaignId,postingCampaigns.id))
      .innerJoin(campaigns,eq(postingCampaigns.campaignId,campaigns.id))
      .innerJoin(partners,eq(postingApplications.partnerId,partners.id))
      .where(condition),
    db.select({overSix:sql<number>`count(*) filter (where ${postingSubmissions.submittedAt} <= ${new Date(now-6*3600000)})`,overDay:sql<number>`count(*) filter (where ${postingSubmissions.submittedAt} <= ${new Date(now-24*3600000)})`}).from(postingSubmissions).where(eq(postingSubmissions.status,"SUBMITTED")),
  ]);
  const counts=Object.fromEntries(statusRows.map(r=>[r.status,Number(r.total)])) as Record<string,number>;
  const delayed=delayedRows[0];
  const all=statusRows.reduce((sum,r)=>sum+Number(r.total),0);
  const matched=Number(matchedRows[0]?.total??0);
  const totalPages=Math.max(1,Math.ceil(matched/pageSize));
  const requestedPage=Number(p.page);
  const page=Number.isSafeInteger(requestedPage)&&requestedPage>0?Math.min(requestedPage,totalPages):1;
  const waitingLabel=(submittedAt:Date)=>{const minutes=Math.max(0,Math.floor((now-submittedAt.getTime())/60000));if(minutes<60)return `${minutes}분 대기`;const hours=Math.floor(minutes/60);if(hours<24)return `${hours}시간 대기`;return `${Math.floor(hours/24)}일 ${hours%24}시간 대기`;};
  const rows=await base().where(condition)
    .orderBy(asc(sql`case when ${postingSubmissions.status}='SUBMITTED' then 0 when ${postingSubmissions.status}='REVISION_REQUESTED' then 1 else 2 end`),asc(sql`case when ${postingSubmissions.status}='SUBMITTED' then ${postingSubmissions.submittedAt} else null end`),desc(postingSubmissions.submittedAt),desc(postingSubmissions.id))
    .limit(pageSize).offset((page-1)*pageSize);
  const pageHref=(n:number)=>`/admin/posting?status=${effectiveStatus}${q?`&q=${encodeURIComponent(q)}`:""}${delay!=="ALL"?`&delay=${delay}`:""}&page=${n}`;
  return <DashboardShell title="포스팅 작업관리" description="검수대기 중 오래 기다린 제출 건부터 우선 확인하고 수정요청·승인·거절을 관리합니다." nav={nav}><section className="stats"><div className="panel stat"><span>전체 제출</span><strong>{all}</strong></div><div className="panel stat"><span>검수대기</span><strong>{counts.SUBMITTED??0}</strong></div><div className="panel stat"><span>수정요청</span><strong>{counts.REVISION_REQUESTED??0}</strong></div><div className="panel stat"><span>승인완료</span><strong>{counts.APPROVED??0}</strong></div></section><section className="panel card"><form method="get" className="page-toolbar"><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{filters.map(f=><Link key={f.value} aria-current={effectiveStatus===f.value?"page":undefined} className={`btn ${effectiveStatus===f.value?"primary":""}`} href={`/admin/posting?status=${f.value}${q?`&q=${encodeURIComponent(q)}`:""}`}>{f.label} ({f.value==="ALL"?all:counts[f.value]??0})</Link>)}</div><div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}><label style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>대기 시간<select name="delay" defaultValue={delay} aria-label="검수 대기 시간 필터"><option value="ALL">전체 시간</option><option value="6">6시간 이상 ({Number(delayed?.overSix??0)}건)</option><option value="24">24시간 이상 ({Number(delayed?.overDay??0)}건)</option></select></label><input name="q" type="search" maxLength={100} style={{minWidth:0,flex:"1 1 180px"}} aria-label="포스팅 검색" defaultValue={p.q??""} placeholder="캠페인·파트너·제목 검색"/><input type="hidden" name="status" value={effectiveStatus}/><button className="btn" type="submit">검색</button><Link className="btn" href="/admin/posting">초기화</Link></div></form><p className="muted" role="status" aria-live="polite">전체 {all}건 중 검색결과 {matched}건 · 현재 {rows.length}건 표시 · 검수대기 {counts.SUBMITTED??0}건 · {delay==="ALL"?"검수대기는 오래된 제출순":`${delay}시간 이상 미검수 건만 표시`}</p><div className="table-wrap"><table><thead><tr><th>캠페인</th><th>파트너</th><th>제목</th><th>제출일</th><th>대기 시간</th><th>상태</th><th>관리</th></tr></thead><tbody>{rows.length?rows.map(row=><tr key={row.id}><td data-label="캠페인"><strong>{row.campaignName}</strong></td><td data-label="파트너">{row.partnerName}<br/><span className="muted">{row.partnerCode}</span></td><td data-label="제목"><a href={row.postUrl} target="_blank" rel="noopener noreferrer">{row.title||"게시물 보기"}</a></td><td data-label="제출일">{row.submittedAt.toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</td><td data-label="대기 시간">{row.status==="SUBMITTED"?<span style={{fontWeight:700,color:now-row.submittedAt.getTime()>=24*60*60*1000?"#b91c1c":now-row.submittedAt.getTime()>=6*60*60*1000?"#b45309":"inherit"}}>{waitingLabel(row.submittedAt)}{now-row.submittedAt.getTime()>=24*60*60*1000?" · 24시간 초과":now-row.submittedAt.getTime()>=6*60*60*1000?" · 확인 필요":""}</span>:<span className="muted">처리됨</span>}</td><td data-label="상태"><span className="badge">{labels[row.status]??row.status}</span>{row.revisionCount>0?<div className="muted">수정 {row.revisionCount}회</div>:null}</td><td data-label="관리"><Link className={`btn ${row.status==="SUBMITTED"?"primary":""}`} href={`/admin/posting/${row.id}`}>{row.status==="SUBMITTED"?"검수하기":"상세보기"}</Link></td></tr>):<tr><td colSpan={7} className="empty-cell">조건에 맞는 포스팅 작업이 없습니다.</td></tr>}</tbody></table></div>{totalPages>1&&<nav aria-label="포스팅 목록 페이지" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,flexWrap:"wrap",marginTop:16}}>{page>1&&<Link className="btn" href={pageHref(page-1)}>이전</Link>}<span className="muted">{page} / {totalPages} 페이지</span>{page<totalPages&&<Link className="btn" href={pageHref(page+1)}>다음</Link>}</nav>}</section></DashboardShell>}
