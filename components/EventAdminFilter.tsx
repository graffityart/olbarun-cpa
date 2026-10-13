"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
type Item={id:string;title:string;status:string;createdAt:string;viewCount:number};
export default function EventAdminFilter({events}:{events:Item[]}){
 const [query,setQuery]=useState("");
 const [status,setStatus]=useState("ALL");
 const [page,setPage]=useState(1);
 const pageSize=20;
 const filtered=useMemo(()=>events.filter(item=>(status==="ALL"||item.status===status)&&item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),[events,query,status]);
 const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
 const currentPage=Math.min(page,pages);
 const visible=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
 return <div>
 <div style={{display:"flex",gap:12,flexWrap:"wrap",margin:"16px 0"}}>
 <input aria-label="이벤트 제목 검색" placeholder="이벤트 제목 검색" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} style={{flex:"1 1 220px",padding:12,borderRadius:10,border:"1px solid #cbd5e1"}}/>
 <select aria-label="이벤트 상태 필터" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}} style={{padding:12,borderRadius:10,border:"1px solid #cbd5e1"}}>
 <option value="ALL">전체 상태</option><option value="DRAFT">비공개</option><option value="OPEN">진행중</option><option value="ENDED">종료</option>
 </select></div>
 <p style={{color:"#64748b",fontSize:13}}>검색 결과 {filtered.length}건 · {currentPage}/{pages} 페이지</p>
 {filtered.length===0?<p>검색 결과가 없습니다.</p>:<div style={{display:"grid",gap:10}}>{visible.map(item=><div key={item.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"14px 0",borderBottom:"1px solid #e2e8f0"}}>
 <div style={{minWidth:0}}><strong style={{overflowWrap:"anywhere"}}>{item.title}</strong><p style={{fontSize:12,color:"#64748b",margin:"5px 0 0"}}>{item.status==="DRAFT"?"비공개":item.status==="OPEN"?"진행중":"종료"} · 조회 {item.viewCount.toLocaleString("ko-KR")} · {new Date(item.createdAt).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})}</p></div>
 <Link className="btn" href={"/admin/events/"+item.id+"/edit"}>수정</Link>
 </div>)}</div>}
 {pages>1&&<nav aria-label="이벤트 관리 페이지" style={{display:"flex",justifyContent:"center",alignItems:"center",gap:12,marginTop:20}}><button type="button" disabled={currentPage===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>이전</button><span>{currentPage} / {pages}</span><button type="button" disabled={currentPage===pages} onClick={()=>setPage(p=>Math.min(pages,p+1))}>다음</button></nav>}
 </div>;
}
