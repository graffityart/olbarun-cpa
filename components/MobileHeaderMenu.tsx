"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function MobileHeaderMenu({loggedIn=false,accountHref="/login"}:{loggedIn?:boolean;accountHref?:string}){
 const [open,setOpen]=useState(false);
 const triggerRef=useRef<HTMLButtonElement>(null),panelRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const desktop=window.matchMedia("(min-width:761px)");
  const resize=()=>{if(desktop.matches)setOpen(false)};
  desktop.addEventListener("change",resize);
  return()=>desktop.removeEventListener("change",resize);
 },[]);
 useEffect(()=>{
  if(!open)return;
  document.body.classList.add("mp-menu-open");
  const panel=panelRef.current;
  panel?.querySelector<HTMLButtonElement>("button")?.focus();
  const keydown=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.preventDefault();setOpen(false);return}
   if(event.key!=="Tab")return;
   const items=panel?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])');
   if(!items?.length)return;
   const first=items[0],last=items[items.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  };
  document.addEventListener("keydown",keydown);
  return()=>{document.body.classList.remove("mp-menu-open");document.removeEventListener("keydown",keydown);triggerRef.current?.focus()};
 },[open]);
 const close=()=>setOpen(false);
 return <><button ref={triggerRef} className="mp-menu" type="button" aria-label="전체 메뉴" aria-expanded={open} aria-controls="mp-mobile-menu" onClick={()=>setOpen(v=>!v)}>{open?"×":"☰"}</button>
 <div id="mp-mobile-menu" className={"mp-mobile-menu "+(open?"is-open":"")} aria-hidden={!open}>
  <button tabIndex={-1} className="mp-mobile-backdrop" aria-label="메뉴 닫기" onClick={close}/>
  <div ref={panelRef} className="mp-mobile-panel" role="dialog" aria-modal="true" aria-labelledby="mp-mobile-title">
   <div className="mp-mobile-head"><b id="mp-mobile-title">전체 메뉴</b><button type="button" aria-label="전체 메뉴 닫기" onClick={close}>×</button></div>
   <nav>
    <Link onClick={close} href="/partner/campaigns"><span>CPA알바</span><i>→</i></Link>
    <Link onClick={close} href="/partner/posting"><span>포스팅알바</span><i>→</i></Link>
    <Link onClick={close} href="/partner/quick"><span>1초알바</span><i>→</i></Link>
    <Link onClick={close} href="/about"><span>이용가이드</span><i>→</i></Link>

    <Link onClick={close} href="/customer"><span>고객센터</span><i>→</i></Link>
    {loggedIn&&accountHref==="/partner"&&<Link onClick={close} className="mp-mobile-withdraw" href="/partner/settlements"><span>출금신청</span><i>→</i></Link>}
   </nav>
   <div className="mp-mobile-account"><Link onClick={close} href={accountHref}>{loggedIn?"마이페이지":"로그인"}</Link>{!loggedIn&&<Link onClick={close} className="primary" href="/partner/signup">회원가입</Link>}{loggedIn&&<form action="/api/auth/logout" method="post"><button type="submit">로그아웃</button></form>}</div>
  </div>
 </div></>
}
