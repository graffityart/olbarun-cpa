"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
export default function PayoutVerificationReview({partnerId}:{partnerId:string}){
 const router=useRouter(),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[matched,setMatched]=useState(false),[masked,setMasked]=useState(false);
 async function review(decision:"APPROVED"|"REJECTED"){
  if(busy)return;if(decision==="REJECTED"&&!reason.trim()){setMessage("반려 사유를 입력해 주세요.");return;}
  if(decision==="APPROVED"&&!matched){setMessage("서류의 이름과 계좌 예금주가 일치하는지 확인한 후 체크해 주세요.");return;}if(decision==="APPROVED"&&!masked){setMessage("개인정보 가림 여부를 확인해 주세요.");return;}if(decision==="APPROVED"&&!window.confirm("통장·신분확인 서류의 명의 일치와 개인정보 가림을 모두 확인했습니까? 개인정보가 노출된 서류는 승인하지 말고 반려해 주세요."))return;
  if(decision==="REJECTED"&&!window.confirm("이 신청을 반려하시겠습니까? 입력한 반려 사유가 파트너에게 안내됩니다."))return;
  setBusy(true);setMessage("");
  try{
   const res=await fetch(`/api/admin/payout-verifications/${partnerId}/review`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision,reason:decision==="REJECTED"?reason.trim():undefined,identityAndBankMatch:decision==="APPROVED"?matched:undefined,sensitiveDataMasked:decision==="APPROVED"?masked:undefined})});
   if(!res.ok){const result=await res.json().catch(()=>null);const errors:Record<string,string>={INVALID_INPUT:"검수 입력 내용을 확인해 주세요. 반려 사유는 2,000자 이내로 작성해야 합니다.",DOCUMENT_REVIEW_REQUIRED:"현재 제출 건의 통장 사본과 신분확인 서류를 모두 열람한 후 승인해 주세요.",PRIVACY_MASK_REVIEW_REQUIRED:"서류의 개인정보 가림 여부를 확인해야 승인할 수 있습니다.",IDENTITY_MATCH_CONFIRMATION_REQUIRED:"예금주와 본인 명의 일치 여부를 확인해야 승인할 수 있습니다.",NOT_PENDING:"이미 처리되었거나 재제출된 건입니다. 목록을 새로고침해 주세요.",DOCUMENT_REVIEW_UNAVAILABLE:"현재 본인확인 검수 기능을 사용할 수 없습니다.",REVIEW_PAYLOAD_TOO_LARGE:"검수 요청 내용이 너무 깁니다.",INVALID_CONTENT_TYPE:"검수 요청 형식이 올바르지 않습니다."};throw Error(errors[result?.error]??"검수 처리에 실패했습니다.");}setReason("");setMatched(false);setMasked(false);setMessage(decision==="APPROVED"?"승인되었습니다.":"반려되었습니다.");router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:"오류가 발생했습니다.");}finally{setBusy(false);}
 }
 return <div style={{display:"grid",gap:8}}><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><a href={`/api/admin/payout-verifications/${partnerId}/documents/bank`}>통장 사본 확인</a><a href={`/api/admin/payout-verifications/${partnerId}/documents/identity`}>신분확인 서류 확인</a></div><label style={{display:"flex",gap:8,alignItems:"flex-start"}}><input type="checkbox" checked={matched} onChange={e=>setMatched(e.target.checked)}/>통장 예금주와 신분확인 증빙의 명의가 일치함을 직접 확인했습니다.</label><label style={{display:"flex",gap:8,alignItems:"flex-start"}}><input type="checkbox" checked={masked} onChange={e=>setMasked(e.target.checked)}/>제출 서류의 불필요한 개인정보가 가려졌음을 확인했습니다.</label><label style={{display:"grid",gap:4}}>반려 사유<input aria-label="반려 사유" value={reason} onChange={e=>setReason(e.target.value)} placeholder="예: 주민등록번호 뒷자리를 가린 서류로 다시 제출해 주세요." maxLength={2000}/><span style={{fontSize:12,color:"#64748b"}}>반려 사유에는 주민등록번호·계좌번호 등 개인정보를 입력하지 마세요. 반려 시에만 전달됩니다.</span></label><div style={{display:"flex",gap:8}}><button disabled={busy} onClick={()=>void review("APPROVED")}>검수 승인</button><button disabled={busy} onClick={()=>void review("REJECTED")}>반려</button></div>{message&&<p role="status">{message}</p>}</div>;
}
