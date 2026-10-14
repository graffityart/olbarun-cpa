import DashboardShell from "@/components/DashboardShell";
import Link from "next/link";
import {searchAdminEvents} from "@/lib/admin-event-search";
import {requireAdmin} from "@/lib/auth/guards";
export const dynamic="force-dynamic";
type Props={searchParams:Promise<{q?:string;status?:string;page?:string;created?:string;deleted?:string}>};
export default async function Page({searchParams}:Props){
 await requireAdmin();
 const params=await searchParams;
 const q=typeof params.q==="string"?params.q.trim().slice(0,100):"";
 const status=typeof params.status==="string"&&["DRAFT","OPEN","ENDED"].includes(params.status)?params.status:"ALL";
 const requestedPage=Math.max(1,Math.min(100000,Number.parseInt(params.page??"1",10)||1));
 let result:Awaited<ReturnType<typeof searchAdminEvents>>|null=null;
 try{result=await searchAdminEvents(q,status,requestedPage);}catch(error){console.error("Event management unavailable",error);}
 const pages=Math.max(1,Math.ceil((result?.total??0)/20));
 const page=result?.currentPage??Math.min(requestedPage,pages);
 const url=(n:number)=>"/admin/events?"+new URLSearchParams({...q?{q}:{},...status!=="ALL"?{status}:{},page:String(n)}).toString();
 return <DashboardShell title="이벤트 관리" description="전체 이벤트 검색, 공개 상태 확인 및 수정" nav={[{href:"/admin/events/new",label:"+ 새 이벤트"},{href:"/customer/events",label:"이벤트 게시판"}]}>
 <section className="panel card"><h2>등록된 이벤트</h2>
 {params.created==="1"&&<p role="status">이벤트가 등록되었습니다.</p>}
 {params.deleted==="1"&&<p role="status">이벤트가 삭제되었습니다.</p>}
 <form method="get" action="/admin/events" style={{display:"flex",gap:10,flexWrap:"wrap",margin:"16px 0"}}>
 <input name="q" aria-label="이벤트 제목 검색" placeholder="이벤트 제목 검색" maxLength={100} defaultValue={q} style={{flex:"1 1 220px",padding:12,border:"1px solid #cbd5e1",borderRadius:10}}/>
 <select name="status" aria-label="이벤트 상태" defaultValue={status} style={{padding:12,border:"1px solid #cbd5e1",borderRadius:10}}><option value="ALL">전체 상태</option><option value="DRAFT">비공개</option><option value="OPEN">공개</option><option value="ENDED">종료</option></select>
 <button type="submit">검색</button><Link href="/admin/events">초기화</Link></form>
 {result===null?<p role="alert">이벤트 목록을 불러오지 못했습니다.</p>:<><p style={{fontSize:13,color:"#64748b"}}>검색 결과 {result.total.toLocaleString("ko-KR")}건 · {page}/{pages} 페이지</p>
 {result.events.length===0?<p>{"검색 조건에 맞는 이벤트가 없습니다."}</p>:<div style={{display:"grid",gap:10}}>{result.events.map(item=><div key={item.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"14px 0",borderBottom:"1px solid #e2e8f0"}}><div style={{minWidth:0}}><strong style={{overflowWrap:"anywhere"}}>{item.title}</strong><p style={{fontSize:12,color:"#64748b",margin:"5px 0 0"}}>{item.status==="DRAFT"?"비공개":item.status==="OPEN"?"공개":"종료"} · 조회 {Number(item.viewCount).toLocaleString("ko-KR")} · {new Date(item.createdAt).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})}</p></div><Link className="btn" href={"/admin/events/"+item.id+"/edit"}>수정</Link></div>)}</div>}
 {pages>1&&<nav aria-label="이벤트 관리 페이지" style={{display:"flex",justifyContent:"center",alignItems:"center",gap:14,marginTop:20}}>{page>1&&<Link href={url(page-1)}>← 이전</Link>}<span>{page} / {pages}</span>{page<pages&&<Link href={url(page+1)}>다음 →</Link>}</nav>}</>}
 </section></DashboardShell>;
}
