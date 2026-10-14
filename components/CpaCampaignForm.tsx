"use client";

import { FormEvent, useState } from "react";

type Advertiser = { id: string; companyName: string; advertiserCode: string };

export default function CpaCampaignForm({ advertisers }: { advertisers: Advertiser[] }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [savedId, setSavedId] = useState<string|null>(null);
  const [imageData,setImageData]=useState("");
  const [imageError,setImageError]=useState("");
  async function selectImage(file?:File){setImageError("");if(!file){setImageData("");return;}if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setImageError("JPG, PNG, WebP 이미지만 사용할 수 있습니다.");return;}if(file.size>5*1024*1024){setImageError("원본 이미지는 5MB 이하여야 합니다.");return;}try{const bitmap=await createImageBitmap(file);const scale=Math.min(1,640/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement("canvas");canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext("2d");if(!ctx)throw Error("IMAGE_PROCESSING_FAILED");ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const encoded=canvas.toDataURL("image/webp",0.7);if(encoded.length>200000)throw Error("IMAGE_TOO_LARGE");setImageData(encoded);}catch{setImageError("이미지 처리에 실패했습니다. 더 작은 이미지를 선택해 주세요.");setImageData("");}}

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();if(saving)return;const formElement=event.currentTarget;
    setSaving(true); setMessage(""); setError(false); setSavedId(null);
    if(imageError){setMessage(imageError);setError(true);setSaving(false);return;}
    const form = new FormData(event.currentTarget);
    const payload = {
      type: "CPA",
      advertiserId: form.get("advertiserId"), name: form.get("name"), category: form.get("category"), description: form.get("description"),
      startAt: form.get("startAt")?String(form.get("startAt"))+"T00:00:00+09:00":null, endAt: form.get("endAt")?String(form.get("endAt"))+"T00:00:00+09:00":null,
      advertiserRate: Number(form.get("advertiserRate") || 0), partnerBaseRate: Number(form.get("partnerBaseRate") || 0),
      duplicateDays: Number(form.get("duplicateDays") || 30), reviewDays: Number(form.get("reviewDays") || 7),
      dailyConversionLimit: Number(form.get("dailyConversionLimit") || 0) || null,
      monthlyConversionLimit: Number(form.get("monthlyConversionLimit") || 0) || null,
      dailyBudgetLimit: Number(form.get("dailyBudgetLimit") || 0) || null,
      monthlyBudgetLimit: Number(form.get("monthlyBudgetLimit") || 0) || null,
      settings: {
        mainImage: imageData || null, landingUrl: form.get("landingUrl"), region: form.get("region"), approvalRules: form.get("approvalRules"), rejectionRules: form.get("rejectionRules"),
        allowedMedia: form.get("allowedMedia"), prohibitedMedia: form.get("prohibitedMedia"), operatingHours: form.get("operatingHours"),
      },
    };
    if (!Number.isSafeInteger(payload.advertiserRate) || !Number.isSafeInteger(payload.partnerBaseRate) || payload.advertiserRate < 0 || payload.partnerBaseRate < 0 || payload.partnerBaseRate > payload.advertiserRate || payload.advertiserRate > 999999999 || payload.partnerBaseRate > 999999999) { setMessage("단가를 확인해 주세요. CPA 금액은 원 단위의 정수이며, 파트너 CPA는 광고주 CPA보다 클 수 없습니다."); setError(true); setSaving(false); return; }
    try{const res = await fetch("/api/admin/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data=await res.json();if(!res.ok||!data.ok){const reasons:Record<string,string>={INVALID_RATE:"광고주·파트너 CPA 금액 또는 마진이 올바르지 않습니다.",INVALID_CAMPAIGN_PERIOD:"종료일은 시작일보다 뒤여야 합니다.",INVALID_CONVERSION_LIMIT:"일일 DB 한도가 월 DB 한도보다 클 수 없습니다.",INVALID_BUDGET_LIMIT:"일일 광고비 한도가 월 광고비 한도보다 클 수 없습니다.",ADVERTISER_NOT_FOUND:"선택한 광고주가 존재하지 않습니다.",INVALID_LIMIT:"한도는 1 이상의 정수로 입력하거나 비워 주세요.",DATABASE_NOT_READY:"운영 데이터베이스 연결을 확인해 주세요."};throw new Error(reasons[data.error]??`저장 실패 (${data.error??res.status})`);}setMessage(`초안 저장 완료: ${data.campaign.campaignCode} · 조건을 확인한 뒤 활성화하세요.`);setSavedId(data.campaign.id);formElement.reset();setImageData("");
    }catch(e){setError(true);setMessage((e instanceof Error?e.message:"통신 오류")+" · 저장 여부가 불확실하면 캠페인 목록을 먼저 확인해 주세요.");}finally{setSaving(false);}

  }

  return <form onSubmit={submit} className="panel card form-card">
    <h2>CPA 캠페인 통합 입력</h2>
    <p className="muted">승인 조건과 단가를 입력하면 초안으로 저장됩니다.</p>
    <div className="form-grid">
      <label>광고주 *<select name="advertiserId" required defaultValue=""><option value="" disabled>광고주 선택</option>{advertisers.map(a => <option key={a.id} value={a.id}>{a.companyName} ({a.advertiserCode})</option>)}</select></label>
      <label>카테고리 *<select name="category" required defaultValue="이사"><option>이사</option><option>청소</option><option>인터넷</option><option>렌탈</option><option>교육</option><option>기타</option></select></label>
      <label className="full">캠페인명 *<input name="name" maxLength={200} required placeholder="예: 부산 포장이사 무료견적" /></label>
      <label className="full">설명<textarea name="description" rows={4} /></label>
      <label className="full">캠페인 대표 이미지 (선택)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void selectImage(e.target.files?.[0])}/><small>JPG·PNG·WebP · 원본 5MB 이하 · 등록 시 자동 축소 (640px)</small>{imageError&&<span role="alert">{imageError}</span>}{imageData&&<img src={imageData} alt="대표 이미지 미리보기" style={{maxWidth:320,width:"100%",height:"auto",borderRadius:12,marginTop:10}}/>}</label>
      <label className="full">광고 랜딩페이지 URL (선택)<input name="landingUrl" type="url" maxLength={2048} placeholder="https://advertiser.example.com/apply" /><small>등록한 URL이 있으면 파트너 추적링크 클릭 시 해당 광고 랜딩페이지로 이동합니다. 비워두면 마이픽업 기본 신청페이지를 사용합니다.</small></label>
      <label>시작일 (한국 시간 00시)<input name="startAt" type="date" /></label><label>종료일 (한국 시간 00시)<input name="endAt" type="date" /></label>
      <label className="full">광고지역<input name="region" placeholder="예: 부산 전체" /></label>
      <label>광고주 CPA *<input name="advertiserRate" type="number" min="0" max="999999999" step="1" required placeholder="예: 30000 (원)" /></label><label>파트너 CPA *<input name="partnerBaseRate" type="number" min="0" max="999999999" step="1" required placeholder="예: 20000 (원)" /></label>
      <label>중복기간(일)<input name="duplicateDays" type="number" min="0" defaultValue="30" /></label><label>검수기간(일)<input name="reviewDays" type="number" min="1" defaultValue="7" /></label>
      <label>일일 DB 한도<input name="dailyConversionLimit" type="number" min="0" /></label><label>월 DB 한도<input name="monthlyConversionLimit" type="number" min="0" /></label>
      <label>일일 광고비 한도<input name="dailyBudgetLimit" type="number" min="0" /></label><label>월 광고비 한도<input name="monthlyBudgetLimit" type="number" min="0" /></label>
      <label className="full">성과 인정조건<textarea name="approvalRules" rows={3} placeholder="정상 연락처, 실제 상담신청, 서비스 가능지역 등" /></label>
      <label className="full">거절조건<textarea name="rejectionRules" rows={3} placeholder="중복, 허위번호, 타인정보, 지역 외 등" /></label>
      <label>허용매체<input name="allowedMedia" placeholder="블로그, SNS, 홈페이지" /></label><label>금지매체<input name="prohibitedMedia" placeholder="스팸문자, 리워드 등" /></label>
      <label className="full">운영시간<input name="operatingHours" placeholder="예: 월~금 09:00~18:00" /></label>
    </div>
    <p className="muted">단가는 원 단위로 입력합니다. 예: 광고주 30,000원 → 30000 / 파트너 20,000원 → 20000</p>
    {message && <p className="form-message" role={error?"alert":"status"}>{message}</p>}
    {savedId && <p><a className="btn" href={`/admin/campaigns/${savedId}`}>저장한 캠페인 상세·단가 확인 →</a></p>}
    <div className="form-actions"><a className="btn" href="/admin/campaigns">취소</a><button disabled={saving}>{saving ? "저장 중..." : "임시저장"}</button></div>
  </form>;
}
