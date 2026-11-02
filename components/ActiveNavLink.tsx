"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function ActiveNavLink({href,children,className}:{href:string;children:ReactNode;className?:string}){
 const pathname=usePathname();
 const active=href==="/partner"?pathname==="/partner":pathname===href||pathname.startsWith(href+"/");
 return <Link href={href} className={[className,active?"is-active":""].filter(Boolean).join(" ")||undefined} aria-current={active?"page":undefined}>{children}</Link>;
}
