"use client";
import Link from "next/link";
import {useActionState} from "react";
type State={message:string;answer?:string};
export default function CustomerAnswerForm({action,answer}:{action:(state:State,formData:FormData)=>Promise<State>;answer:string}){
  const [state,formAction,pending]=useActionState(action,{message:""});
  return <form action={formAction} aria-busy={pending} className="ac-answer"><label htmlFor="customer-answer">고객에게 표시할 답변</label><textarea id="customer-answer" name="answer" required minLength={2} maxLength={5000} rows={10} defaultValue={state.answer??answer} placeholder="문의 내용을 확인한 뒤 답변을 입력하세요."/><p className="muted">2~5,000자 · 저장하면 답변 완료 상태로 변경됩니다.</p>{state.message&&<p className="ac-error" role="alert">{state.message}</p>}<div className="form-actions"><Link className="btn" href="/admin/customer">목록으로</Link><button type="submit" disabled={pending}>{pending?"저장 중…":answer?"답변 수정 저장":"답변 등록"}</button></div></form>;
}
