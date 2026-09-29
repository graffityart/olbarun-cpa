import DashboardShell from "@/components/DashboardShell";
import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { customerQna } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";

const nav=[{href:"/admin",label:"대시보드"},{href:"/admin/partners",label:"파트너 관리"},{href:"/admin/advertisers",label:"광고주 관리"},{href:"/admin/campaigns",label:"캠페인 관리"},{href:"/admin/conversions",label:"전환 DB"},{href:"/admin/posting",label:"포스팅 작업"},{href:"/admin/ledger",label:"광고비·수익"},{href:"/admin/settlements",label:"정산"},{href:"/admin/customer",label:"고객센터"},{href:"/admin/audit",label:"감사로그"}];
export const dynamic="force-dynamic";

export default async function AdminCustomerPage(){
  await requireAdmin();
  const db=getDb();
  const [items,[stats]]=await Promise.all([
    db.select({id:customerQna.id,nickname:customerQna.nickname,title:customerQna.title,status:customerQna.status,spamScore:customerQna.spamScore,createdAt:customerQna.createdAt}).from(customerQna).orderBy(desc(customerQna.createdAt)).limit(100),
    db.select({total:sql<number>`count(*)`,waiting:sql<number>`count(*) filter (where ${customerQna.status}='WAITING')`,answered:sql<number>`count(*) filter (where ${customerQna.status}='ANSWERED')`,spam:sql<number>`count(*) filter (where ${customerQna.spamScore} >= 3)`}).from(customerQna)
  ]);
  return <DashboardShell title="마이픽업 ADMIN" description="고객 문의와 스팸 의심 게시물을 관리합니다." nav={nav}><section className="stats"><div className="panel stat"><span>전체 문의</span><strong>{Number(stats?.total??0)}</strong></div><div className="panel stat"><span>답변 대기</span><strong>{Number(stats?.waiting??0)}</strong></div><div className="panel stat"><span>답변 완료</span><strong>{Number(stats?.answered??0)}</strong></div><div className="panel stat"><span>스팸 주의</span><strong>{Number(stats?.spam??0)}</strong></div></section><section className="panel card"><div className="page-toolbar"><div><h3 style={{margin:0}}>질문과 답변 관리</h3><p className="muted">문의 내용을 확인하고 답변을 등록할 수 있습니다.</p></div></div><div className="table-wrap"><table><thead><tr><th>상태</th><th>제목</th><th>작성자</th><th>스팸점수</th><th>등록일</th><th>관리</th></tr></thead><tbody>{items.length?items.map(item=><tr key={item.id}><td><span className={`answer-state ${item.status==="ANSWERED"?"done":"waiting"}`}>{item.status==="ANSWERED"?"답변완료":"답변대기"}</span></td><td>{item.title}</td><td>{item.nickname}</td><td>{item.spamScore>=3?`주의 ${item.spamScore}`:item.spamScore}</td><td>{new Date(item.createdAt).toLocaleString("ko-KR")}</td><td><Link href={`/admin/customer/${item.id}`}>확인·답변</Link></td></tr>):<tr><td colSpan={6} className="empty-cell">등록된 문의가 없습니다.</td></tr>}</tbody></table></div></section></DashboardShell>;
}
