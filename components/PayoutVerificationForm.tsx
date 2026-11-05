"use client";
import {useState,type FormEvent} from "react";
export default function PayoutVerificationForm({status}:{status:string}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const locked=status==="PENDING"||status==="APPROVED";
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage("");
  try{
   const data=new FormData(event.currentTarget);
   for(const key of ["bankDocument","identityDocument"]){const file=data.get(key);if(!(file instanceof File)||file.size<8||file.size>5*1024*1024)throw Error("서류 파일은 각각 5MB 이하로 선택해 주세요.");}
   const response=await fetch("/api/partner/payout-verification",{method:"POST",body:data});
   if(!response.ok){const result=await response.json().catch(()=>null);const errors:Record<string,string>={ALREADY_SUBMITTED:"이미 접수되었거나 승인된 서류가 있습니다. 화면을 새로고침해 주세요.",DOCUMENT_TYPE_MISMATCH:"회원 유형과 증빙 유형이 일치하지 않습니다.",FILE_SIZE_INVALID:"서류 파일은 각각 5MB 이하로 선택해 주세요.",FILE_TYPE_INVALID:"PDF, JPG, PNG 파일만 제출할 수 있습니다.",INVALID_INPUT:"증빙 유형과 첨부 파일을 확인해 주세요."};throw Error(errors[result?.error]??"서류 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.");}
   setMessage("서류가 접수되었습니다. 관리자 검수를 기다려 주세요.");window.location.reload();
  }catch(error){setMessage(error instanceof Error?error.message:"오류가 발생했습니다.");}finally{setBusy(false);}
 }
 return <section className="pf-panel"><h2>출금 본인확인 서류</h2><p>검수 상태: {status==="APPROVED"?"승인":status==="PENDING"?"검수 중":status==="REJECTED"?"반려":"미제출"}</p><p>주민등록번호 뒷자리 등 불필요한 정보는 가려 주세요. PDF, JPG, PNG 각 5MB 이하.</p>{!locked&&<form onSubmit={submit}><label>증빙 유형<select name="documentType"><option value="PERSONAL_ID">개인</option><option value="BUSINESS_REGISTRATION">사업자</option></select></label><label>통장 사본<input name="bankDocument" type="file" accept=".pdf,.jpg,.jpeg,.png" required/></label><label>본인확인 증빙<input name="identityDocument" type="file" accept=".pdf,.jpg,.jpeg,.png" required/></label><button type="submit" disabled={busy}>{busy?"제출 중…":"검수 요청"}</button></form>}{message&&<p role="status">{message}</p>}</section>;
}
