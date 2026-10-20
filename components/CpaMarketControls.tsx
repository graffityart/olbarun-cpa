"use client";
import Link from "next/link";
import {useMemo,useState} from "react";
export type CpaItem={id:string;name:string;category:string|null;description:string|null;partnerRate:number|null;duplicateDays:number;reviewDays:number;open:boolean;state:string};
type SortMode="추천순"|"최신순"|"수익순";
export default function CpaMarketControls({items}:{items:CpaItem[]}){
 const [q,setQ]=useState("");
 const [category,setCategory]=useState("전체");
 const [sort,setSort]=useState<SortMode>("추천순");
 const [onlyOpen,setOnlyOpen]=useState(false);
 const categories=useMemo(()=>["전체",...new Set(items.map(x=>x.category||"기타"))], [items]);
 const rows=useMemo(()=>items.filter(x=>(!onlyOpen||x.open)&&(category==="전체"||(x.category||"기타")===category)&&[x.name,x.category,x.description].join(" ").toLocaleLowerCase("ko-KR").includes(q.trim().toLocaleLowerCase("ko-KR"))).sort((a,b)=>sort==="수익순"?(b.partnerRate??-1)-(a.partnerRate??-1)||Number(b.open)-Number(a.open):sort==="추천순"?Number(b.open)-Number(a.open):0),[items,q,category,sort,onlyOpen]);
 const reset=()=>{setQ("");setCategory("전체");setSort("추천순");setOnlyOpen(false)};
 return <><div className="cx-tools"><input aria-label="CPA 캠페인 검색" placeholder="캠페인명·카테고리·내용 검색" value={q} onChange={e=>setQ(e.target.value)}/><select aria-label="CPA 캠페인 정렬" value={sort} onChange={e=>setSort(e.target.value as SortMode)}><option>추천순</option><option>최신순</option><option>수익순</option></select></div>
 <nav className="cx-filters" aria-label="CPA 카테고리">{categories.map(x=><button type="button" key={x} aria-pressed={category===x} onClick={()=>setCategory(x)}>{x}</button>)}</nav>
 <div className="cx-heading"><h2>CPA 캠페인</h2><span aria-live="polite">{rows.length}개</span></div>
 <label style={{display:"inline-flex",alignItems:"center",gap:8,marginBottom:16}}><input type="checkbox" checked={onlyOpen} onChange={e=>setOnlyOpen(e.target.checked)}/>현재 모집 중만 보기</label>
 <section className="cx-grid">{rows.map(x=><article className="cx-card" key={x.id}><div className="cx-heading"><span>{x.category||"기타"}</span><b className={"cx-state "+(x.open?"open":"")}>{x.state}</b></div><h3><Link href={"/partner/campaigns/"+encodeURIComponent(x.id)}>{x.name}</Link></h3><p>{x.description||"상세 승인 조건을 확인해 주세요."}</p><div className="cx-rate"><span>승인 1건당 수익</span><strong>{x.partnerRate==null?"단가 확인 중":x.partnerRate.toLocaleString("ko-KR")+"원"}</strong></div><dl><div><dt>중복 확인 기간</dt><dd>{x.duplicateDays}일</dd></div><div><dt>검수 안내기간</dt><dd>{x.reviewDays}일</dd></div></dl><Link className="cx-button" href={"/partner/campaigns/"+encodeURIComponent(x.id)}>{x.open?"조건 확인 · 광고링크 →":"캠페인 조건 확인 →"}</Link></article>)}</section>
 {!rows.length&&<div className="cx-notice"><p>{items.length?"검색 조건에 맞는 캠페인이 없습니다.":"현재 공개된 CPA 캠페인이 없습니다."}</p>{items.length>0&&<button type="button" onClick={reset}>검색 조건 초기화</button>}</div>}</>;
}