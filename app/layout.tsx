import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  metadataBase: new URL("https://mypickup.kr"),
  title: "마이픽업 | CPA 성과형 광고 플랫폼",
  description: "CPA 광고와 포스팅 광고를 하나의 파트너·광고주·정산 시스템에서 운영하는 마이픽업 플랫폼입니다.",
  alternates: { canonical: "/" },
  openGraph: { title: "마이픽업 | CPA 성과형 광고 플랫폼", description: "광고주와 파트너를 연결하는 CPA 성과형 광고 플랫폼 마이픽업", url: "https://mypickup.kr", siteName: "마이픽업", locale: "ko_KR", type: "website" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  return <html lang="ko"><body><div className="shell">
    <header className="topbar mp-global-header">
      <Link href="/" className="brand mp-logo" aria-label="마이픽업 홈"><i>M</i><b>마이<span>픽업</span></b><small>CPA & Posting</small></Link>
      <nav className="nav mp-main-nav" aria-label="주요 메뉴">
        <Link href="/partner/campaigns">CPA알바</Link><Link href="/partner/posting">포스팅알바</Link><Link href="/about">이용가이드</Link><Link href="/customer">이벤트</Link><Link href="/customer">고객센터</Link>
      </nav>
      <div className="mp-header-actions"><Link className="mp-search-icon" href="/partner/campaigns" aria-label="캠페인 검색">⌕</Link>{user ? <><Link href={user.role==="PARTNER"?"/partner":user.role==="ADVERTISER"?"/advertiser":"/admin"}>{user.role==="ADMIN"||user.role==="SUPER_ADMIN"?"관리자":"마이페이지"}</Link><form action="/api/auth/logout" method="post" style={{display:"inline"}}><button type="submit" className="mp-logout">로그아웃</button></form></> : <><Link href="/login">로그인</Link><Link className="mp-join" href="/partner">회원가입</Link></>}<button className="mp-menu" type="button" aria-label="전체 메뉴">☰</button></div>
    </header>{children}\n    <footer className="biz-footer global-footer"><div className="container footer-grid"><section className="footer-brand"><div className="footer-logo">M <b>마이픽업</b></div><p>CPA 및 포스팅 캠페인을 연결하는 성과형 광고 플랫폼입니다.</p><div className="footer-links"><Link href="/about">이용가이드</Link><Link href="/terms">이용약관</Link><Link href="/privacy">개인정보처리방침</Link><Link href="/customer">고객센터</Link></div></section><section className="footer-info"><h3>사업자 정보</h3><p><b>상호</b> 마이픽업(올바른) <span>|</span> <b>대표자</b> 박자영</p><p><b>사업자등록번호</b> 808-66-00808</p><p><b>업태</b> 광고대행업 <span>|</span> <b>업종</b> 광고</p><p><b>주소</b> 부산광역시 북구 시랑로 132번길 17-4 504</p><p><b>이메일</b> chlpjy@naver.com</p></section><section className="footer-cs"><h3>고객센터</h3><div className="footer-tel"><span>TEL</span><p><b>주간</b> 051-891-0008<br/><b>야간</b> 010.2636.5008</p></div><p><b>FAX</b> 0508.956.6109</p><div className="footer-hours"><p><b>평일 주간</b> 09시~17시</p><p><b>평일 야간</b> 20시~03시</p><p>점심 12시~13시</p><strong>주 5일 근무 / 주말, 공휴일 휴무</strong></div></section></div><div className="container footer-copy">© 2026 MYPICKUP. All rights reserved.</div></footer>
  </div></body></html>;
}
