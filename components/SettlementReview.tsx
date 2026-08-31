"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SettlementReview({ id, status }: { id: string; status: string }) {
  const [message,setMessage]=useState(""); const [loading,setLoading]=useState(false); const router=useRouter();
  async function act(action:"APPROVE"|"PAID"|"REJECT") { setLoading(true); setMessage(""); const res=await fetch(`/api/admin/settlements/${id}/review`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action})}); const data=await res.json(); setLoading(false); if(data.ok){setMessage("처리되었습니다.");router.refresh();}else setMessage(`처리 실패: ${data.error}`); }
  return <div>{status==="REQUESTED"&&<div className="form-actions"><button className="secondary" disabled={loading} onClick={()=>act("REJECT")}>반려</button><button disabled={loading} onClick={()=>act("APPROVE")}>승인</button></div>}{status==="APPROVED"&&<div className="form-actions"><button disabled={loading} onClick={()=>act("PAID")}>지급완료</button></div>}{["PAID","REJECTED"].includes(status)&&<p className="muted">최종 처리된 정산입니다.</p>}{message&&<p className="form-message">{message}</p>}</div>;
}
