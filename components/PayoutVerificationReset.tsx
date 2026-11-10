"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
export default function PayoutVerificationReset({partnerId}:{partnerId:string}){
 const router=useRouter();
 const [reason,setReason]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function reset(){
  if(busy)return;
  if(!reason.trim()){setMessage("계좌 변경 재검수 사유를 입력해 주세요.");return;}
  if(!window.confirm("승인된 계좌 인증을 해제하고 새 서류 제출을 허용하시겠습니까? 진행 중인 출금이 있으면 거부됩니다."))return;
  setBusy(true);setMessage("");
  try{
   const res=await fetch(`/api/admin/payout-verifications/${partnerId}/reset`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reason})});
   if(!res.ok){const data=await res.json().catch(()=>null);const errors:Record<string,string>={PAYOUT_IN_PROGRESS:"진행 중인 출금 신청이 있어 계좌 인증을 해제할 수 없습니다.",NOT_APPROVED:"이미 계좌 검수 상태가 변경되었습니다.",INVALID_INPUT:"재검수 사유를 확인해 주세요."};throw Error(errors[data?.error]??"재검수 요청을 처리하지 못했습니다.");}
   setMessage("기존 계좌 승인이 해제되었습니다. 파트너가 새 서류를 제출할 수 있습니다.");router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:"오류가 발생했습니다.");}finally{setBusy(false);}
 }
 return <div style={{display:"grid",gap:8,minWidth:220}}><input aria-label="계좌 변경 재검수 사유" value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000} placeholder="계좌 변경 재검수 사유"/><button type="button" disabled={busy} onClick={()=>void reset()}>{busy?"처리 중…":"계좌 변경 재검수 허용"}</button>{message&&<p role="status">{message}</p>}</div>;
}
