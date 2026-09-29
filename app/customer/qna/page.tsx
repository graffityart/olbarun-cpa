import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { customerQna } from "@/db/schema";

export const metadata: Metadata = { title: "질문과 답변 | 마이픽업 고객센터", alternates: { canonical: "/customer/qna" } };
export const dynamic = "force-dynamic";

async function getQna() {
  try {
    const db = getDb();
    return await db.select({ id: customerQna.id, nickname: customerQna.nickname, title: customerQna.title, status: customerQna.status, isSecret: customerQna.isSecret, createdAt: customerQna.createdAt }).from(customerQna).orderBy(desc(customerQna.createdAt)).limit(50);
  } catch (error) {
    console.error("Customer Q&A page query failed", error);
    return [];
  }
}

export default async function QnaPage(){
  const qna = await getQna();
  return <main className="customer-page"><section className="customer-head"><div className="container"><span>MY PICKUP SUPPORT</span><h1>고객센터</h1><p>궁금한 내용을 남겨주시면 확인 후 답변해드립니다.</p></div></section><div className="customer-tabs-wrap"><nav className="container customer-tabs"><Link href="/customer">공지사항</Link><Link className="active" href="/customer/qna">질문과 답변</Link><Link href="/customer/faq">자주 묻는 질문</Link></nav></div><section className="customer-content container"><div className="customer-title-row"><div><span>Q&amp;A</span><h2>질문과 답변</h2></div><Link className="board-write" href="/customer/qna/write">문의하기</Link></div><div className="customer-table-wrap"><table className="customer-table"><thead><tr><th>상태</th><th>제목</th><th>작성자</th><th>등록일</th></tr></thead><tbody>{qna.length ? qna.map((item)=><tr key={item.id}><td><span className={`answer-state ${item.status === "ANSWERED" ? "done" : "waiting"}`}>{item.status === "ANSWERED" ? "답변완료" : "답변대기"}</span></td><td><Link href={`/customer/qna/${item.id}`}>{item.isSecret ? "🔒 " : ""}{item.title}</Link></td><td>{item.nickname}</td><td>{new Date(item.createdAt).toLocaleDateString("ko-KR")}</td></tr>) : <tr><td colSpan={4} className="empty-cell">등록된 문의가 없습니다. 첫 문의를 남겨주세요.</td></tr>}</tbody></table></div><div className="qna-guide"><strong>문의 전 확인해주세요.</strong><p>비회원도 문의를 등록할 수 있습니다. 작성 시 설정한 비밀번호는 글 확인에 사용되며, 문의 내용은 작성자와 관리자만 확인할 수 있도록 운영합니다.</p></div></section><section className="customer-help"><div className="container customer-help-grid"><div><span>전화 문의</span><a href="tel:01026365008">010-2636-5008</a><p>광고주 · 파트너 · 서비스 이용 문의</p></div><div><span>빠른 메뉴</span><div><Link href="/customer">공지사항</Link><Link href="/customer/faq">자주 묻는 질문</Link></div></div></div></section></main>;
}
