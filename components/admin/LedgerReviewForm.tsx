"use client";
import { useRef, useState } from "react";

export default function LedgerReviewForm({ conversionId }: { conversionId: string }) {
  const [status, setStatus] = useState("IN_REVIEW");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const submitting = useRef(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || uncertain) return;
    if (status === "RESOLVED" && !note.trim()) { setMessage("검토 완료 시 처리 근거를 입력해 주세요."); return; }
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/ledger/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ conversionId, status, note }),
      });
      if (response.status >= 500) { setUncertain(true); throw new Error("서버 오류로 저장 결과를 확인할 수 없습니다. 다시 제출하지 말고 새로고침 후 검토 이력을 확인하세요."); }
      if (!response.ok) { const result = await response.json().catch(() => null); throw new Error(result?.error === "Resolution note required" ? "검토 완료 시 처리 근거를 입력해 주세요." : "검토 기록을 저장하지 못했습니다."); }
      setMessage("저장되었습니다.");
      setNote("");
      window.location.reload();
    } catch (error) {
      if (error instanceof TypeError) { setUncertain(true); setMessage("네트워크 오류로 저장 여부를 확인할 수 없습니다. 새로고침 후 검토 이력을 확인하세요."); }
      else setMessage(error instanceof Error ? error.message : "저장 오류");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return <form onSubmit={submit} style={{display:"grid",gap:6,minWidth:180}}>
    <select aria-label="검토 상태" value={status} onChange={event=>setStatus(event.target.value)}>
      <option value="IN_REVIEW">검토 중</option>
      <option value="RESOLVED">검토 완료</option>
      <option value="REOPENED">재검토</option>
    </select>
    <textarea aria-label="검토 메모" placeholder={status==="RESOLVED"?"처리 근거를 입력해 주세요 (필수)":"검토 메모 (선택)"} rows={3} required={status==="RESOLVED"} maxLength={1000} value={note} onChange={event=>setNote(event.target.value)}/>
    <small style={{opacity:.75}}>검토 완료는 정산 장부의 자동 수정이 아닙니다.</small>
    <button type="submit" disabled={busy || uncertain}>{busy?"저장 중":"검토 기록 저장"}</button>
    {message?<small role="status">{message}</small>:null}
    {uncertain?<button type="button" onClick={()=>window.location.reload()}>검토 이력 새로고침</button>:null}
  </form>;
}
