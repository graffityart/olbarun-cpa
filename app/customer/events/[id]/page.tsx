import {eventDisplayStatus} from "@/lib/event-display-status";
import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import CustomerBoardNav from "@/components/CustomerBoardNav";
import {getPublicEvent} from "@/lib/customer-events";
export const dynamic="force-dynamic";
type Props={params:Promise<{id:string}>};
const format=(date:Date|string|null)=>date?new Date(date).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul",year:"numeric",month:"long",day:"numeric"}):"미정";
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {id}=await params;
 const event=await getPublicEvent(id);
 if(!event)return {title:"이벤트를 찾을 수 없습니다 | 마이픽업",robots:{index:false,follow:false}};
 const description=event.content.replace(/\s+/g," ").slice(0,150);
 return {title:event.title+" | 마이픽업 이벤트",description,alternates:{canonical:"/customer/events/"+id},openGraph:{title:event.title,description,type:"article",url:"/customer/events/"+id}};
}
export default async function Page({params}:Props){
 const {id}=await params;
 const event=await getPublicEvent(id);
 if(!event)notFound();
 return <main className="customer-page">
 <section className="customer-head"><div className="container"><span>MY PICKUP EVENTS</span><h1>이벤트 안내</h1><p>마이픽업에서 진행하는 이벤트를 확인하세요.</p></div></section>
 <CustomerBoardNav current="/customer/events"/>
 <section className="customer-content container">
 <article className="panel card" style={{padding:"clamp(20px,4vw,40px)",maxWidth:960,margin:"0 auto"}}>
 <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
 <span style={{borderRadius:99,background:eventDisplayStatus(event)==="진행중"?"#e9f4ff":"#f1f5f9",color:eventDisplayStatus(event)==="진행중"?"#1453aa":"#475569",padding:"5px 12px",fontSize:13,fontWeight:700}}>{eventDisplayStatus(event)}</span>
 <span style={{fontSize:13,color:"#64748b"}}>등록 {format(event.createdAt)} · 조회 {Number(event.viewCount).toLocaleString("ko-KR")}</span>
 </div>
 <h2 style={{fontSize:"clamp(24px,4vw,34px)",lineHeight:1.35,overflowWrap:"anywhere",margin:"0 0 20px"}}>{event.title}</h2>
 {(event.startsAt||event.endsAt)&&<div style={{background:"#f5f8fd",borderRadius:12,padding:"14px 18px",fontSize:14,marginBottom:28}}><strong>이벤트 기간</strong><p style={{margin:"7px 0 0",color:"#475569"}}>{format(event.startsAt)} ~ {format(event.endsAt)}</p></div>}
 <div style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",lineHeight:1.9,fontSize:16}}>{event.content}</div>
 </article>
 <div style={{maxWidth:960,margin:"24px auto"}}><Link className="btn" href="/customer/events">← 이벤트 목록</Link></div>
 </section></main>;
}
