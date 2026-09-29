import DashboardShell from "@/components/DashboardShell";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { customerQna } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { saveAnswer } from "./actions";

const nav=[{href:"/admin",label:"대시보드"},{href:"/admin/partners",label:"파트너 관리"},{href:"/admin/advertisers",label:"광고주 관리"},{href:"/admin/campaigns",label:"캠페인 관리"},{href:"/admin/conversions",label:"전환 DB"},{href:"/admin/posting",label:"포스팅 작업"},{href:"/admin/ledger",label:"광고비·수익"},{href:"/admin/settlements",label:"정산"},{href:"/admin/customer",label:"고객센터"},{href:"/admin/audit",label:"감사로그"}];
export const dynamic="force-dynamic";

export default async function AdminCustomerDetail({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{saved?:string}>}){
  await requireAdmin(); const {id}=await params; const query=await searchParams; const db=getDb();
  const [item]=await db.select().from(customerQna).where(eq(customerQna.id,id)).limit(1); if(!item) notFound();
  const action=saveAnswer.bind(null,id);
  return <DashboardShell title="마이픽업 ADMIN" description="고객 문의 상세 및 답변" nav={nav}><div className="page-toolbar"><Link href="/admin/customer">← 문의 목록</Link></div>{query.saved==="1"&&<p className="success-message">답변이 저장되었습니다.</p>}<section className="panel card" style={{marginBottom:18}}><div className="page-head"><div><span className={`answer-state ${item.status==="ANSWERED"?"done":"waiting"}`}>{item.status==="ANSWERED"?"답변완료":"답변대기"}</span><h1 style={{fontSize:26,marginTop:12}}>{item.title}</h1><p className="muted">{item.nickname} · {new Date(item.createdAt).toLocaleString("ko-KR")} · 스팸점수 {item.spamScore}</p></div></div><div style={{whiteSpace:"pre-wrap",lineHeight:1.8,padding:"20px 0",borderTop:"1px solid #e5e7eb"}}>{item.content}</div></section><section className="panel card"><h3>{item.answer?"답변 수정":"관리자 답변"}</h3><form action={action}><textarea name="answer" required minLength={2} maxLength={5000} rows={10} defaultValue={item.answer??""} style={{width:"100%",padding:14,border:"1px solid #d1d5db",borderRadius:10,resize:"vertical"}} placeholder="고객에게 표시할 답변을 입력하세요."/><div className="form-actions"><Link className="btn" href="/admin/customer">취소</Link><button type="submit">{item.answer?"답변 수정":"답변 등록"}</button></div></form></section></DashboardShell>;
}
