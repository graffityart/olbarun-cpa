import DashboardShell from "@/components/DashboardShell";
import EventAdminFilter from "@/components/EventAdminFilter";
import {sql} from "drizzle-orm";
import {getDb} from "@/db";
import {requireAdmin} from "@/lib/auth/guards";
export const dynamic="force-dynamic";
type EventRow={id:string;title:string;status:string;createdAt:Date;viewCount:number};
export default async function Page(){
 await requireAdmin();
 let events:EventRow[]=[];
 let failed=false;
 try{
 events=await getDb().execute(sql`SELECT id,title,status,created_at AS "createdAt",view_count AS "viewCount" FROM customer_events ORDER BY created_at DESC LIMIT 100`) as unknown as EventRow[];
 }catch(error){failed=true;console.error("Event management unavailable",error);}
 return <DashboardShell title="이벤트 관리" description="이벤트 검색, 공개 상태 확인 및 수정" nav={[{href:"/admin/events/new",label:"+ 새 이벤트"},{href:"/customer/events",label:"이벤트 게시판"}]}>
 <section className="panel card"><h2>등록된 이벤트</h2>
 {failed?<p role="alert">이벤트 목록을 불러오지 못했습니다.</p>:events.length===0?<p>아직 등록된 이벤트가 없습니다.</p>:<EventAdminFilter events={events.map(e=>({id:String(e.id),title:String(e.title),status:String(e.status),createdAt:new Date(e.createdAt).toISOString(),viewCount:Number(e.viewCount)}))}/>}
 </section></DashboardShell>;
}
