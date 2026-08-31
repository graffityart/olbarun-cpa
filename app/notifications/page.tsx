import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
export const dynamic="force-dynamic";
export default async function Page(){const user=await getCurrentUser();if(!user)redirect("/login");const rows=await getDb().select().from(notifications).where(eq(notifications.userId,user.id)).orderBy(desc(notifications.createdAt)).limit(100);const home=user.role==="PARTNER"?"/partner":user.role==="ADVERTISER"?"/advertiser":"/admin";return <DashboardShell title="알림센터" description="계정의 주요 운영 알림을 확인합니다." nav={[{href:home,label:"← 대시보드"},{href:"/notifications",label:"알림센터"}]}><section className="panel card"><div className="notification-list">{rows.length?rows.map(n=><article key={n.id} className={`notification-item ${n.isRead?"":"unread"}`}><div><span className="badge">{n.type}</span><h3>{n.title}</h3><p>{n.message}</p><small className="muted">{new Date(n.createdAt).toLocaleString("ko-KR")}</small></div><div>{n.href&&<a href={`/api/notifications/${n.id}/read?next=${encodeURIComponent(n.href)}`}>확인 →</a>}</div></article>):<p className="empty-cell">새로운 알림이 없습니다.</p>}</div></section></DashboardShell>}
