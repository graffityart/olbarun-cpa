import Link from "next/link";
import type { ReactNode } from "react";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
type NavItem={href:string;label:string};
export default async function DashboardShell({title,description,nav,children}:{title:string;description?:string;nav:NavItem[];children:ReactNode}){let unread=0;try{const user=await getCurrentUser();if(user){const[row]=await getDb().select({n:sql<number>`count(*)`}).from(notifications).where(sql`${notifications.userId}=${user.id} and ${notifications.isRead}=false`);unread=Number(row?.n??0);}}catch{}
return <div className="dashboard"><aside className="sidebar"><strong>{title}</strong>{nav.map(item=><Link key={item.href} href={item.href}>{item.label}</Link>)}<Link href="/notifications">알림센터 {unread>0&&<span className="nav-count">{unread>99?"99+":unread}</span>}</Link></aside><main className="content"><div className="page-head"><div><h1>{title}</h1>{description?<div className="muted">{description}</div>:null}</div><Link className="notification-button" href="/notifications">알림 {unread>0&&<span>{unread>99?"99+":unread}</span>}</Link></div>{children}</main></div>}
