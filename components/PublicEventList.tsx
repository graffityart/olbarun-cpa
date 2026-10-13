"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
type EventItem={id:string;title:string;status:string;createdAt:string;startsAt:string|null;endsAt:string|null;viewCount:number};
const PAGE_SIZE=10;
export default function PublicEventList({events}:{events:EventItem[]}){
 const [query,setQuery]=useState("");
 const [page,setPage]=useState(1);
 const filtered=useMemo(()=>events.filter(e=>e.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),[events,query]);
 const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
 const current=Math.min(page,pages);
 return <div><div style={{display:"flex",gap:8,margin:"16px 0",flexWrap:"wrap"}}><input aria-label="이벤트 제목 검색" placeholder="이벤트 제목 검색" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} style={{flex:"1 1 220px",padding:12,border:"1px solid #cbd5e1",borderRadius:10}}/><button type="button" onClick={()=>{setQuery("");setPage(1);}} disabled={!query}>초기화</button></div>
 <p style={{fontSize:13,color:"#64748b"}}>검색 결과 {filtered.length}건</p>
 {filtered.length===0?<div className="cs-empty">검색 결과가 없습니다.</div>:<div className="cs-notices">{filtered.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE).map(e=><div key={e.id} style={{padding:"18px 12px",borderBottom:"1px solid #e2e8f0"}}><Link href={"/customer/events/"+e.id} style={{display:"block",textDecoration:"none",color:"inherit"}}><strong>[{e.status}] {e.title}</strong><small style={{display:"block",marginTop:8,color:"#8190a4"}}>{new Date(e.createdAt).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})} · 조회 {e.viewCount.toLocaleString("ko-KR")}</small>{(e.startsAt||e.endsAt)&&<small style={{display:"block",marginTop:6,color:"#64748b"}}>기간: {e.startsAt?new Date(e.startsAt).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"}):"미정"} ~ {e.endsAt?new Date(e.endsAt).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"}):"미정"}</small>}</Link></div>)}</div>}
 {pages>1&&<nav aria-label="이벤트 페이지" style={{display:"flex",gap:12,justifyContent:"center",alignItems:"center",marginTop:22}}><button type="button" disabled={current<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>이전</button><span>{current} / {pages}</span><button type="button" disabled={current>=pages} onClick={()=>setPage(p=>Math.min(pages,p+1))}>다음</button></nav>}
 </div>;
}
