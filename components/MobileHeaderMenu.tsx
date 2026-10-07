"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function MobileHeaderMenu({loggedIn=false,accountHref="/login"}:{loggedIn?:boolean;accountHref?:string}){
 const [open,setOpen]=useState(false);
 useEffect(()=>{document.body.classList.toggle("mp-menu-open",open);return()=>document.body.classList.remove("mp-menu-open")},[open]);
 const close=()=>setOpen(false);
 return <><button className="mp-menu" type="button" aria-label="전체 메뉴" aria-expanded={open} aria-controls="mp-mobile-menu" onClick={()=>setOpen(v=>!v)}>{open?"×":"☰"}</button>
 <div id="mp-mobile-menu" className={"mp-mobile-menu "+(open?"is-open":"")} aria-hidden={!open}>
  <button className="mp-mobile-backdrop" aria-label="메뉴 닫기" onClick={close}/>
  <div className="mp-mobile-panel">
   <div className="mp-mobile-head"><b>전체 메뉴</b></div>
   <nav>
    <Link onClick={close} href="/partner/campaigns"><span>CPA알바</span><i>→</i></Link>
    <Link onClick={close} href="/partner/posting"><span>포스팅알바</span><i>→</i></Link>
    <Link onClick={close} href="/partner/quick"><span>1초알바</span><i>→</i></Link>
    <Link onClick={close} href="/about"><span>이용가이드</span><i>→</i></Link>

    <Link onClick={close} href="/customer"><span>고객센터</span><i>→</i></Link>
    {loggedIn&&accountHref==="/partner"&&<Link onClick={close} className="mp-mobile-withdraw" href="/partner/settlements"><span>출금신청</span><i>→</i></Link>}
   </nav>
   <div className="mp-mobile-account"><Link onClick={close} href={accountHref}>{loggedIn?"마이페이지":"로그인"}</Link>{!loggedIn&&<Link onClick={close} className="primary" href="/partner/signup">회원가입</Link>}</div>
  </div>
 </div></>
}
