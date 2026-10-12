import DashboardShell from "@/components/DashboardShell";
import EventWriteForm from "@/components/EventWriteForm";
import {requireAdmin} from "@/lib/auth/guards";
import {getDb} from "@/db";
import {sql} from "drizzle-orm";
import {notFound} from "next/navigation";
import "../../../notices/new/notice-editor.css";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{id:string}>}){await requireAdmin();const {id}=await params;if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();const rows=await getDb().execute(sql`SELECT id,title,content,status FROM customer_events WHERE id=${id}::uuid LIMIT 1`);if(!rows.length)notFound();const e=rows[0];return <DashboardShell title="이벤트 수정" description="공개 상태를 변경하거나 이벤트 내용을 수정합니다." nav={[{href:"/admin/events",label:"← 이벤트 관리"}]}><section className="panel card"><EventWriteForm event={{id:String(e.id),title:String(e.title),content:String(e.content),status:String(e.status)}}/></section></DashboardShell>}
