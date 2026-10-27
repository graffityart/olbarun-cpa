"use client";
import Link from "next/link";
import {useActionState,useState} from "react";
type State={message:string;answer?:string};
export default function CustomerAnswerForm({action,answer}:{action:(state:State,formData:FormData)=>Promise<State>;answer:string}){
  const [state,formAction,pending]=useActionState(action,{message:""});
  const [draft,setDraft]=useState(answer);
  const [confirmEdit,setConfirmEdit]=useState(false);
  const trimmed=draft.trim();
  const valid=trimmed.length>=2&&trimmed.length<=5000;
  const unchanged=Boolean(answer)&&trimmed===answer.trim();
  return <form action={formAction} aria-busy={pending} className="ac-answer" onSubmit={event=>{if(answer&&draft.trim()!==answer.trim()&&!confirmEdit){event.preventDefault();setConfirmEdit(true);}}}><label htmlFor="customer-answer">고객에게 표시할 답변</label><textarea id="customer-answer" name="answer" required minLength={2} maxLength={5000} rows={10} value={draft} onChange={event=>{setDraft(event.target.value);setConfirmEdit(false);}} disabled={pending} placeholder="문의 내용을 확인한 뒤 답변을 입력하세요."/><p className="muted" role="status">{trimmed.length.toLocaleString("ko-KR")} / 5,000자 · 2자 이상 입력하면 저장할 수 있습니다. 저장하면 답변 완료 상태로 변경됩니다.</p>{unchanged&&<p className="muted">현재 저장된 답변과 동일합니다. 변경한 내용이 있을 때만 저장할 수 있습니다.</p>}{confirmEdit&&<p role="alert" className="muted">기존 답변이 변경됩니다. 내용을 확인한 후 다시 저장 버튼을 눌러 주세요.</p>}{state.message&&<p className="ac-error" role="alert">{state.message}</p>}<div className="form-actions"><Link className="btn" href="/admin/customer">목록으로</Link><button type="submit" disabled={pending||!valid||unchanged}>{pending?"저장 중…":answer?"답변 수정 저장":"답변 등록"}</button></div></form>;
}
