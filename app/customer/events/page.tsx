import type {Metadata} from "next";
import Link from "next/link";
import CustomerBoardNav from "@/components/CustomerBoardNav";
import {searchPublicEvents} from "@/lib/customer-events";
import {getCurrentUser} from "@/lib/auth/session";
import {eventDisplayStatus} from "@/lib/event-display-status";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"이벤트 | 마이픽업",description:"마이픽업 공식 이벤트와 당첨자 안내",alternates:{canonical:"/customer/events"}};
type Props={searchParams:Promise<{q?:string;page?:string}>};
export default async function Page({searchParams}:Props){
 const params=await searchParams;
 const q=typeof params.q==="string"?params.q.trim().slice(0,100):"";
 const page=Math.max(1,Math.min(100000,Number.parseInt(params.page??"1",10)||1));
 const [result,user]=await Promise.all([searchPublicEvents(q,page),getCurrentUser()]);
 const admin=!!user&&user.status==="ACTIVE"&&["ADMIN","SUPER_ADMIN"].includes(user.role);
 const total=result?.total??0;
 const pages=Math.max(1,Math.ceil(total/10));
 const link=(p:number)=>"/customer/events?"+new URLSearchParams({...q?{q}:{},page:String(p)}).toString();
 return <main className="customer-page"><section className="customer-head"><div className="container"><span>MY PICKUP EVENTS</span><h1>이벤트</h1><p>마이픽업의 새로운 이벤트와 혜택을 확인하세요.</p></div></section><CustomerBoardNav current="/customer/events"/><section className="customer-content container"><div className="customer-title-row"><div><h2>이벤트 소식</h2><p>진행 중인 이벤트와 당첨자 발표를 안내합니다.</p></div>{admin&&<Link className="board-write" href="/admin/events/new">이벤트 등록</Link>}</div>
 <form method="get" action="/customer/events" className="cs-search"><input name="q" aria-label="이벤트 제목 검색" maxLength={100} defaultValue={q} placeholder="이벤트 제목을 검색하세요"/><button type="submit">검색</button>{q&&<Link href="/customer/events">초기화</Link>}</form>
 {result===null?<div className="cs-empty">이벤트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>:<><p className="cs-count">이벤트 {total.toLocaleString("ko-KR")}건</p>{result.events.length===0?<div className="cs-empty">{q?"검색 결과가 없습니다.":"현재 공개된 이벤트가 없습니다."}</div>:<div className="cs-notices">{result.events.map(e=><div key={e.id} style={{padding:"18px 12px",borderBottom:"1px solid #e2e8f0"}}><Link href={"/customer/events/"+e.id} style={{display:"block",color:"inherit",textDecoration:"none"}}><strong>[{eventDisplayStatus(e)}] {e.title}</strong><small style={{display:"block",marginTop:8,color:"#8190a4"}}>{new Date(e.createdAt).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})} · 조회 {Number(e.viewCount).toLocaleString("ko-KR")}</small>{(e.startsAt||e.endsAt)&&<small style={{display:"block",marginTop:6,color:"#64748b"}}>기간: {e.startsAt?new Date(e.startsAt).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"}):"미정"} ~ {e.endsAt?new Date(e.endsAt).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"}):"미정"}</small>}</Link></div>)}</div>}{pages>1&&<nav aria-label="이벤트 페이지" style={{display:"flex",gap:12,alignItems:"center",justifyContent:"center",margin:"24px 0"}}>{page>1&&<Link href={link(page-1)}>← 이전</Link>}<span>{Math.min(page,pages)} / {pages}</span>{page<pages&&<Link href={link(page+1)}>다음 →</Link>}</nav>}</>}
 <p><Link href="/customer">← 고객센터로 돌아가기</Link></p></section></main>;
}
