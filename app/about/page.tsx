import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "초보자 이용 가이드 | 마이픽업",
  description: "마이픽업을 처음 이용하는 회원을 위한 CPA 알바, 포스팅 알바, 수익 확인과 정산 이용 가이드입니다.",
  alternates: { canonical: "/about" },
};

const promises = [
  { no: "01", title: "성과 중심의 캠페인", text: "단순 노출이 아니라 상담, 견적, 예약, 신청 등 광고주가 원하는 실제 성과를 기준으로 캠페인을 운영합니다." },
  { no: "02", title: "명확한 전환 검수", text: "접수된 전환을 정해진 승인 기준에 따라 검수하고 파트너가 진행 상태를 확인할 수 있는 구조를 지향합니다." },
  { no: "03", title: "투명한 수익·정산", text: "승인된 CPA 성과와 포스팅 작업 수익을 하나의 장부에서 확인하고 정산 흐름까지 연결합니다." },
];

export default function AboutPage() {
  return (
    <main className="about-page">
      <nav className="guide-subnav"><div className="container"><Link href="/about">초보자 가이드</Link><Link href="/about/cpa">CPA 알바란</Link><Link href="/about/posting">포스팅 알바란</Link></div></nav>
      <section className="about-hero">
        <div className="container about-hero-inner">
          <div>
            <span className="about-kicker">ABOUT MY PICKUP</span>
            <h1>성과를 만들고,<br />가치를 연결하는 <em>마이픽업</em></h1>
            <p>마이픽업은 광고주가 원하는 성과와 파트너의 마케팅 활동을 연결하는 CPA 성과형 광고 플랫폼입니다. 캠페인 등록부터 참여, 전환 검수, 수익 확인과 정산까지 복잡한 과정을 하나의 흐름으로 관리합니다.</p>
          </div>
          <div className="about-mark"><strong>MY<br /><span>PICKUP</span></strong><small>PERFORMANCE MARKETING PLATFORM</small></div>
        </div>
      </section>

      <section className="about-intro">
        <div className="container about-intro-grid">
          <div><span className="about-label">WHY MY PICKUP</span><h2>광고주는 필요한 성과를,<br />파트너는 가치 있는 캠페인을.</h2></div>
          <div><p>성과형 광고의 핵심은 많은 노출이 아니라 <strong>측정 가능한 결과</strong>입니다. 마이픽업은 광고주와 파트너가 같은 성과 기준을 바라볼 수 있도록 캠페인 조건과 전환 상태, 승인 결과, 수익 정보를 연결합니다.</p><p>CPA 광고뿐 아니라 포스팅 광고도 함께 운영해 파트너가 자신의 채널과 방식에 맞는 캠페인을 선택할 수 있도록 확장하고 있습니다.</p></div>
        </div>
      </section>

      <section className="about-promise">
        <div className="container">
          <div className="about-section-head"><span>OUR PROMISE</span><h2>마이픽업의 3가지 운영 원칙</h2></div>
          <div className="promise-grid">
            {promises.map((item) => <article key={item.no}><b>{item.no}</b><h3>{item.title}</h3><p>{item.text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="about-flow">
        <div className="container">
          <div className="about-section-head"><span>HOW IT WORKS</span><h2>하나의 흐름으로 연결되는 성과</h2></div>
          <div className="flow-grid">
            <div><b>01</b><strong>캠페인 등록</strong><p>광고주가 목표와 승인 조건을 설정합니다.</p></div><i>→</i>
            <div><b>02</b><strong>파트너 참여</strong><p>파트너가 적합한 캠페인을 선택합니다.</p></div><i>→</i>
            <div><b>03</b><strong>성과 발생·검수</strong><p>전환을 접수하고 기준에 따라 검수합니다.</p></div><i>→</i>
            <div><b>04</b><strong>수익·정산</strong><p>승인 성과를 수익으로 반영하고 정산합니다.</p></div>
          </div>
        </div>
      </section>

      <section className="about-cta">
        <div className="container about-cta-inner"><div><span>MY PICKUP</span><h2>성과형 광고의 다음 캠페인을 시작하세요.</h2><p>광고주와 파트너에게 필요한 운영 흐름을 마이픽업에서 연결합니다.</p></div><div className="about-actions"><Link href="/advertiser">광고주 시작하기</Link><Link href="/partner">파트너 시작하기</Link></div></div>
      </section>

      <section className="about-contact"><div className="container"><span>마이픽업 고객센터</span><a href="tel:01026365008">010-2636-5008</a><small>서비스 이용 · 광고주 · 파트너 문의</small></div></section>
    </main>
  );
}
