"use client";
import {useState,type FormEvent} from "react";
export default function PayoutVerificationForm({status}:{status:string}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const locked=status==="PENDING"||status==="APPROVED";
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/partner/payout-verification",{method:"POST",body:new FormData(event.currentTarget)});
   if(!response.ok)throw Error("서류 접수에 실패했습니다.");
   setMessage("서류가 접수되었습니다. 관리자 검수를 기다려 주세요.");window.location.reload();
  }catch(error){setMessage(error instanceof Error?error.message:"오류가 발생했습니다.");}finally{setBusy(false);}
 }
 return <section className="pf-panel"><h2>출금 본인확인 서류</h2><p>검수 상태: {status==="APPROVED"?"승인":status==="PENDING"?"검수 중":status==="REJECTED"?"반려":"미제출"}</p><p>주민등록번호 뒷자리 등 불필요한 정보는 가려 주세요. PDF, JPG, PNG 각 5MB 이하.</p>{!locked&&<form onSubmit={submit}><label>증빙 유형<select name="documentType"><option value="PERSONAL_ID">개인</option><option value="BUSINESS_REGISTRATION">사업자</option></select></label><label>통장 사본<input name="bankDocument" type="file" accept=".pdf,.jpg,.jpeg,.png" required/></label><label>본인확인 증빙<input name="identityDocument" type="file" accept=".pdf,.jpg,.jpeg,.png" required/></label><button type="submit" disabled={busy}>{busy?"제출 중…":"검수 요청"}</button></form>}{message&&<p role="status">{message}</p>}</section>;
}
