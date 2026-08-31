"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdvertiserConversionReview({ id, status }: { id: string; status: string }) {
  const [loading,setLoading]=useState(false); const [message,setMessage]=useState(""); const router=useRouter();
  async function act(decision:"APPROVE_REQUEST"|"REJECT_REQUEST") { const reason=decision==="REJECT_REQUEST" ? window.prompt("거절 요청 사유를 입력하세요.") : ""; if(decision==="REJECT_REQUEST"&&!reason)return; setLoading(true); const res=await fetch(`/api/advertiser/conversions/${id}/review`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({decision,reason})}); const data=await res.json(); setLoading(false); setMessage(data.ok?"요청이 접수되었습니다.":`처리 실패: ${data.error}`); if(data.ok)router.refresh(); }
  if(["APPROVED","REJECTED","REJECTION_REQUESTED"].includes(status)) return <span className="muted">처리완료</span>;
  return <div className="inline-actions"><button className="secondary" disabled={loading} onClick={()=>act("REJECT_REQUEST")}>거절요청</button><button disabled={loading} onClick={()=>act("APPROVE_REQUEST")}>승인요청</button>{message&&<small>{message}</small>}</div>;
}
