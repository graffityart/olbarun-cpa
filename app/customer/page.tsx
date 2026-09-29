import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "고객센터 | 마이픽업",
  description: "마이픽업 공지사항, 질문과 답변, 자주 묻는 질문을 확인하세요.",
  alternates: { canonical: "/customer" },
};

const notices = [
  ["공지", "마이픽업 서비스 이용 안내", "관리자", "2026.09.29"],
  ["공지", "CPA 전환 검수 및 승인 기준 안내", "관리자", "2026.09.29"],
  ["공지", "파트너 정산 신청 및 지급 일정 안내", "관리자", "2026.09.29"],
  ["공지", "광고주 캠페인 등록 및 운영 안내", "관리자", "2026.09.29"],
  ["5", "파트너 가입 후 캠페인 참여 방법 안내", "관리자", "2026.09.28"],
  ["4", "전환 상태별 처리 기준을 안내드립니다", "관리자", "2026.09.27"],
  ["3", "포스팅 광고 제출 및 수정 요청 안내", "관리자", "2026.09.26"],
  ["2", "수익 확인과 정산 신청 방법 안내", "관리자", "2026.09.25"],
  ["1", "마이픽업 고객센터 운영 안내", "관리자", "2026.09.24"],
];

export default function CustomerPage() {
  return (
    <main className="customer-page">
      <section className="customer-head">
        <div className="container">
          <span>MY PICKUP SUPPORT</span>
          <h1>고객센터</h1>
          <p>서비스 이용 중 필요한 안내와 문의 사항을 빠르게 확인할 수 있습니다.</p>
        </div>
      </section>

      <div className="customer-tabs-wrap">
        <nav className="container customer-tabs" aria-label="고객센터 메뉴">
          <Link className="active" href="/customer">공지사항</Link>
          <Link href="/customer/qna">질문과 답변</Link>
          <Link href="/customer/faq">자주 묻는 질문</Link>
        </nav>
      </div>

      <section className="customer-content container">
        <div className="customer-title-row">
          <div><span>NOTICE</span><h2>공지사항</h2></div>
          <div className="board-search"><select aria-label="검색 조건" defaultValue="title"><option value="title">제목</option><option value="content">내용</option></select><input aria-label="검색어" placeholder="검색어를 입력하세요"/><button type="button">검색</button></div>
        </div>

        <div className="customer-table-wrap">
          <table className="customer-table">
            <thead><tr><th>번호</th><th>제목</th><th>글쓴이</th><th>등록일</th></tr></thead>
            <tbody>{notices.map(([no,title,author,date]) => <tr key={`${no}-${title}`}><td><span className={no === "공지" ? "notice-badge" : ""}>{no}</span></td><td><Link href="#">{title}</Link></td><td>{author}</td><td>{date}</td></tr>)}</tbody>
          </table>
        </div>

        <div className="board-mobile-list">{notices.map(([no,title,author,date]) => <Link href="#" key={`m-${no}-${title}`}><div><span className={no === "공지" ? "notice-badge" : "board-no"}>{no}</span><strong>{title}</strong></div><small>{author} · {date}</small></Link>)}</div>

        <div className="board-bottom"><div className="pagination"><button disabled>‹</button><button className="active">1</button><button>2</button><button>3</button><button>›</button></div></div>
      </section>

      <section className="customer-help">
        <div className="container customer-help-grid">
          <div><span>전화 문의</span><a href="tel:01026365008">010-2636-5008</a><p>광고주 · 파트너 · 서비스 이용 문의</p></div>
          <div><span>빠른 메뉴</span><div><Link href="/customer/qna">1:1 문의하기</Link><Link href="/customer/faq">자주 묻는 질문</Link></div></div>
        </div>
      </section>
    </main>
  );
}
