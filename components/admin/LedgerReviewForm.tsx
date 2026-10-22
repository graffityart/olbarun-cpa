"use client";
import { useState } from "react";

export default function LedgerReviewForm({ conversionId }: { conversionId: string }) {
  const [status, setStatus] = useState("IN_REVIEW");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (status === "RESOLVED" && !note.trim()) { setMessage("검토 완료 시 처리 근거를 입력해 주세요."); return; }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/ledger/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ conversionId, status, note }),
      });
      if (!response.ok) throw new Error("검토 기록을 저장하지 못했습니다.");
      setMessage("저장되었습니다.");
      setNote("");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장 오류");
    } finally {
      setBusy(false);
    }
  }
  return <form onSubmit={submit} style={{display:"grid",gap:6,minWidth:180}}>
    <select aria-label="검토 상태" value={status} onChange={event=>setStatus(event.target.value)}>
      <option value="IN_REVIEW">검토 중</option>
      <option value="RESOLVED">검토 완료</option>
      <option value="REOPENED">재검토</option>
    </select>
    <input aria-label="검토 메모" placeholder="검토 메모 (선택)" maxLength={1000} value={note} onChange={event=>setNote(event.target.value)}/>
    <button type="submit" disabled={busy}>{busy?"저장 중":"검토 기록 저장"}</button>
    {message?<small role="status">{message}</small>:null}
  </form>;
}
