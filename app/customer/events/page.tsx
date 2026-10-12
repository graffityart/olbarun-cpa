import type {Metadata} from "next";
import Link from "next/link";
import CustomerBoardNav from "@/components/CustomerBoardNav";
export const metadata:Metadata={title:"이벤트 | 마이픽업",description:"마이픽업 공식 이벤트와 당첨자 안내",alternates:{canonical:"/customer/events"}};
export default function Page(){return <main className="customer-page"><section className="customer-head"><div className="container"><span>MY PICKUP EVENTS</span><h1>이벤트</h1><p>마이픽업의 새로운 이벤트와 혜택을 확인하세요.</p></div></section><CustomerBoardNav current="/customer/events"/><section className="customer-content container"><div className="customer-title-row"><div><h2>이벤트 소식</h2><p>진행 중인 이벤트와 당첨자 발표를 안내합니다.</p></div></div><div className="cs-empty">현재 공개된 이벤트가 없습니다.</div><p><Link href="/customer">← 고객센터로 돌아가기</Link></p></section></main>}