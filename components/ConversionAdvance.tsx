"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";

const copy:Record<string,{button:string,confirm:string}>={RECEIVED:{button:"광고주 전달완료",confirm:"이 CPA 신청을 광고주에게 전달완료 처리하시겠습니까?"},DELIVERED:{button:"검수 시작",confirm:"광고주 검수를 시작하여 검수대기 상태로 변경하시겠습니까?"}};

export default function ConversionAdvance({id,status}:{id:string;status:string}){
  const[loading,setLoading]=useState(false),[completed,setCompleted]=useState(false),[uncertain,setUncertain]=useState(false),[message,setMessage]=useState("");const busy=useRef(false);
  const router=useRouter();const errors:Record<string,string>={NOT_ADVANCEABLE:"이미 다음 단계로 이동했거나 변경할 수 없는 상태입니다. 새로고침해 확인하세요.",UPDATE_FAILED:"다른 관리자가 먼저 상태를 변경했을 수 있습니다.",NOT_FOUND:"신청 정보를 찾을 수 없습니다.",INVALID_ID:"신청 식별자가 올바르지 않습니다.",INVALID_ORIGIN:"요청 출처를 확인할 수 없습니다. 관리자 페이지에서 다시 시도하세요."};const item=copy[status];if(!item)return null;
  async function advance(){if(busy.current||completed||uncertain)return;if(!window.confirm(item.confirm))return;if(busy.current||completed||uncertain)return;busy.current=true;setLoading(true);setMessage("");try{const res=await fetch(`/api/admin/conversions/${id}/advance`,{method:"POST"});const data=await res.json().catch(()=>{setUncertain(true);throw new Error("서버 응답이 불확실합니다. 중복 요청 방지를 위해 버튼을 잠갔습니다. 새로고침 후 상태를 확인하세요.")});if(!res.ok||!data.ok)throw new Error(errors[data.error]||data.error||"ADVANCE_FAILED");setCompleted(true);setMessage("상태가 변경되었습니다.");router.refresh();}catch(e){if(e instanceof TypeError){setUncertain(true);setMessage("네트워크 오류로 결과를 확인할 수 없습니다. 새로고침 후 상태를 확인하세요.");}else setMessage(`처리 실패: ${e instanceof Error?e.message:"UNKNOWN"}`)}finally{busy.current=false;setLoading(false)}}
  return <div><p className="muted">현재 단계가 완료된 경우에만 다음 단계로 이동하세요.</p><div className="form-actions"><button type="button" disabled={loading||completed||uncertain} onClick={advance}>{loading?"처리 중...":item.button}</button></div>{message&&<p className="form-message">{message}</p>}</div>;
}
