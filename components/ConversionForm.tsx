"use client";
import { FormEvent, useState } from "react";

export default function ConversionForm({ campaignId }: { campaignId: string }) {
  const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setSaving(true); setMessage(""); const form = new FormData(e.currentTarget);
    const payload = { campaignId, name: form.get("name"), phone: form.get("phone"), region: form.get("region"), privacy: form.get("privacy") === "on", thirdParty: form.get("thirdParty") === "on" };
    const res = await fetch("/api/conversions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const data = await res.json(); setSaving(false);
    if (data.ok) { setMessage(`신청이 완료되었습니다. 접수번호 ${data.conversionCode}`); e.currentTarget.reset(); } else setMessage(data.error === "DUPLICATE" ? "이미 접수된 신청정보입니다." : `신청 실패: ${data.error}`);
  }
  return <form onSubmit={submit}><div className="form-grid"><label>이름 *<input name="name" required maxLength={100} /></label><label>휴대전화 *<input name="phone" required inputMode="tel" placeholder="010-0000-0000" /></label><label className="full">지역<input name="region" maxLength={160} /></label><label className="full consent-row"><span><input name="privacy" type="checkbox" required /> [필수] 개인정보 수집·이용 동의</span></label><label className="full consent-row"><span><input name="thirdParty" type="checkbox" required /> [필수] 개인정보 제3자 제공 동의</span></label></div>{message && <p className="form-message">{message}</p>}<div className="form-actions"><button disabled={saving}>{saving ? "접수 중..." : "무료 상담 신청"}</button></div></form>;
}
