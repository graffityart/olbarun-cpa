"use client";
import {useState,type FormEvent} from "react";
import Link from "next/link";

export default function AdvertiserCpaRequestForm(){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;const form=event.currentTarget;
  const data=new FormData(form);setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/advertiser/cpa",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:data.get("name"),category:data.get("category"),description:data.get("description"),landingUrl:data.get("landingUrl")})});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error??"신청에 실패했습니다.");
   form.reset();setMessage("CPA 광고 신청이 접수되었습니다. 관리자 승인 전에는 공개되지 않습니다.");
  }catch(error){setMessage(error instanceof Error?error.message:"신청 처리 중 오류가 발생했습니다.");}
  finally{setBusy(false);}
 }
 return <section className="panel card"><h2>CPA 광고 등록 신청</h2><p>광고주가 직접 신청한 캠페인은 관리자 검수 후 운영 조건과 광고비를 확인하여 공개됩니다.</p><form onSubmit={submit} style={{display:"grid",gap:12,maxWidth:720}}><label>광고명<input name="name" maxLength={200} required placeholder="예: 무료 상담 신청 캠페인"/></label><label>광고 카테고리<input name="category" maxLength={80} placeholder="예: 상담·서비스"/></label><label>광고 상세 설명<textarea name="description" maxLength={10000} required rows={5} placeholder="광고 목적, 참여 방법, 전환 조건을 설명해 주세요."/></label><label>광고 랜딩 URL<input name="landingUrl" type="url" maxLength={2000} required placeholder="https://example.com"/></label><button type="submit" disabled={busy}>{busy?"신청 중…":"관리자 검수 요청"}</button><p role="status">{message}</p></form><p><Link href="/advertiser/campaigns">내 캠페인 목록으로 돌아가기</Link></p></section>;
}
