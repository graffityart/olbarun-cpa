import Link from "next/link";
import type { ReactNode } from "react";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import LogoutButton from "@/components/LogoutButton";
type NavItem={href:string;label:string};
export default async function DashboardShell({title,description,nav,children}:{title:string;description?:string;nav:NavItem[];children:ReactNode}){
 let unread=0;let user=null;try{user=await getCurrentUser();if(user){const[row]=await getDb().select({n:sql<number>`count(*)`}).from(notifications).where(sql`${notifications.userId}=${user.id} and ${notifications.isRead}=false`);unread=Number(row?.n??0);}}catch{}
 const isManagement=user?.role==="ADMIN"||user?.role==="SUPER_ADMIN"||user?.role==="ADVERTISER";
 const showSidebar=isManagement && (title==="관리자"||title==="광고주센터");
 const showPartnerSidebar=user?.role==="PARTNER";
 return <div className={showSidebar?"dashboard":"dashboard dashboard-public"}>
  {showSidebar&&<aside className="sidebar"><strong>{title}</strong>{nav.map(item=><Link key={item.href} href={item.href}>{item.label}</Link>)}<Link href="/notifications">알림센터 {unread>0&&<span className="nav-count">{unread>99?"99+":unread}</span>}</Link>{user&&<div className="sidebar-account"><span className="muted">{user.email}</span><LogoutButton/></div>}</aside>}
  <main className="content">
   {showSidebar&&<div className="page-head"><div><h1>{title}</h1>{description?<div className="muted">{description}</div>:null}</div><Link className="notification-button" href="/notifications">알림 {unread>0&&<span>{unread>99?"99+":unread}</span>}</Link></div>}
   {!showSidebar&&!showPartnerSidebar&&nav.length>0&&<nav className="page-inline-nav">{nav.map(item=><Link key={item.href} href={item.href}>{item.label}</Link>)}<Link href="/notifications">알림센터{unread>0?` (${unread>99?"99+":unread})`:""}</Link></nav>}
   {showPartnerSidebar&&<nav className="partner-floating-nav" aria-label="파트너 빠른 메뉴">{nav.map((item,i)=>{const icons=[<svg key="home" viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M9.5 20v-6h5v6"/></svg>,<svg key="cpa" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7v10M7 12h10"/><path d="m16.5 7.5 2-2"/></svg>,<svg key="post" viewBox="0 0 24 24"><path d="M5 4h10l4 4v12H5z"/><path d="M14 4v5h5M8 13h8M8 17h6"/></svg>,<svg key="mine" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>,<svg key="money" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 8 2.2 8L12 11l1.8 5L16 8M7 11h10"/></svg>,<svg key="settle" viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="m9 11 2 2 4-4"/></svg>];return <Link key={item.href} href={item.href}><span className="float-icon">{icons[i]||icons[0]}</span><b>{item.label}</b></Link>})}<Link href="/notifications"><span className="float-icon"><svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></span><b>알림</b>{unread>0&&<i>{unread>99?"99+":unread}</i>}</Link></nav>}
   {children}
  </main>
 </div>
}