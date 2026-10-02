import Image from "next/image";
import Link from "next/link";
import "./biz-home.css";
import AnimatedCounter from "./components/AnimatedCounter";

const campaigns=[
 {tag:"진행중",brand:"STARBUCKS",title:"스타벅스 신규 앱 회원가입",rate:"승인율 95%",reward:"3,900원",kind:"카드/금융"},
 {tag:"인기",brand:"CARD",title:"신한카드 신규 발급 (간편신청)",rate:"승인율 80%",reward:"9,400원",kind:"카드/금융"},
 {tag:"진행중",brand:"coupang",title:"쿠팡 신규 회원가입",rate:"승인율 92%",reward:"2,100원",kind:"쇼핑몰"},
 {tag:"진행중",brand:"배달의민족",title:"배달의민족 신규 회원가입",rate:"승인율 90%",reward:"3,100원",kind:"앱/게임"},
 {tag:"인기",brand:"N",title:"네이버페이 신규 회원가입",rate:"승인율 88%",reward:"2,500원",kind:"통신/앱"}
];
const quickMenus=[
 {label:"전체 상품",href:"/campaigns",icon:"쇼핑 바구니와 알록달록한 상품들.png"},
 {label:"CPA알바",href:"/campaigns?type=cpa",icon:"파란 메가폰과 빛나는 음향 파동.png"},
 {label:"포스팅알바",href:"/campaigns?type=posting",icon:"광택 3D 문서와 연필 아이콘.png"},
 {label:"1초알바",href:"/campaigns?type=quick",icon:"광택 블루 번개 스톱워치 아이콘.png"},
 {label:"수익확인",href:"/partner",icon:"상승 그래프와 원화 금화 아이콘.png"},
 {label:"고객센터",href:"/customer",icon:"3D 고객지원 챗봇 아바타.png"},
 {label:"광고의뢰(광고주)",href:"/advertiser",icon:"계약서와 악수 아이콘.png"}
];
export default function Home(){return <main className="biz-home">
 <section className="biz-hero"><div className="container biz-hero-grid"><div><span className="biz-pill">성과 인만큼 온라인 부업 플랫폼</span><h1>지금, 당신의 시간을<br/><b>수익으로 바꿔보세요</b></h1><p>CPA 참여부터 포스팅 알바까지<br/>마이픽업과 함께라면 누구나 쉽게 시작할 수 있습니다.</p><form className="biz-search" action="/campaigns"><input name="q" placeholder="원하는 캠페인을 검색해보세요 (예: 쿠팡, 스타벅스, 카드 등)"/><button aria-label="검색">⌕</button></form><div className="biz-keywords">인기검색어　 카드발급　 쇼핑몰 가입　 앱 설치　 설문조사　 블로그 포스팅</div></div><div className="hero-image-slot hero-image-live"><Image src="/images/home/hero-main.png" alt="마이픽업 CPA 및 포스팅 성과형 광고 플랫폼" fill priority sizes="(max-width: 950px) 100vw, 48vw"/></div></div></section>
 <nav className="container category-bar quick-menu-bar">{quickMenus.map((m,i)=><Link key={m.label} href={m.href} className={`quick-menu quick-menu-${i+1}`}><span className="quick-icon"><Image src={`/images/home/menu-icons-numbered/${m.icon}`} alt="" width={96} height={96} className="quick-menu-image" aria-hidden="true"/></span><strong>{m.label}</strong><span className="quick-arrow" aria-hidden="true">›</span></Link>)}</nav>
 <section className="container biz-campaign"><div className="biz-section-head"><div><h2>MD's Pick! 지금 인기 있는 캠페인</h2><p>지금 가장 많이 참여하고 있는 인기 캠페인을 확인해보세요.</p></div><Link href="/campaigns">전체 캠페인 보기 →</Link></div><div className="campaign-row">{campaigns.map((c,i)=><Link href={`/campaigns?q=${encodeURIComponent(c.title)}`} className="biz-card" key={c.title}><span className="state">{c.tag}</span><div className={`biz-thumb thumb-${i+1}`}><small>{c.kind}</small><b>{c.brand}</b><em>IMAGE SLOT</em></div><h3>{c.title}</h3><p>{c.rate}</p><strong>{c.reward}</strong></Link>)}</div></section>
 <section className="biz-service"><div className="container service-grid"><div className="service-intro"><span>ⓘ MYPICKUP SERVICE</span><h2>한 번의 참여로<br/>다양한 브랜드의<br/>캠페인을 만나보세요</h2><p>검증된 기업과 함께하는 신뢰할 수 있는 CPA·포스팅 알바 플랫폼입니다.</p><Link className="biz-btn" href="/campaigns">지금 시작하기 →</Link></div><div className="service-cards"><article><b><Image src="/images/home/service-icons/01.png" alt="" width={64} height={64}/></b><div><h3>간편한 참여</h3><p>회원가입 후 원하는 캠페인을 선택하고 미션만 수행하면 끝!</p></div></article><article><b><Image src="/images/home/service-icons/02.png" alt="" width={64} height={64}/></b><div><h3>다양한 플랫폼</h3><p>네이버, 카카오, 인스타, 유튜브 등 다양한 채널의 캠페인 제공</p></div></article><article><b><Image src="/images/home/service-icons/03.png" alt="" width={64} height={64}/></b><div><h3>안전한 정산</h3><p>검증된 광고주와 투명한 정산으로 안전하게 수익을 받을 수 있습니다.</p></div></article><article><b><Image src="/images/home/service-icons/04.png" alt="" width={64} height={64}/></b><div><h3>빠른 승인</h3><p>대부분의 캠페인은 빠르게 승인 상태를 확인할 수 있습니다.</p></div></article></div></div></section>
 <section className="container proof"><h2>이미 많은 분들이 마이픽업과 함께하고 있습니다</h2><div><p><Image className="proof-icon" src="/images/home/proof-icons/광택 나는 3D 오피스 건물 아이콘.png" alt="" width={88} height={88}/><b><AnimatedCounter end={125} suffix="+"/></b><span>제휴 기업</span></p><p><Image className="proof-icon" src="/images/home/proof-icons/광택 3D 사용자 그룹 추가 아이콘.png" alt="" width={88} height={88}/><b><AnimatedCounter end={5} suffix="천+"/></b><span>누적 회원 수</span></p><p><Image className="proof-icon" src="/images/home/proof-icons/문서 체크리스트와 보안 방패 아이콘.png" alt="" width={88} height={88}/><b><AnimatedCounter end={99.9} decimals={1} suffix="%"/></b><span>정산 완료율</span></p><p><Image className="proof-icon" src="/images/home/proof-icons/윤기 나는 황금 별과 반짝임.png" alt="" width={88} height={88}/><b><AnimatedCounter end={4.8} decimals={1} suffix="/5"/></b><span>회원 만족도</span></p></div></section>
 <section className="container dual-banner"><article className="member-banner"><div><span>초보자도 쉽게</span><h2>지금 바로 수익을<br/>시작해보세요</h2><p>✓ 회원가입만으로 바로 참여 가능<br/>✓ 간단한 미션으로 수익 적립<br/>✓ 친절한 가이드와 1:1 문의 지원</p></div><div className="person-slot member-image"><Image src="/images/home/menu-icons/성공을 향한 핀테크 성장 그래프.png" alt="마이픽업 캠페인 참여 및 수익 성장 이미지" width={560} height={440} priority={false}/></div></article><article className="ad-banner"><div><span>광고주/기업</span><h2>브랜드 성장의<br/>파트너가 되어보세요</h2><p>✓ 국내 주요 플랫폼과 연동<br/>✓ 타깃 맞춤형 마케팅 진행<br/>✓ 성과 기반 광고 운영</p></div><div className="person-slot">ADVERTISER IMAGE</div></article></section>
 <section className="container partner-strip"><span>NAVER</span><span>kakao</span><span>coupang</span><span>신한카드</span><span>배달의민족</span><span>11번가</span><span>Gmarket</span></section>
 <section className="container join-cta"><div><small>✓ 지금 바로 시작하세요</small><h2>회원가입하고 다양한 캠페인에 참여해보세요</h2><p>지금 가입하면 인기 캠페인을 바로 확인할 수 있습니다.</p></div><div><Link href="/partner">무료로 시작하기 →</Link><Link href="/customer">1:1 상담 문의</Link></div></section>
 <footer className="biz-footer"><div className="container"><div className="footer-logo">M <b>마이픽업</b></div><p>이용약관　|　개인정보처리방침　|　운영정책　|　고객센터<br/>마이픽업은 CPA 및 포스팅 캠페인을 연결하는 성과형 광고 플랫폼입니다.</p><small>© 2026 MYPICKUP. All rights reserved.</small></div></footer>
 </main>}
