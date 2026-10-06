import DashboardShell from "@/components/DashboardShell";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { customerQna } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { saveAnswer } from "./actions";
import CustomerAnswerForm from "@/components/CustomerAnswerForm";
import "../support-management.css";

const nav=[{href:"/admin",label:"대시보드"},{href:"/admin/partners",label:"파트너 관리"},{href:"/admin/advertisers",label:"광고주 관리"},{href:"/admin/campaigns",label:"캠페인 관리"},{href:"/admin/conversions",label:"전환 DB"},{href:"/admin/posting",label:"포스팅 작업"},{href:"/admin/ledger",label:"광고비·수익"},{href:"/admin/settlements",label:"정산"},{href:"/admin/customer",label:"고객센터"},{href:"/admin/audit",label:"감사로그"}];
export const dynamic="force-dynamic";

export default async function AdminCustomerDetail({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{saved?:string}>}){
  await requireAdmin(); const {id}=await params; const query=await searchParams; if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound(); const db=getDb();
  const [item]=await db.select().from(customerQna).where(eq(customerQna.id,id)).limit(1); if(!item) notFound();
  const action=saveAnswer.bind(null,id);
  return <DashboardShell title="마이픽업 ADMIN" description="고객 문의 상세 및 답변" nav={nav}><div className="page-toolbar"><Link href="/admin/customer">← 문의 목록</Link></div>{query.saved==="1"&&<p className="success-message" role="status">답변이 저장되었습니다.</p>}<section className="panel card" style={{marginBottom:18}}><div className="page-head"><div><span className={`answer-state ${item.status==="ANSWERED"?"done":"waiting"}`}>{item.status==="ANSWERED"?"답변완료":"답변대기"}</span><h1 style={{fontSize:26,marginTop:12}}>{item.title}</h1><p className="muted">{item.nickname} · {new Date(item.createdAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})} · 스팸점수 {item.spamScore}</p></div></div><div style={{whiteSpace:"pre-wrap",lineHeight:1.8,padding:"20px 0",borderTop:"1px solid #e5e7eb"}}>{item.content}</div></section><section className="panel card"><h3>{item.answer?"답변 수정":"관리자 답변"}</h3>{item.answeredAt&&<p className="muted">최근 답변 저장: {item.answeredAt.toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</p>}<p className="muted">저장한 답변은 고객이 문의 비밀번호를 입력한 후 확인할 수 있습니다.</p><CustomerAnswerForm action={action} answer={item.answer??""}/></section></DashboardShell>;
}
