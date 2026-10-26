"use client";

import { FormEvent, useState } from "react";

type Advertiser = { id: string; companyName: string; advertiserCode: string };

export default function PostingCampaignForm({ advertisers }: { advertisers: Advertiser[] }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();if(saving)return;const formElement=event.currentTarget;
    setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      type: "POSTING",
      advertiserId: form.get("advertiserId"), name: form.get("name"), description: form.get("description"),
      startAt: form.get("startAt")?String(form.get("startAt"))+"T00:00:00+09:00":null, endAt: form.get("endAt")?String(form.get("endAt"))+"T00:00:00+09:00":null, mediaType: form.get("mediaType"),
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

    if (!Number.isSafeInteger(payload.advertiserRate) || !Number.isSafeInteger(payload.partnerBaseRate) || payload.advertiserRate < 0 || payload.partnerBaseRate < 0 || payload.partnerBaseRate > payload.advertiserRate) { setMessage("광고주 비용과 파트너 수익은 0 이상의 정수이며, 파트너 수익은 광고주 비용보다 클 수 없습니다."); setSaving(false); return; }
    if (payload.startAt && payload.endAt && payload.endAt <= payload.startAt) { setMessage("모집 종료일은 시작일보다 뒤여야 합니다."); setSaving(false); return; }
    if (payload.totalSubmissionLimit !== null && (payload.perPartnerLimit > payload.totalSubmissionLimit || (payload.participantLimit !== null && payload.participantLimit > payload.totalSubmissionLimit))) { setMessage("총 작업수량은 모집 파트너 수와 1인 최대 작업수보다 작을 수 없습니다."); setSaving(false); return; }
    try{const res = await fetch("/api/admin/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data=await res.json();if(!res.ok||!data.ok){const reasons:Record<string,string>={INVALID_INPUT:"요청 형식이 올바르지 않습니다.",INVALID_CAMPAIGN_TYPE:"캠페인 유형을 확인해 주세요.",INVALID_ADVERTISER_ID:"광고주 선택값이 올바르지 않습니다.",ADVERTISER_NOT_FOUND:"선택한 광고주를 찾을 수 없습니다.",ADVERTISER_AND_NAME_REQUIRED:"광고주와 캠페인명을 입력해 주세요.",INVALID_CAMPAIGN_NAME:"캠페인명에 사용할 수 없는 문자가 있습니다.",INVALID_RATE:"광고주 단가와 파트너 단가를 확인해 주세요.",INVALID_CAMPAIGN_PERIOD:"종료일은 시작일보다 뒤여야 합니다.",INVALID_LIMIT:"모집 한도는 1 이상의 정수로 입력해 주세요.",INVALID_DATE:"운영기간 날짜 형식을 확인해 주세요.",INVALID_POSTING_MEDIA_TYPE:"광고매체를 다시 선택해 주세요.",INVALID_POSTING_SETTINGS:"1인 최대 작업·검수기간·수정 횟수를 확인해 주세요.",INVALID_POSTING_LIMITS:"총 작업수량은 모집 파트너 수와 1인 최대 작업수보다 작을 수 없습니다."};throw new Error(reasons[data.error]??"저장에 실패했습니다. 입력값을 확인해 주세요.");}setMessage(`초안 저장 완료: ${data.campaign.campaignCode} · 캠페인 목록에서 검토와 활성화를 진행하세요.`);formElement.reset();
    }catch(e){setMessage((e instanceof Error?e.message:"통신 오류")+" 저장 여부가 불확실하다면 캠페인 목록을 먼저 확인해 주세요.");}finally{setSaving(false);}

  }

  return <form onSubmit={submit} className="panel card form-card">
    <h2>포스팅 캠페인 통합 입력</h2>
    <p className="muted">모집조건과 작성·검수 가이드를 입력하면 초안으로 저장됩니다.</p>
    <div className="form-grid">
      <label>광고주 *<select name="advertiserId" required defaultValue=""><option value="" disabled>광고주 선택</option>{advertisers.map(a => <option key={a.id} value={a.id}>{a.companyName} ({a.advertiserCode})</option>)}</select></label>
      <label>광고매체 *<select name="mediaType" defaultValue="BLOG"><option value="BLOG">네이버 블로그</option><option value="CAFE">카페</option><option value="SNS">SNS</option><option value="OTHER">기타</option></select></label>
      <label className="full">캠페인명 *<input name="name" maxLength={200} required placeholder="예: 부산 포장이사 후기 콘텐츠 모집" /></label>
      <label className="full">캠페인 소개<textarea name="description" rows={4} /></label>
      <label>모집 시작일 (한국 시간 00시)<input name="startAt" type="date" /></label><label>모집 종료일 (한국 시간 00시)<input name="endAt" type="date" /></label>
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
