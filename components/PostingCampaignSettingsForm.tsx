"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Settings = { mediaType: string; participantLimit: number | null; totalSubmissionLimit: number | null; perPartnerLimit: number; minimumCharacters: number | null; minimumImages: number | null; maintenanceDays: number | null; postingReviewDays: number; revisionLimit: number };
const errors: Record<string, string> = { INVALID_LIMIT: "선택 입력값은 1 이상의 정수로 입력하거나 비워 주세요.", INVALID_POSTING_LIMITS: "총 작업수량은 모집 인원과 1인 최대 작업수보다 작을 수 없습니다.", INVALID_POSTING_SETTINGS: "1인 최대 작업과 검수기간은 1 이상, 수정 가능 횟수는 0 이상이어야 합니다.", INVALID_POSTING_MEDIA_TYPE: "광고매체를 다시 선택해 주세요.", NOT_FOUND: "포스팅 캠페인 설정을 찾을 수 없습니다." };
export default function PostingCampaignSettingsForm({ id, initial }: { id: string; initial: Settings }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    const data = new FormData(event.currentTarget);
    const optional = (key: string) => data.get(key) === "" ? null : Number(data.get(key));
    const payload = { mediaType: String(data.get("mediaType")), participantLimit: optional("participantLimit"), totalSubmissionLimit: optional("totalSubmissionLimit"), perPartnerLimit: Number(data.get("perPartnerLimit")), minimumCharacters: optional("minimumCharacters"), minimumImages: optional("minimumImages"), maintenanceDays: optional("maintenanceDays"), postingReviewDays: Number(data.get("postingReviewDays")), revisionLimit: Number(data.get("revisionLimit")) };
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/campaigns/${id}/posting`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(errors[result.error] ?? "설정을 저장하지 못했습니다.");
      setMessage("포스팅 모집·검수 조건을 저장했습니다."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "네트워크 오류가 발생했습니다."); }
    finally { setSaving(false); }
  }
  const fields: { key: keyof Settings; label: string; min: number }[] = [
    { key: "participantLimit", label: "모집 파트너 수 (비우면 제한 없음)", min: 1 },
    { key: "totalSubmissionLimit", label: "총 작업수량 (비우면 제한 없음)", min: 1 },
    { key: "perPartnerLimit", label: "1인 최대 작업 수", min: 1 },
    { key: "minimumCharacters", label: "최소 글자수", min: 1 },
    { key: "minimumImages", label: "최소 이미지수", min: 1 },
    { key: "maintenanceDays", label: "게시 유지기간 (일)", min: 1 },
    { key: "postingReviewDays", label: "검수기간 (일)", min: 1 },
    { key: "revisionLimit", label: "수정 가능 횟수", min: 0 },
  ];
  return <form onSubmit={save} className="panel card"><h2>포스팅 모집·검수 조건 수정</h2><fieldset disabled={saving}><div className="cm-fields"><label>광고매체<select name="mediaType" defaultValue={initial.mediaType}><option value="BLOG">블로그</option><option value="CAFE">카페</option><option value="SNS">SNS</option><option value="OTHER">기타</option></select></label>{fields.map(field => <label key={field.key}>{field.label}<input name={field.key} type="number" step="1" min={field.min} required={field.key === "perPartnerLimit" || field.key === "postingReviewDays" || field.key === "revisionLimit"} defaultValue={initial[field.key] ?? ""}/></label>)}</div><button className="btn" type="submit">{saving ? "저장 중..." : "모집·검수 조건 저장"}</button></fieldset>{message && <p role="status" aria-live="polite" className="form-message">{message}</p>}</form>;
}
