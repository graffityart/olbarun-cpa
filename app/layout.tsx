import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://mypickup.kr"),
  title: "마이픽업 | CPA 성과형 광고 플랫폼",
  description: "CPA 광고와 포스팅 광고를 하나의 파트너·광고주·정산 시스템에서 운영하는 마이픽업 플랫폼입니다.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "마이픽업 | CPA 성과형 광고 플랫폼",
    description: "광고주와 파트너를 연결하는 CPA 성과형 광고 플랫폼 마이픽업",
    url: "https://mypickup.kr",
    siteName: "마이픽업",
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <div className="shell">
          <header className="topbar">
            <Link href="/" className="brand" aria-label="마이픽업 홈">마이<span>픽업</span></Link>
            <nav className="nav" aria-label="주요 메뉴">
              <Link href="/campaigns">광고 캠페인</Link>
              <Link href="/partner">파트너센터</Link>
              <Link href="/advertiser">광고주센터</Link>
              <Link href="/admin">관리자</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
