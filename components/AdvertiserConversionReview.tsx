"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const stateCopy:Record<string,string>={RECEIVED:"전달 대기",REVIEWING:"승인 검수 중",REJECTION_REQUESTED:"거절 검수 중",APPROVED:"승인 완료",REJECTED:"거절 완료",DISPUTED:"이의 처리 중",CANCELLED:"취소",TEST:"테스트"};
export default function AdvertiserConversionReview({ id, status }: { id: string; status: string }) {
  const [loading,setLoading]=useState(false); const [message,setMessage]=useState(""); const router=useRouter();
  async function act(decision:"APPROVE_REQUEST"|"REJECT_REQUEST") { const reason=decision==="REJECT_REQUEST" ? window.prompt("거절 요청 사유를 입력하세요.") : ""; if(decision==="REJECT_REQUEST"&&!reason)return;const confirmText=decision==="APPROVE_REQUEST"?"이 DB를 승인 요청하시겠습니까? 관리자 최종 승인 후 광고비가 차감됩니다.":"이 DB의 거절 검수를 요청하시겠습니까?";if(!window.confirm(confirmText))return;setLoading(true);setMessage("");try{const res=await fetch(`/api/advertiser/conversions/${id}/review`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({decision,reason})});const data=await res.json();if(!res.ok||!data.ok)throw new Error(data.error||"REVIEW_REQUEST_FAILED");setMessage("검수 요청이 접수되었습니다.");router.refresh();}catch(e){setMessage(`처리 실패: ${e instanceof Error?e.message:"UNKNOWN"}`)}finally{setLoading(false)}}
  if(status!=="DELIVERED") return <span className="muted">{stateCopy[status]??"처리 불가"}</span>;
  return <div className="inline-actions"><button className="secondary" disabled={loading} onClick={()=>act("REJECT_REQUEST")}>거절요청</button><button disabled={loading} onClick={()=>act("APPROVE_REQUEST")}>{loading?"처리 중...":"승인요청"}</button>{message&&<small>{message}</small>}</div>;
}
