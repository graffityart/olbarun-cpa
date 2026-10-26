"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const errorMessages: Record<string, string> = {
  INVALID_ID: "잘못된 제출 번호입니다.",
  INVALID_JSON: "요청 형식이 올바르지 않습니다. 새로고침 후 다시 시도해 주세요.",
  REASON_TOO_LONG: "검수 사유는 2,000자 이내로 입력해 주세요.",
  INVALID_DECISION: "검수 판정을 다시 선택해 주세요.",
  REASON_REQUIRED: "수정 요청 또는 거절 사유를 입력해 주세요.",
  NOT_REVIEWABLE: "이미 검수가 완료되었거나 검수할 수 없는 상태입니다. 화면을 새로고침해 주세요.",
  REVISION_LIMIT: "허용된 수정 요청 횟수를 초과했습니다.",
  RATE_NOT_READY: "광고 단가가 설정되지 않았거나 유효하지 않습니다. 캠페인 단가를 확인해 주세요.",
  ADVERTISER_BALANCE_INSUFFICIENT: "광고주 예치금이 부족하여 승인할 수 없습니다.",
  FINANCE_ALREADY_POSTED: "이미 정산 처리된 제출 건입니다. 화면을 새로고침해 주세요.",
  SUBMISSION_NOT_FOUND: "제출 내역을 찾을 수 없습니다.",
  INVALID_ORIGIN: "요청 출처를 확인할 수 없습니다. 페이지를 새로고침해 주세요.",
  REVIEW_FAILED: "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
};

export default function PostingReviewForm({ submissionId, approvalEnabled = true, approvalDisabledReason = "", revisionEnabled = true }: { submissionId: string; approvalEnabled?: boolean; approvalDisabledReason?: string; revisionEnabled?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || success) return;
    const form = new FormData(event.currentTarget);
    const decision = String(form.get("decision") || "");
    const reason = String(form.get("reason") || "").trim();
    if (decision === "APPROVED" && !approvalEnabled) {
      setMessage(approvalDisabledReason || "현재 승인할 수 없습니다.");
      return;
    }
    if (decision === "REVISION_REQUESTED" && !revisionEnabled) { setMessage(errorMessages.REVISION_LIMIT); return; }
    if (reason.length > 2000) { setMessage(errorMessages.REASON_TOO_LONG); return; }
    if (decision !== "APPROVED" && !reason) {
      setMessage(errorMessages.REASON_REQUIRED);
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/posting/${submissionId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, reason }),
      });
      const data: { ok?: boolean; error?: string; alreadyProcessed?: boolean } = await res.json();
      if (!res.ok || !data.ok) {
        setMessage(errorMessages[data.error ?? ""] ?? "검수 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setSuccess(true);
      setMessage(data.alreadyProcessed ? "이미 동일한 검수 결과가 처리되어 있습니다. 중복 정산 없이 화면을 갱신합니다." : "검수 결과가 저장되었습니다. 화면 정보를 갱신합니다.");
      router.refresh();
    } catch {
      setMessage("네트워크 오류가 발생했습니다. 처리 상태를 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return <form onSubmit={submit} className="panel card form-card">
    <h3>검수 결과</h3>
    <div className="form-grid">
      <label>판정<select name="decision" defaultValue={approvalEnabled ? "APPROVED" : revisionEnabled ? "REVISION_REQUESTED" : "REJECTED"} disabled={saving || success}><option value="APPROVED" disabled={!approvalEnabled}>승인</option><option value="REVISION_REQUESTED" disabled={!revisionEnabled}>수정요청</option><option value="REJECTED">거절</option></select></label>
      <label className="full">검수내용<textarea name="reason" rows={5} maxLength={2000} disabled={saving || success} placeholder="수정요청 또는 거절 사유를 입력하세요." /></label>
    </div>
    {!approvalEnabled && <p className="form-message" role="status">승인 불가: {approvalDisabledReason} {revisionEnabled ? "수정 요청이나 거절은 가능합니다." : "수정 요청 횟수가 소진되어 거절만 가능합니다."}</p>}
    {message && <p className="form-message" role="status" aria-live="polite">{message}</p>}
    <div className="form-actions"><button disabled={saving || success}>{saving ? "처리 중..." : success ? "처리 완료" : "검수 결과 저장"}</button></div>
  </form>;
}
