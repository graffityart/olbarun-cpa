import Link from "next/link";
import {desc} from "drizzle-orm";
import {getDb} from "@/db";
import {customerNotices} from "@/db/schema/notices";
import {customerQna} from "@/db/schema";
import "./HomeBoardShortcodes.css";

type BoardItem={title:string;href:string;meta:string;tag?:string};
type BoardType="notices"|"qna"|"faq"|"events";
const config:Record<BoardType,{title:string;subtitle:string;href:string;icon:string}>={
 notices:{title:"공지사항",subtitle:"서비스 운영과 정산 안내",href:"/customer",icon:"📢"},
 qna:{title:"1:1 문의",subtitle:"궁금한 내용과 답변 확인",href:"/customer/qna",icon:"💬"},
 faq:{title:"자주 묻는 질문",subtitle:"처음 시작하는 분들을 위한 안내",href:"/customer/faq",icon:"❔"},
 events:{title:"이벤트",subtitle:"새로운 이벤트와 혜택 소식",href:"/customer/events",icon:"🎁"}
};
const faqs:BoardItem[]=[
 {title:"파트너는 가입 후 바로 참여할 수 있나요?",href:"/customer/faq",meta:"파트너 가입"},
 {title:"CPA 캠페인의 승인 수익은 언제 반영되나요?",href:"/customer/faq",meta:"수익·정산"},
 {title:"광고주는 캠페인을 어떻게 의뢰하나요?",href:"/customer/faq",meta:"광고주 안내"}
];
async function getItems(type:BoardType):Promise<BoardItem[]>{
 if(type==="faq")return faqs;
 if(type==="events")return [];
 try{
  if(type==="notices"){const rows=await getDb().select({id:customerNotices.id,title:customerNotices.title,createdAt:customerNotices.createdAt}).from(customerNotices).orderBy(desc(customerNotices.createdAt)).limit(4);return rows.map(x=>({title:x.title,href:"/customer#notice-"+x.id,meta:x.createdAt.toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})}));}
  const rows=await getDb().select({id:customerQna.id,title:customerQna.title,isSecret:customerQna.isSecret,status:customerQna.status,createdAt:customerQna.createdAt}).from(customerQna).orderBy(desc(customerQna.createdAt)).limit(4);
  return rows.map(x=>({title:x.isSecret?"비밀 문의":x.title,href:"/customer/qna/"+x.id,meta:x.createdAt.toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"}),tag:x.status==="ANSWERED"?"답변완료":"답변대기"}));
 }catch(error){console.error("Home board preview unavailable",type,error);return [];}
}
/** Shortcode-like reusable homepage board block; type controls the source and destination. */
export async function HomeBoardShortcode({type}:{type:BoardType}){
 const info=config[type],items=await getItems(type);
 return <article className="mp-board-widget"><header className="mp-board-widget-head"><span className="mp-board-widget-icon" aria-hidden="true">{info.icon}</span><div><h3>{info.title}</h3><p>{info.subtitle}</p></div><Link href={info.href} aria-label={info.title+" 전체 보기"}>더보기 <span aria-hidden="true">↗</span></Link></header><div className="mp-board-widget-list">{items.length?items.map((item,i)=><Link key={item.href+i} href={item.href} className="mp-board-widget-item"><span className="mp-board-widget-dot" aria-hidden="true"/><span className="mp-board-widget-title">{item.title}</span>{item.tag&&<small className="mp-board-widget-tag">{item.tag}</small>}<time>{item.meta}</time></Link>):<div className="mp-board-widget-empty">{type==="events"?"현재 공개된 이벤트가 없습니다.":"아직 등록된 게시글이 없습니다."}</div>}</div></article>;
}
export default function HomeBoardShortcodes(){return <section className="container mp-board-section"><div className="mp-board-section-head"><div><span>COMMUNITY & SUPPORT</span><h2>마이픽업 소식과 고객센터</h2><p>새로운 공지와 이벤트를 확인하고, 궁금한 내용을 빠르게 찾아보세요.</p></div><Link href="/customer">고객센터 바로가기 ↗</Link></div><div className="mp-board-widget-grid"><HomeBoardShortcode type="notices"/><HomeBoardShortcode type="faq"/><HomeBoardShortcode type="events"/><HomeBoardShortcode type="qna"/></div></section>}
