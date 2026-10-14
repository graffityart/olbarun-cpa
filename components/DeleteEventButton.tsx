"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";

export default function DeleteEventButton({id,title}:{id:string;title:string}){
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [confirming,setConfirming]=useState(false);
 const [confirmation,setConfirmation]=useState("");
 const router=useRouter();
 async function remove(){
  if(busy||confirmation.trim()!==title)return;
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/admin/events/"+encodeURIComponent(id),{method:"DELETE"});
   const data=await response.json();
   if(!response.ok||!data.ok)throw new Error(data.error==="FORBIDDEN"?"관리자 권한이 없거나 로그인이 만료되었습니다.":data.error==="NOT_FOUND"?"이미 삭제되었거나 존재하지 않는 이벤트입니다.":"이벤트 삭제에 실패했습니다. 다시 시도해 주세요.");
   router.replace("/admin/events?deleted=1");
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"삭제에 실패했습니다.");setBusy(false);}
 }
 return <section style={{marginTop:24,paddingTop:20,borderTop:"1px solid #e2e8f0"}} aria-label="이벤트 삭제">
  {!confirming?<button type="button" disabled={busy} onClick={()=>setConfirming(true)} style={{background:"#fff",color:"#b42318",border:"1px solid #f1b6b1",borderRadius:10,padding:"10px 16px"}}>이벤트 삭제</button>:
  <div style={{display:"grid",gap:10,maxWidth:520}}>
   <strong>이벤트를 영구 삭제하시겠습니까?</strong>
   <p>삭제한 이벤트는 복구할 수 없습니다. 확인을 위해 아래에 이벤트 제목을 정확히 입력해 주세요.</p>
   <p style={{overflowWrap:"anywhere",fontWeight:600}}>{title}</p>
   <input aria-label="삭제할 이벤트 제목 확인" value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy} autoComplete="off" placeholder="이벤트 제목 입력" style={{padding:12,border:"1px solid #cbd5e1",borderRadius:10}}/>
   <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
    <button type="button" disabled={busy||confirmation.trim()!==title} onClick={remove} style={{background:"#b42318",color:"#fff",padding:"10px 16px",borderRadius:10}}>{busy?"삭제 중…":"영구 삭제 확인"}</button>
    <button type="button" disabled={busy} onClick={()=>{setConfirming(false);setConfirmation("");setError("");}}>취소</button>
   </div>
  </div>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
