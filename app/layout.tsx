import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "올바른광고 | CPA 성과형 광고 플랫폼",
  description: "CPA 광고와 포스팅 광고를 하나의 파트너·광고주·정산 시스템에서 운영하는 올바른광고 플랫폼입니다.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <div className="shell">
          <header className="topbar">
            <Link href="/" className="brand">올바른<span>광고</span></Link>
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
