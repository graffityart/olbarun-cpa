import Link from "next/link";

const recommended = [
  ["보험·금융", "상담 신청 CPA", "승인형", "건당 수익 확인"],
  ["생활서비스", "이사·청소·철거 견적", "DB형", "지역 캠페인"],
  ["렌탈·통신", "렌탈 상담 캠페인", "상담형", "실시간 접수"],
];

const campaigns = [
  ["법률", "회생·파산 상담", "상담 신청", "CPA"],
  ["건강", "건강·다이어트 상담", "DB 접수", "CPA"],
  ["생활", "이사 견적 비교", "견적 신청", "CPA"],
  ["렌탈", "정수기·생활가전 렌탈", "상담 신청", "CPA"],
  ["교육", "교육·자격 상담", "상담 접수", "CPA"],
  ["포스팅", "블로그·SNS 콘텐츠", "작업 승인", "POST"],
];

export default function HomePage() {
  return (
    <main className="market-home">
      <section className="market-hero">
        <div className="container market-hero-inner">
          <div>
            <div className="eyebrow">MY PICKUP PERFORMANCE MARKET</div>
            <h1>성과가 나는 광고를<br />한곳에서 픽업하세요.</h1>
            <p>광고주는 필요한 성과를 등록하고, 파트너는 원하는 캠페인을 선택합니다.<br className="desktop-only" /> CPA 전환부터 포스팅 작업과 정산까지 마이픽업에서 관리하세요.</p>
            <div className="actions">
              <Link className="btn primary" href="/campaigns">진행 가능한 캠페인</Link>
              <Link className="btn light" href="/partner">파트너 시작하기</Link>
            </div>
          </div>
          <div className="hero-summary">
            <span>마이픽업 운영 구조</span>
            <strong>광고 등록 → 파트너 참여 → 성과 승인 → 정산</strong>
            <div className="hero-summary-grid">
              <div><b>CPA</b><small>전환형 광고</small></div>
              <div><b>POST</b><small>포스팅 광고</small></div>
              <div><b>1곳</b><small>통합 정산</small></div>
            </div>
          </div>
        </div>
      </section>

      <section className="market-section">
        <div className="container">
          <div className="market-title"><div><span>추천 캠페인</span><h2>지금 확인할 광고</h2></div><Link href="/campaigns">전체보기 →</Link></div>
          <div className="recommend-grid">
            {recommended.map(([category, title, type, reward], index) => (
              <Link className={`recommend-card tone-${index + 1}`} href="/campaigns" key={title}>
                <div className="recommend-visual"><span>{category}</span><strong>{title}</strong><em>MY PICKUP</em></div>
                <div className="recommend-info"><b>{title}</b><small>{type} · {reward}</small><strong>캠페인 보기 →</strong></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="market-section compact-top">
        <div className="container">
          <div className="market-title"><div><span>캠페인 리스트</span><h2>파트너 모집 캠페인</h2></div><div className="market-tabs"><b>전체</b><span>CPA</span><span>포스팅</span></div></div>
          <div className="campaign-market-grid">
            {campaigns.map(([category, title, action, kind], index) => (
              <Link className="market-card" href="/campaigns" key={title}>
                <div className={`market-thumb thumb-${index + 1}`}><span>{category}</span><b>{title}</b><small>MY PICKUP CAMPAIGN</small></div>
                <div className="market-card-body"><span className="campaign-kind">{kind}</span><h3>{title}</h3><p>{action} 기준으로 성과를 확인하고 승인된 건을 정산합니다.</p><div><small>성과 조건</small><strong>{action}</strong></div></div>
              </Link>
            ))}
          </div>
          <div className="more-row"><Link href="/campaigns">캠페인 더보기 +</Link></div>
        </div>
      </section>

      <section className="market-board">
        <div className="container board-grid">
          <div className="board-box"><div className="board-head"><b>공지사항</b><span>+</span></div><p>마이픽업 서비스 운영 안내</p><p>CPA 전환 검수 및 승인 기준 안내</p><p>파트너 정산 신청 안내</p><p>광고주 캠페인 등록 안내</p></div>
          <div className="rank-box"><h3>파트너 수익 현황</h3><ol><li><b>1</b><span>파트너 A</span><strong>이번 달 정산 진행</strong></li><li><b>2</b><span>파트너 B</span><strong>승인 성과 집계</strong></li><li><b>3</b><span>파트너 C</span><strong>성과 검수 중</strong></li></ol></div>
          <div className="rank-box"><h3>인기 캠페인</h3><ol><li><b>1</b><span>상담 신청 CPA</span><strong>모집중</strong></li><li><b>2</b><span>생활서비스 견적</span><strong>모집중</strong></li><li><b>3</b><span>포스팅 광고</span><strong>모집중</strong></li></ol></div>
        </div>
      </section>

      <section className="market-contact">
        <div className="container contact-inner"><div><span>마이픽업 고객센터</span><strong><a href="tel:01026365008">010-2636-5008</a></strong><p>서비스 이용·광고주·파트너 문의</p></div><div className="contact-links"><Link href="/login">로그인</Link><Link href="/partner">파트너센터</Link><Link href="/advertiser">광고주센터</Link></div></div>
      </section>
    </main>
  );
}
