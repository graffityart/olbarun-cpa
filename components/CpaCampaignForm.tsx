"use client";

import { FormEvent, useState } from "react";

type Advertiser = { id: string; companyName: string; advertiserCode: string };

export default function CpaCampaignForm({ advertisers }: { advertisers: Advertiser[] }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      type: "CPA",
      advertiserId: form.get("advertiserId"), name: form.get("name"), category: form.get("category"), description: form.get("description"),
      startAt: form.get("startAt"), endAt: form.get("endAt"),
      advertiserRate: Number(form.get("advertiserRate") || 0), partnerBaseRate: Number(form.get("partnerBaseRate") || 0),
      duplicateDays: Number(form.get("duplicateDays") || 30), reviewDays: Number(form.get("reviewDays") || 7),
      dailyConversionLimit: Number(form.get("dailyConversionLimit") || 0) || null,
      monthlyConversionLimit: Number(form.get("monthlyConversionLimit") || 0) || null,
      dailyBudgetLimit: Number(form.get("dailyBudgetLimit") || 0) || null,
      monthlyBudgetLimit: Number(form.get("monthlyBudgetLimit") || 0) || null,
      settings: {
        region: form.get("region"), approvalRules: form.get("approvalRules"), rejectionRules: form.get("rejectionRules"),
        allowedMedia: form.get("allowedMedia"), prohibitedMedia: form.get("prohibitedMedia"), operatingHours: form.get("operatingHours"),
      },
    };
    const res = await fetch("/api/admin/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json(); setSaving(false);
    setMessage(data.ok ? `임시저장 완료: ${data.campaign.campaignCode}` : `저장 실패: ${data.error}`);
    if (data.ok) event.currentTarget.reset();
  }

  return <form onSubmit={submit} className="panel card form-card">
    <h2>CPA 캠페인 통합 입력</h2>
    <p className="muted">현재는 7단계 핵심 항목을 한 화면에서 입력하고 DRAFT로 저장합니다. 이후 단계형 UI로 분리됩니다.</p>
    <div className="form-grid">
      <label>광고주 *<select name="advertiserId" required defaultValue=""><option value="" disabled>광고주 선택</option>{advertisers.map(a => <option key={a.id} value={a.id}>{a.companyName} ({a.advertiserCode})</option>)}</select></label>
      <label>카테고리 *<select name="category" required defaultValue="이사"><option>이사</option><option>청소</option><option>인터넷</option><option>렌탈</option><option>교육</option><option>기타</option></select></label>
      <label className="full">캠페인명 *<input name="name" required placeholder="예: 부산 포장이사 무료견적" /></label>
      <label className="full">설명<textarea name="description" rows={4} /></label>
      <label>시작일<input name="startAt" type="date" /></label><label>종료일<input name="endAt" type="date" /></label>
      <label className="full">광고지역<input name="region" placeholder="예: 부산 전체" /></label>
      <label>광고주 CPA *<input name="advertiserRate" type="number" min="0" required /></label><label>파트너 CPA *<input name="partnerBaseRate" type="number" min="0" required /></label>
      <label>중복기간(일)<input name="duplicateDays" type="number" min="0" defaultValue="30" /></label><label>검수기간(일)<input name="reviewDays" type="number" min="1" defaultValue="7" /></label>
      <label>일일 DB 한도<input name="dailyConversionLimit" type="number" min="0" /></label><label>월 DB 한도<input name="monthlyConversionLimit" type="number" min="0" /></label>
      <label>일일 광고비 한도<input name="dailyBudgetLimit" type="number" min="0" /></label><label>월 광고비 한도<input name="monthlyBudgetLimit" type="number" min="0" /></label>
      <label className="full">성과 인정조건<textarea name="approvalRules" rows={3} placeholder="정상 연락처, 실제 상담신청, 서비스 가능지역 등" /></label>
      <label className="full">거절조건<textarea name="rejectionRules" rows={3} placeholder="중복, 허위번호, 타인정보, 지역 외 등" /></label>
      <label>허용매체<input name="allowedMedia" placeholder="블로그, SNS, 홈페이지" /></label><label>금지매체<input name="prohibitedMedia" placeholder="스팸문자, 리워드 등" /></label>
      <label className="full">운영시간<input name="operatingHours" placeholder="예: 월~금 09:00~18:00" /></label>
    </div>
    {message && <p className="form-message">{message}</p>}
    <div className="form-actions"><a className="btn" href="/admin/campaigns">취소</a><button disabled={saving}>{saving ? "저장 중..." : "임시저장"}</button></div>
  </form>;
}
