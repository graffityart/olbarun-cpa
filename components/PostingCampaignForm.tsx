"use client";

import { FormEvent, useState } from "react";

type Advertiser = { id: string; companyName: string; advertiserCode: string };

export default function PostingCampaignForm({ advertisers }: { advertisers: Advertiser[] }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      type: "POSTING",
      advertiserId: form.get("advertiserId"), name: form.get("name"), description: form.get("description"),
      startAt: form.get("startAt"), endAt: form.get("endAt"), mediaType: form.get("mediaType"),
      advertiserRate: Number(form.get("advertiserRate") || 0), partnerBaseRate: Number(form.get("partnerBaseRate") || 0),
      participantLimit: Number(form.get("participantLimit") || 0) || null,
      totalSubmissionLimit: Number(form.get("totalSubmissionLimit") || 0) || null,
      perPartnerLimit: Number(form.get("perPartnerLimit") || 1),
      minimumCharacters: Number(form.get("minimumCharacters") || 0) || null,
      minimumImages: Number(form.get("minimumImages") || 0) || null,
      maintenanceDays: Number(form.get("maintenanceDays") || 0) || null,
      postingReviewDays: Number(form.get("postingReviewDays") || 3), revisionLimit: Number(form.get("revisionLimit") || 2),
      postingRules: {
        requiredKeywords: form.get("requiredKeywords"), titleRule: form.get("titleRule"), requiredLink: form.get("requiredLink"),
        prohibitedExpressions: form.get("prohibitedExpressions"), guide: form.get("guide"),
      },
      settings: { participationMode: form.get("participationMode") },
    };

    const res = await fetch("/api/admin/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json(); setSaving(false);
    setMessage(data.ok ? `임시저장 완료: ${data.campaign.campaignCode}` : `저장 실패: ${data.error}`);
    if (data.ok) event.currentTarget.reset();
  }

  return <form onSubmit={submit} className="panel card form-card">
    <h2>포스팅 캠페인 통합 입력</h2>
    <p className="muted">모집조건, 작성가이드, 검수조건, 비용을 입력하고 DRAFT 상태로 저장합니다.</p>
    <div className="form-grid">
      <label>광고주 *<select name="advertiserId" required defaultValue=""><option value="" disabled>광고주 선택</option>{advertisers.map(a => <option key={a.id} value={a.id}>{a.companyName} ({a.advertiserCode})</option>)}</select></label>
      <label>광고매체 *<select name="mediaType" defaultValue="BLOG"><option value="BLOG">네이버 블로그</option><option value="CAFE">카페</option><option value="SNS">SNS</option><option value="OTHER">기타</option></select></label>
      <label className="full">캠페인명 *<input name="name" required placeholder="예: 부산 포장이사 후기 콘텐츠 모집" /></label>
      <label className="full">캠페인 소개<textarea name="description" rows={4} /></label>
      <label>모집 시작일<input name="startAt" type="date" /></label><label>모집 종료일<input name="endAt" type="date" /></label>
      <label>모집 파트너 수<input name="participantLimit" type="number" min="1" /></label><label>총 작업수량<input name="totalSubmissionLimit" type="number" min="1" /></label>
      <label>1인 최대 작업<input name="perPartnerLimit" type="number" min="1" defaultValue="1" /></label>
      <label>참여방식<select name="participationMode" defaultValue="IMMEDIATE"><option value="IMMEDIATE">즉시 참여</option><option value="ADMIN_APPROVAL">관리자 승인</option><option value="ADVERTISER_APPROVAL">광고주 승인</option></select></label>
      <label>광고주 건당비용 *<input name="advertiserRate" type="number" min="0" required /></label><label>파트너 건당수익 *<input name="partnerBaseRate" type="number" min="0" required /></label>
      <label>최소 글자수<input name="minimumCharacters" type="number" min="0" /></label><label>최소 이미지수<input name="minimumImages" type="number" min="0" /></label>
      <label>게시 유지기간(일)<input name="maintenanceDays" type="number" min="0" defaultValue="90" /></label><label>검수기간(일)<input name="postingReviewDays" type="number" min="1" defaultValue="3" /></label>
      <label>수정 가능횟수<input name="revisionLimit" type="number" min="0" defaultValue="2" /></label><label>필수 링크<input name="requiredLink" placeholder="https://..." /></label>
      <label className="full">필수 키워드<textarea name="requiredKeywords" rows={3} placeholder="예: 부산 포장이사 3회, 이사견적 1회" /></label>
      <label className="full">제목 규칙<input name="titleRule" placeholder="예: 제목에 '부산 포장이사' 포함" /></label>
      <label className="full">금지 표현<textarea name="prohibitedExpressions" rows={3} /></label>
      <label className="full">작성 가이드<textarea name="guide" rows={5} placeholder="이미지, 링크, 문구, 주의사항 등을 입력하세요." /></label>
    </div>
    {message && <p className="form-message">{message}</p>}
    <div className="form-actions"><a className="btn" href="/admin/campaigns">취소</a><button disabled={saving}>{saving ? "저장 중..." : "임시저장"}</button></div>
  </form>;
}
