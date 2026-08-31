import Link from "next/link";

const features = [
  ["CPA 광고", "상담·견적·예약 등 고객 행동을 기준으로 정확하게 전환을 추적합니다."],
  ["포스팅 광고", "블로그·카페·SNS 작업을 모집하고 제출·수정·승인·정산까지 관리합니다."],
  ["통합 정산", "CPA와 포스팅 수익을 하나의 파트너 장부와 정산 시스템에서 처리합니다."],
];

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="eyebrow">성과형 광고를 더 투명하게</div>
            <h1>광고주와 파트너를<br />성과로 연결합니다.</h1>
            <p className="lead">올바른광고는 CPA 전환, 포스팅 작업, 광고비, 파트너 수익과 정산을 하나의 흐름으로 관리하는 성과형 광고 플랫폼입니다.</p>
            <div className="actions">
              <Link className="btn primary" href="/partner">파트너센터 보기</Link>
              <Link className="btn" href="/advertiser">광고주센터 보기</Link>
            </div>
          </div>
          <div className="panel hero-panel">
            <div className="metric"><span className="muted">광고 상품</span><strong>CPA + 포스팅</strong></div>
            <div className="metric"><span className="muted">전환 흐름</span><strong>클릭 → DB → 승인</strong></div>
            <div className="metric"><span className="muted">정산 구조</span><strong>통합 수익 장부</strong></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">올바른광고 핵심 구조</h2>
          <div className="grid-3">
            {features.map(([title, body]) => (
              <article className="panel card" key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
