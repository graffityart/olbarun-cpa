import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://mypickup.kr"),
  title: "마이픽업 | CPA 성과형 광고 플랫폼",
  description: "CPA 광고와 포스팅 광고를 하나의 파트너·광고주·정산 시스템에서 운영하는 마이픽업 플랫폼입니다.",
  alternates: { canonical: "/" },
  openGraph: { title: "마이픽업 | CPA 성과형 광고 플랫폼", description: "광고주와 파트너를 연결하는 CPA 성과형 광고 플랫폼 마이픽업", url: "https://mypickup.kr", siteName: "마이픽업", locale: "ko_KR", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><div className="shell">
    <header className="topbar mp-global-header">
      <Link href="/" className="brand mp-logo" aria-label="마이픽업 홈"><i>M</i><b>마이<span>픽업</span></b><small>CPA & Posting</small></Link>
      <nav className="nav mp-main-nav" aria-label="주요 메뉴">
        <Link href="/campaigns">CPA알바</Link><Link href="/campaigns">포스팅알바</Link><Link href="/about">이용가이드</Link><Link href="/customer">이벤트</Link><Link href="/customer">고객센터</Link>
      </nav>
      <div className="mp-header-actions"><Link className="mp-search-icon" href="/campaigns" aria-label="캠페인 검색">⌕</Link><Link href="/login">로그인</Link><Link className="mp-join" href="/partner">회원가입</Link><button className="mp-menu" type="button" aria-label="전체 메뉴">☰</button></div>
    </header>{children}
  </div></body></html>;
}
