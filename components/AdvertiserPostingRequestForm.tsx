"use client";
import {useState,type FormEvent} from "react";
import Link from "next/link";
export default function AdvertiserPostingRequestForm(){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;const form=event.currentTarget;const data=new FormData(form);setBusy(true);setMessage("");
  try{
   const body={name:data.get("name"),category:data.get("category"),description:data.get("description"),mediaType:data.get("mediaType"),targetUrl:data.get("targetUrl"),instructions:data.get("instructions"),requiredKeywords:data.get("requiredKeywords"),notice:data.get("notice"),participantLimit:data.get("participantLimit"),totalSubmissionLimit:data.get("totalSubmissionLimit"),perPartnerLimit:data.get("perPartnerLimit"),postingReviewDays:data.get("postingReviewDays"),revisionLimit:data.get("revisionLimit")};
   const response=await fetch("/api/advertiser/posting/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   const result=await response.json().catch(()=>({}));if(!response.ok)throw Error(result.error??"등록 신청에 실패했습니다.");
   form.reset();setMessage("포스팅 광고가 접수되었습니다. 관리자 승인과 광고비 확인 전에는 공개되지 않습니다.");
  }catch(error){setMessage(error instanceof Error?error.message:"등록 중 오류가 발생했습니다.");}finally{setBusy(false);}
 }
 return <section className="panel card"><h2>포스팅알바 광고 등록</h2><p>게시 조건과 검수 기준을 입력해 주세요. 광고주 신청 건은 관리자 승인 전까지 비공개입니다.</p><form onSubmit={submit} style={{display:"grid",gap:12,maxWidth:740}}>
 <label>광고명<input name="name" maxLength={200} required placeholder="예: 블로그 후기 작성"/></label>
 <label>매체 유형<select name="mediaType"><option value="BLOG">블로그</option><option value="CAFE">카페</option><option value="SNS">SNS</option><option value="OTHER">기타</option></select></label>
 <label>카테고리<input name="category" maxLength={80} placeholder="예: 생활 서비스"/></label>
 <label>광고 소개<textarea name="description" maxLength={10000} required rows={3}/></label>
 <label>참고 URL<input name="targetUrl" type="url" maxLength={2000} placeholder="https://example.com"/></label>
 <label>게시물 작성 가이드<textarea name="instructions" maxLength={10000} required rows={5} placeholder="글 구성, 이미지 사용법, 필수 안내 사항"/></label>
 <label>필수 키워드<textarea name="requiredKeywords" maxLength={2000} rows={2} placeholder="예: 부산철거, 상가철거"/></label>
 <label>유의사항<textarea name="notice" maxLength={10000} rows={2} placeholder="금지 표현, 게시 유지 조건 등"/></label>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12}}>
 <label>모집 인원<input name="participantLimit" type="number" min="1" placeholder="제한 없음"/></label>
 <label>전체 제출 한도<input name="totalSubmissionLimit" type="number" min="1" placeholder="제한 없음"/></label>
 <label>1인 최대 제출<input name="perPartnerLimit" type="number" min="1" defaultValue="1" required/></label>
 <label>검수 기한(일)<input name="postingReviewDays" type="number" min="1" defaultValue="3" required/></label>
 <label>수정 요청 횟수<input name="revisionLimit" type="number" min="0" defaultValue="2" required/></label></div>
 <button type="submit" disabled={busy}>{busy?"신청 중…":"관리자 검수 요청"}</button><p role="status">{message}</p></form><p><Link href="/advertiser/campaigns">내 캠페인 목록</Link></p></section>;
}
