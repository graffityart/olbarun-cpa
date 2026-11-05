import Link from "next/link";import PayoutVerificationReset from "@/components/PayoutVerificationReset";import PayoutVerificationReview from "@/components/PayoutVerificationReview";
import DashboardShell from "@/components/DashboardShell";
import {requireAdmin} from "@/lib/auth/guards";
import {getDb} from "@/db";
import {sql} from "drizzle-orm";
export const dynamic="force-dynamic";
type Verification={partner_id:string;partner_code:string;name:string;status:string;document_type:string|null;submitted_at:Date|null};
export default async function Page(){
 await requireAdmin();
 const rows=await getDb().execute(sql`select v.partner_id,p.partner_code,p.name,v.status,v.document_type,v.submitted_at
 from partner_payout_verifications v join partners p on p.id=v.partner_id
 order by case v.status when 'PENDING' then 0 when 'REJECTED' then 1 when 'APPROVED' then 2 else 3 end,v.submitted_at desc nulls last limit 100`) as unknown as Verification[];
 return <DashboardShell title="출금 본인확인 검수" description="통장·신분확인 증빙을 검수하는 관리자 전용 대기 목록입니다." nav={[{href:"/admin",label:"대시보드"},{href:"/admin/settlements",label:"출금 관리"},{href:"/admin/payout-verifications",label:"본인확인 검수"}]}>
 <section className="panel card"><h2>검수 목록 ({rows.length}건)</h2><p>신분증·통장 이미지 원본은 목록에서 제공하지 않습니다. 승인 전 반드시 두 증빙 파일을 열람하여 본인 명의 및 제출 내용을 확인해 주세요.</p>
 <div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left"}}><thead><tr><th>파트너</th><th>상태</th><th>증빙 유형</th><th>접수일</th><th>서류 검수</th></tr></thead><tbody>{rows.map(row=><tr key={row.partner_id}><td>{row.name} ({row.partner_code})</td><td>{({NOT_SUBMITTED:"미제출",PENDING:"검수 대기",APPROVED:"승인",REJECTED:"반려"} as Record<string,string>)[row.status]??row.status}</td><td>{row.document_type==="BUSINESS_REGISTRATION"?"사업자 증빙":"개인 신분확인"}</td><td>{row.submitted_at?new Date(row.submitted_at).toLocaleDateString("ko-KR"):"-"}</td><td>{row.status==="PENDING"?<PayoutVerificationReview partnerId={row.partner_id}/>:row.status==="APPROVED"?<PayoutVerificationReset partnerId={row.partner_id}/>:null}</td></tr>)}</tbody></table></div>{rows.length===0&&<p>접수된 본인확인 내역이 없습니다.</p>}<p><Link href="/admin/settlements">출금 관리로 이동</Link></p></section></DashboardShell>;
}
