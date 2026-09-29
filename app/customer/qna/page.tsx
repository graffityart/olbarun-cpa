import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "질문과 답변 | 마이픽업 고객센터", alternates: { canonical: "/customer/qna" } };

const qna = [
  ["답변완료", "CPA 전환 승인 기준이 궁금합니다.", "파트너", "2026.09.29"],
  ["답변완료", "정산 신청은 언제 할 수 있나요?", "파트너", "2026.09.29"],
  ["답변대기", "광고주 캠페인 등록 관련 문의드립니다.", "광고주", "2026.09.28"],
  ["답변완료", "포스팅 광고 수정 요청 확인 방법", "파트너", "2026.09.27"],
];

export default function QnaPage(){return <main className="customer-page"><section className="customer-head"><div className="container"><span>MY PICKUP SUPPORT</span><h1>고객센터</h1><p>궁금한 내용을 남겨주시면 확인 후 답변해드립니다.</p></div></section><div className="customer-tabs-wrap"><nav className="container customer-tabs"><Link href="/customer">공지사항</Link><Link className="active" href="/customer/qna">질문과 답변</Link><Link href="/customer/faq">자주 묻는 질문</Link></nav></div><section className="customer-content container"><div className="customer-title-row"><div><span>Q&amp;A</span><h2>질문과 답변</h2></div><Link className="board-write" href="/login">문의하기</Link></div><div className="customer-table-wrap"><table className="customer-table"><thead><tr><th>상태</th><th>제목</th><th>구분</th><th>등록일</th></tr></thead><tbody>{qna.map(([state,title,type,date])=><tr key={title}><td><span className={`answer-state ${state === "답변완료" ? "done" : "waiting"}`}>{state}</span></td><td>🔒 {title}</td><td>{type}</td><td>{date}</td></tr>)}</tbody></table></div><div className="qna-guide"><strong>문의 전 확인해주세요.</strong><p>계정·정산·캠페인과 관련된 개인 문의는 로그인 후 등록해 주세요. 문의 내용은 작성자와 관리자만 확인할 수 있도록 운영할 예정입니다.</p></div></section><section className="customer-help"><div className="container customer-help-grid"><div><span>전화 문의</span><a href="tel:01026365008">010-2636-5008</a><p>광고주 · 파트너 · 서비스 이용 문의</p></div><div><span>빠른 메뉴</span><div><Link href="/customer">공지사항</Link><Link href="/customer/faq">자주 묻는 질문</Link></div></div></div></section></main>}
