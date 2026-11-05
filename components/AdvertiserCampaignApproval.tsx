"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
export default function AdvertiserCampaignApproval({id,type}:{id:string;type:"CPA"|"POSTING"}){
 const router=useRouter(),[busy,setBusy]=useState(false),[note,setNote]=useState(""),[message,setMessage]=useState("");
 async function decide(decision:"APPROVED"|"REJECTED"){
  if(busy)return;if(decision==="REJECTED"&&!note.trim()){setMessage("반려 사유를 입력해 주세요.");return;}
  setBusy(true);setMessage("");
  try{
   const path=type==="CPA"?"advertiser-approval":"posting-approval";
   const response=await fetch(`/api/admin/campaigns/${id}/${path}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision,note})});
   const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error??"처리에 실패했습니다.");
   setMessage(decision==="APPROVED"?"검수 승인 완료. 광고비 및 단가 확인 후 별도로 공개해 주세요.":"반려 처리되었습니다.");router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:"처리 중 오류가 발생했습니다.");}finally{setBusy(false);}
 }
 return <div style={{display:"grid",gap:8}}><label>검수 메모<input aria-label="검수 메모 또는 반려 사유" value={note} onChange={e=>setNote(e.target.value)} maxLength={2000} placeholder="반려 시 사유 필수"/></label><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button disabled={busy} onClick={()=>void decide("APPROVED")}>승인</button><button disabled={busy} onClick={()=>void decide("REJECTED")}>반려</button></div>{message&&<p role="status">{message}</p>}</div>;
}
