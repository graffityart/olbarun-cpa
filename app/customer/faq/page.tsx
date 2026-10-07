import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "자주 묻는 질문 | 마이픽업 고객센터", alternates: { canonical: "/customer/faq" } };

const faqs = [
  ["파트너", "마이픽업 파트너는 어떻게 가입하나요?", "파트너 회원가입에서 기본 정보를 등록하면 별도 승인 없이 바로 이용할 수 있습니다. 가입 완료 후 자동 로그인되며, 이후에는 이메일과 비밀번호로 로그인합니다."],
  ["캠페인", "CPA 캠페인은 어떻게 참여하나요?", "로그인 후 참여 가능한 캠페인을 확인하고 캠페인별 조건과 승인 기준을 확인한 뒤 참여합니다."],
  ["전환", "발생한 전환은 바로 수익으로 잡히나요?", "접수된 전환은 검수 과정을 거치며 승인된 성과만 파트너 수익에 반영됩니다."],
  ["정산", "정산 금액은 어디서 확인하나요?", "파트너센터의 수익 및 정산 메뉴에서 승인된 성과와 정산 대상 금액을 확인할 수 있습니다."],
  ["광고주", "광고주는 캠페인을 어떻게 등록하나요?", "광고주 가입 신청 후 관리자 승인을 받아 로그인할 수 있습니다. 캠페인 목표와 운영 조건을 정리해 운영 상담을 요청하면 관리자가 캠페인을 등록합니다."],
];

export default function FaqPage(){return <main className="customer-page"><section className="customer-head"><div className="container"><span>MY PICKUP SUPPORT</span><h1>고객센터</h1><p>자주 문의하는 내용을 빠르게 확인해 보세요.</p></div></section><div className="customer-tabs-wrap"><nav className="container customer-tabs"><Link href="/customer">공지사항</Link><Link href="/customer/qna">질문과 답변</Link><Link className="active" href="/customer/faq">자주 묻는 질문</Link></nav></div><section className="customer-content container"><div className="customer-title-row"><div><span>FAQ</span><h2>자주 묻는 질문</h2></div></div><div className="faq-list">{faqs.map(([category,q,a])=><details key={q}><summary><span>{category}</span><strong>{q}</strong></summary><div><b>A</b><p>{a}</p></div></details>)}</div></section><section className="customer-help"><div className="container customer-help-grid"><div><span>원하는 답변을 찾지 못하셨나요?</span><a href="tel:01026365008">010-2636-5008</a><p>마이픽업 고객센터로 문의해 주세요.</p></div><div><span>온라인 문의</span><div><Link href="/customer/qna">질문과 답변</Link><Link href="/login">로그인</Link></div></div></div></section></main>}
