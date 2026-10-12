import Link from "next/link";

const sections=[
 {href:"/customer",label:"공지사항"},
 {href:"/customer/faq",label:"자주 하는 질문"},
 {href:"/customer/events",label:"이벤트"},
 {href:"/customer/qna",label:"1:1 문의"},
] as const;

export default function CustomerBoardNav({current}:{current:typeof sections[number]["href"]}){
 return <nav className="container customer-tabs" aria-label="고객센터 게시판">{sections.map(section=><Link key={section.href} href={section.href} className={current===section.href?"active":undefined} aria-current={current===section.href?"page":undefined}>{section.label}</Link>)}</nav>;
}