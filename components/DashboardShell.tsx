import Link from "next/link";
import type { ReactNode } from "react";

type NavItem = { href: string; label: string };

export default function DashboardShell({
  title,
  description,
  nav,
  children,
}: {
  title: string;
  description?: string;
  nav: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="dashboard">
      <aside className="sidebar">
        <strong>{title}</strong>
        {nav.map((item) => (
          <Link key={item.href} href={item.href}>{item.label}</Link>
        ))}
      </aside>
      <main className="content">
        <div className="page-head">
          <div>
            <h1>{title}</h1>
            {description ? <div className="muted">{description}</div> : null}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
