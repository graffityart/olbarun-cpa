"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function ConversionReview({ id, final }: { id: string; final: boolean }) { const [loading,setLoading]=useState(false); const [message,setMessage]=useState(""); const router=useRouter();
  async function review(decision:"APPROVED"|"REJECTED") { setLoading(true); const res=await fetch(`/api/admin/conversions/${id}/review`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({decision})}); const data=await res.json(); setLoading(false); if(data.ok){setMessage(decision==="APPROVED"?"승인 처리되었습니다.":"거절 처리되었습니다."); router.refresh();} else setMessage(`처리 실패: ${data.error}`); }
  if(final) return <p className="muted">최종 처리된 DB입니다.</p>;
  return <div><div className="form-actions"><button className="secondary" disabled={loading} onClick={()=>review("REJECTED")}>거절</button><button disabled={loading} onClick={()=>review("APPROVED")}>승인</button></div>{message&&<p className="form-message">{message}</p>}</div>;
}
