"use client";

import { FormEvent, useState } from "react";

export default function PostingReviewForm({ submissionId }: { submissionId: string }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const decision = String(form.get("decision") || "");
    const reason = String(form.get("reason") || "");
    const res = await fetch(`/api/admin/posting/${submissionId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, reason }),
    });
    const data = await res.json();
    setSaving(false);
    setMessage(data.ok ? "검수 결과가 저장되었습니다." : `처리 실패: ${data.error}`);
  }

  return <form onSubmit={submit} className="panel card form-card">
    <h3>검수 결과</h3>
    <div className="form-grid">
      <label>판정<select name="decision" defaultValue="APPROVED"><option value="APPROVED">승인</option><option value="REVISION_REQUESTED">수정요청</option><option value="REJECTED">거절</option></select></label>
      <label className="full">검수내용<textarea name="reason" rows={5} placeholder="수정요청 또는 거절 사유를 입력하세요." /></label>
    </div>
    {message && <p className="form-message">{message}</p>}
    <div className="form-actions"><button disabled={saving}>{saving ? "처리 중..." : "검수 결과 저장"}</button></div>
  </form>;
}
