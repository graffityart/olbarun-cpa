import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import AdvertiserCampaignApproval from "@/components/AdvertiserCampaignApproval";
import {requireAdmin} from "@/lib/auth/guards";
import {getDb} from "@/db";
import {sql} from "drizzle-orm";
import "../management.css";
export const dynamic="force-dynamic";
type RequestRow={id:string;name:string;type:"CPA"|"POSTING";company_name:string|null;description:string|null;created_at:Date};
export default async function Page(){
 await requireAdmin();
 const rows=await getDb().execute(sql`select c.id,c.name,c.type,a.company_name,c.description,c.created_at
 from campaigns c join advertisers a on a.id=c.advertiser_id
 where c.registration_source='ADVERTISER' and c.advertiser_approval_status='PENDING'
 and c.type in ('CPA','POSTING') order by c.created_at asc limit 100`) as unknown as RequestRow[];
 return <DashboardShell title="광고주 광고 승인 대기" description="광고주 직접 등록 광고를 검토하고 승인·반려합니다. 승인 후에도 광고는 자동 공개되지 않습니다." nav={[{href:"/admin",label:"대시보드"},{href:"/admin/campaigns",label:"캠페인 관리"},{href:"/admin/campaigns/requests",label:"광고 승인 대기"}]}>
 <section className="panel card"><h2>승인 대기 {rows.length}건</h2><p>광고 내용과 조건을 확인해 주세요. 승인 후에는 캠페인 상세에서 단가·광고비·기간을 검증하고 별도로 공개해야 합니다.</p>
 {rows.length?<div style={{display:"grid",gap:16}}>{rows.map(row=><article key={row.id} className="panel card"><h3>{row.name}</h3><p>{row.type==="CPA"?"CPA 광고":"포스팅알바"} · {row.company_name??"광고주"} · {new Date(row.created_at).toLocaleDateString("ko-KR")}</p><p>{row.description??"설명 없음"}</p><p><Link href={`/admin/campaigns/${row.id}`}>캠페인 상세 및 조건 확인</Link></p><AdvertiserCampaignApproval id={row.id} type={row.type}/></article>)}</div>:<p>현재 승인 대기 중인 광고가 없습니다.</p>}</section></DashboardShell>;
}
