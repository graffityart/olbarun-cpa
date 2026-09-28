"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";

const copy:Record<string,{button:string,confirm:string}>={RECEIVED:{button:"광고주 전달완료",confirm:"이 CPA 신청을 광고주에게 전달완료 처리하시겠습니까?"},DELIVERED:{button:"검수 시작",confirm:"광고주 검수를 시작하여 검수대기 상태로 변경하시겠습니까?"}};

export default function ConversionAdvance({id,status}:{id:string;status:string}){
  const[loading,setLoading]=useState(false),[message,setMessage]=useState("");
  const router=useRouter();const item=copy[status];if(!item)return null;
  async function advance(){if(!window.confirm(item.confirm))return;setLoading(true);setMessage("");try{const res=await fetch(`/api/admin/conversions/${id}/advance`,{method:"POST"});const data=await res.json();if(!res.ok||!data.ok)throw new Error(data.error||"ADVANCE_FAILED");setMessage("상태가 변경되었습니다.");router.refresh();}catch(e){setMessage(`처리 실패: ${e instanceof Error?e.message:"UNKNOWN"}`)}finally{setLoading(false)}}
  return <div><p className="muted">현재 단계가 완료된 경우에만 다음 단계로 이동하세요.</p><div className="form-actions"><button type="button" disabled={loading} onClick={advance}>{loading?"처리 중...":item.button}</button></div>{message&&<p className="form-message">{message}</p>}</div>;
}
