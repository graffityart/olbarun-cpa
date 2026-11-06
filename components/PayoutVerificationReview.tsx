"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
export default function PayoutVerificationReview({partnerId}:{partnerId:string}){
 const router=useRouter(),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[matched,setMatched]=useState(false),[masked,setMasked]=useState(false);
 async function review(decision:"APPROVED"|"REJECTED"){
  if(busy)return;if(decision==="REJECTED"&&!reason.trim()){setMessage("반려 사유를 입력해 주세요.");return;}
  if(decision==="APPROVED"&&!matched){setMessage("서류의 이름과 계좌 예금주가 일치하는지 확인한 후 체크해 주세요.");return;}if(decision==="APPROVED"&&!masked){setMessage("개인정보 가림 여부를 확인해 주세요.");return;}if(decision==="APPROVED"&&!window.confirm("통장 및 신분확인 서류를 직접 확인했으며 명의가 일치합니까?"))return;
  setBusy(true);setMessage("");
  try{
   const res=await fetch(`/api/admin/payout-verifications/${partnerId}/review`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision,reason,identityAndBankMatch:decision==="APPROVED"?matched:undefined,sensitiveDataMasked:decision==="APPROVED"?masked:undefined})});
   if(!res.ok){const result=await res.json().catch(()=>null);throw Error(result?.error==="DOCUMENT_REVIEW_REQUIRED"?"현재 제출 건의 통장 사본과 신분확인 서류를 모두 열람한 후 승인해 주세요.":"검수 처리에 실패했습니다.");}setMessage(decision==="APPROVED"?"승인되었습니다.":"반려되었습니다.");router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:"오류가 발생했습니다.");}finally{setBusy(false);}
 }
 return <div style={{display:"grid",gap:8}}><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><a href={`/api/admin/payout-verifications/${partnerId}/documents/bank`}>통장 사본 확인</a><a href={`/api/admin/payout-verifications/${partnerId}/documents/identity`}>신분확인 서류 확인</a></div><label style={{display:"flex",gap:8,alignItems:"flex-start"}}><input type="checkbox" checked={matched} onChange={e=>setMatched(e.target.checked)}/>통장 예금주와 신분확인 증빙의 명의가 일치함을 직접 확인했습니다.</label><label style={{display:"flex",gap:8,alignItems:"flex-start"}}><input type="checkbox" checked={masked} onChange={e=>setMasked(e.target.checked)}/>제출 서류의 불필요한 개인정보가 가려졌음을 확인했습니다.</label><input aria-label="반려 사유" value={reason} onChange={e=>setReason(e.target.value)} placeholder="반려 사유 (반려 시 필수)" maxLength={2000}/><div style={{display:"flex",gap:8}}><button disabled={busy} onClick={()=>void review("APPROVED")}>검수 승인</button><button disabled={busy} onClick={()=>void review("REJECTED")}>반려</button></div>{message&&<p role="status">{message}</p>}</div>;
}
