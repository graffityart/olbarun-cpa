"use client";
import { useEffect, useState } from "react";

export default function CpaMarketControls({categories}:{categories:string[]}){
 const [query,setQuery]=useState(""); const [category,setCategory]=useState("전체"); const [sort,setSort]=useState("all");
 useEffect(()=>{
  const grid=document.getElementById("campaign-grid"); if(!grid)return;
  const cards=Array.from(grid.querySelectorAll<HTMLElement>("[data-campaign-card]"));
  cards.forEach(card=>{const name=(card.dataset.name||"").toLowerCase();const cat=card.dataset.category||"";card.style.display=(!query||name.includes(query.toLowerCase()))&&(category==="전체"||cat.includes(category.split("/")[0]))?"":"none"});
  const visible=cards.filter(x=>x.style.display!=="none");
  if(sort==="rate") visible.sort((a,b)=>Number(b.dataset.rate)-Number(a.dataset.rate));
  if(sort==="new") visible.reverse();
  visible.forEach(x=>grid.appendChild(x));
 },[query,category,sort]);
 return <><section className="market-tools"><div className="searchbox"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="캠페인명 또는 카테고리를 검색해보세요" /></div><div className="sort-tabs"><button onClick={()=>setSort("all")} className={sort==="all"?"active":""}>전체</button><button onClick={()=>setSort("rate")} className={sort==="rate"?"active":""}>수익 높은순</button><button onClick={()=>setSort("new")} className={sort==="new"?"active":""}>신규순</button></div></section><section className="category-panel"><div className="category-title"><b>카테고리</b><span>관심 분야를 빠르게 찾아보세요</span></div><div className="category-chips">{categories.map(x=><button key={x} onClick={()=>setCategory(x)} className={category===x?"active":""}>{x}</button>)}</div></section></>
}