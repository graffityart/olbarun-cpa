import DashboardShell from "@/components/DashboardShell";
import Link from "next/link";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { customerQna } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import "./support-management.css";

const nav=[{href:"/admin",label:"대시보드"},{href:"/admin/partners",label:"파트너 관리"},{href:"/admin/advertisers",label:"광고주 관리"},{href:"/admin/campaigns",label:"캠페인 관리"},{href:"/admin/conversions",label:"전환 DB"},{href:"/admin/posting",label:"포스팅 작업"},{href:"/admin/ledger",label:"광고비·수익"},{href:"/admin/settlements",label:"정산"},{href:"/admin/customer",label:"고객센터"},{href:"/admin/audit",label:"감사로그"}];
export const dynamic="force-dynamic";

export default async function AdminCustomerPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const params=await searchParams;
  const q=typeof params.q==="string"?params.q.trim().slice(0,160):"";
  const status=params.status==="WAITING"||params.status==="ANSWERED"?params.status:"ALL";
  const spam=params.spam==="1";
  const where=and(status!=="ALL"?eq(customerQna.status,status):undefined,spam?gte(customerQna.spamScore,3):undefined,q?sql`(position(lower(${q}) in lower(${customerQna.title})) > 0 or position(lower(${q}) in lower(${customerQna.nickname})) > 0)`:undefined);
  await requireAdmin();
  const db=getDb();
  const [items,[stats]]=await Promise.all([
    db.select({id:customerQna.id,nickname:customerQna.nickname,title:customerQna.title,status:customerQna.status,spamScore:customerQna.spamScore,createdAt:customerQna.createdAt}).from(customerQna).where(where).orderBy(desc(customerQna.createdAt)).limit(100),
    db.select({total:sql<number>`count(*)`,waiting:sql<number>`count(*) filter (where ${customerQna.status}='WAITING')`,answered:sql<number>`count(*) filter (where ${customerQna.status}='ANSWERED')`,spam:sql<number>`count(*) filter (where ${customerQna.spamScore} >= 3)`}).from(customerQna)
  ]);
  return <DashboardShell title="마이픽업 ADMIN" description="고객 문의와 스팸 의심 게시물을 관리합니다." nav={nav}><section className="stats"><div className="panel stat"><span>전체 문의</span><strong>{Number(stats?.total??0)}</strong></div><div className="panel stat"><span>답변 대기</span><strong>{Number(stats?.waiting??0)}</strong></div><div className="panel stat"><span>답변 완료</span><strong>{Number(stats?.answered??0)}</strong></div><div className="panel stat"><span>스팸 주의</span><strong>{Number(stats?.spam??0)}</strong></div></section><section className="panel card"><div className="page-toolbar"><div><h3 style={{margin:0}}>질문과 답변 관리</h3><p className="muted">문의 내용을 확인하고 답변을 등록할 수 있습니다.</p></div></div><form method="get" className="ac-search"><input name="q" defaultValue={q} maxLength={160} aria-label="문의 제목 또는 닉네임 검색" placeholder="제목 또는 닉네임"/><select name="status" defaultValue={status} aria-label="문의 답변 상태"><option value="ALL">전체 상태</option><option value="WAITING">답변 대기</option><option value="ANSWERED">답변 완료</option></select><label><input type="checkbox" name="spam" value="1" defaultChecked={spam}/> 스팸 주의만</label><button type="submit">조회</button><Link href="/admin/customer">초기화</Link></form><p className="muted">검색 결과 {items.length}건 · 조건에 맞는 최신 100건을 표시합니다. 위 집계는 전체 문의 기준입니다.</p><div className="table-wrap"><table><thead><tr><th>상태</th><th>제목</th><th>작성자</th><th>스팸점수</th><th>등록일</th><th>관리</th></tr></thead><tbody>{items.length?items.map(item=><tr key={item.id}><td><span className={`answer-state ${item.status==="ANSWERED"?"done":"waiting"}`}>{item.status==="ANSWERED"?"답변완료":"답변대기"}</span></td><td><Link href={`/admin/customer/${item.id}`}>{item.title}</Link></td><td>{item.nickname}</td><td>{item.spamScore>=3?`주의 ${item.spamScore}`:item.spamScore}</td><td>{new Date(item.createdAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</td><td><Link href={`/admin/customer/${item.id}`}>확인·답변</Link></td></tr>):<tr><td colSpan={6} className="empty-cell">{q||status!=="ALL"||spam?"검색 조건에 맞는 문의가 없습니다.":"등록된 문의가 없습니다."}</td></tr>}</tbody></table></div></section></DashboardShell>;
}
