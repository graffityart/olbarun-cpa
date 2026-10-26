"use client";

import { FormEvent, useRef, useState } from "react";
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
  ORIGIN_CHECK_FAILED: "요청 출처 검증에 실패했습니다. 페이지를 새로고침해 주세요.",
  REVIEW_FAILED: "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
};

export default function PostingReviewForm({ submissionId, approvalEnabled = true, approvalDisabledReason = "", revisionEnabled = true }: { submissionId: string; approvalEnabled?: boolean; approvalDisabledReason?: string; revisionEnabled?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [completedDecision, setCompletedDecision] = useState("");
  const [saving, setSaving] = useState(false);
  const [decision, setDecision] = useState(approvalEnabled ? "APPROVED" : revisionEnabled ? "REVISION_REQUESTED" : "REJECTED");
  const [pendingReview, setPendingReview] = useState<{decision:string;reason:string}|null>(null);
  const inFlight = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || success) return;
    const form = new FormData(event.currentTarget);
    const selectedDecision = String(form.get("decision") || "");
    const reason = String(form.get("reason") || "").trim();
    if (selectedDecision === "APPROVED" && !approvalEnabled) {
      setMessage(approvalDisabledReason || "현재 승인할 수 없습니다.");
      return;
    }
    if (selectedDecision === "REVISION_REQUESTED" && !revisionEnabled) { setMessage(errorMessages.REVISION_LIMIT); return; }
    if (reason.length > 2000) { setMessage(errorMessages.REASON_TOO_LONG); return; }
    if (selectedDecision !== "APPROVED" && !reason) {
      setMessage(errorMessages.REASON_REQUIRED);
      return;
    }
    if (!pendingReview || pendingReview.decision !== selectedDecision || pendingReview.reason !== reason) {
      setPendingReview({ decision: selectedDecision, reason });
      setMessage("아래 최종 확인 내용을 검토한 뒤 확정 버튼을 눌러 주세요.");
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/posting/${submissionId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: selectedDecision, reason }),
      });
      const data: { ok?: boolean; error?: string; alreadyProcessed?: boolean } = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setMessage(errorMessages[data.error ?? ""] ?? (res.status === 401 || res.status === 403 ? "로그인 상태 또는 접근 권한을 확인한 뒤 다시 시도해 주세요." : res.status === 429 ? "요청이 많습니다. 잠시 후 다시 시도해 주세요." : res.status >= 500 ? "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." : "검수 처리에 실패했습니다. 화면을 새로고침한 뒤 다시 시도해 주세요."));
        return;
      }
      setSuccess(true);
      setCompletedDecision(selectedDecision);
      const resultLabel = selectedDecision === "APPROVED" ? "승인" : selectedDecision === "REVISION_REQUESTED" ? "수정 요청" : "거절";
      setMessage(data.alreadyProcessed ? `이미 ${resultLabel} 처리된 제출 건입니다. 중복 처리 없이 화면을 갱신합니다.` : `${resultLabel} 처리가 완료되었습니다. 화면 정보를 갱신합니다.`);
      router.refresh();
    } catch {
      setMessage("네트워크 오류가 발생했습니다. 처리 상태를 확인한 뒤 다시 시도해 주세요.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return <form onSubmit={submit} className="panel card form-card">
    <h3>검수 결과</h3>
    <div className="form-grid">
      <label>판정<select name="decision" value={decision} onChange={event => { setDecision(event.target.value); setPendingReview(null); setMessage(""); }} disabled={saving || success}><option value="APPROVED" disabled={!approvalEnabled}>승인</option><option value="REVISION_REQUESTED" disabled={!revisionEnabled}>수정요청</option><option value="REJECTED">거절</option></select></label>
      <p className="full form-message" role="status" aria-live="polite">{decision === "APPROVED" ? "승인하면 광고주 비용과 파트너 수익이 정산 내역에 반영됩니다. 승인 전 게시물과 금액을 확인해 주세요." : decision === "REVISION_REQUESTED" ? "수정 요청 시 파트너에게 사유가 전달됩니다. 수정할 내용을 구체적으로 입력해 주세요." : "거절하면 제출 건이 거절 처리됩니다. 파트너가 이해할 수 있도록 사유를 입력해 주세요."}</p>
      <label className="full">검수내용<textarea name="reason" rows={5} maxLength={2000} disabled={saving || success} onChange={() => { setPendingReview(null); setMessage(""); }} placeholder={decision === "APPROVED" ? "승인 메모 (선택)" : decision === "REVISION_REQUESTED" ? "수정해야 할 내용을 구체적으로 입력하세요." : "거절 사유를 입력하세요."} /></label>
    </div>
    {!approvalEnabled && <p className="form-message" role="status">승인 불가: {approvalDisabledReason} {revisionEnabled ? "수정 요청이나 거절은 가능합니다." : "수정 요청 횟수가 소진되어 거절만 가능합니다."}</p>}
    {success && <p className="form-message" role="status">최종 검수 결과: <strong>{completedDecision === "APPROVED" ? "승인" : completedDecision === "REVISION_REQUESTED" ? "수정 요청" : "거절"}</strong></p>}
    {message && <p className="form-message" role="status" aria-live="polite">{message}</p>}
    {pendingReview && !success && <section className="notice-box" role="region" aria-label="검수 최종 확인"><strong>최종 확인</strong><p>판정: <strong>{pendingReview.decision === "APPROVED" ? "승인" : pendingReview.decision === "REVISION_REQUESTED" ? "수정 요청" : "거절"}</strong></p><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>사유·메모: {pendingReview.reason || "없음"}</p><p>확정하면 검수 결과가 저장되며, 승인 시 광고주 비용과 파트너 수익이 반영됩니다.</p><button type="button" className="btn" disabled={saving} onClick={() => {setPendingReview(null);setMessage("");}}>취소하고 수정</button></section>}
    <div className="form-actions posting-review-actions"><button type="submit" className="btn primary posting-review-submit" disabled={saving || success}>{saving ? "처리 중..." : success ? "처리 완료" : pendingReview ? "검수 결과 최종 확정" : "검수 결과 확인"}</button></div>
    <style>{`@media(max-width:700px){.posting-review-actions{display:flex;width:100%}.posting-review-submit{width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;font-weight:700}.form-card select,.form-card textarea{max-width:100%;min-width:0}}`}</style>
  </form>;
}
