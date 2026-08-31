"use client";

import { FormEvent, useState } from "react";

const messages: Record<string, string> = {
  INVALID_INPUT: "이메일, 이름, 비밀번호(8자 이상)를 확인해 주세요.",
  EMAIL_ALREADY_EXISTS: "이미 가입된 이메일입니다.",
  SIGNUP_FAILED: "가입 처리 중 오류가 발생했습니다.",
};

export default function PartnerSignupForm() {
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/auth/partner-signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const data = await res.json(); setLoading(false);
    if (data.ok) { setDone(true); setMessage(`가입 신청이 완료되었습니다. 파트너 코드: ${data.partnerCode}`); event.currentTarget.reset(); }
    else setMessage(messages[data.error] ?? "가입 신청을 완료하지 못했습니다.");
  }

  return <form onSubmit={submit} className="panel card auth-card">
    <h2>파트너 회원가입</h2>
    <p className="muted">가입 후 관리자 승인이 완료되면 광고 참여와 정산 기능을 사용할 수 있습니다.</p>
    <div className="form-grid">
      <label className="full">이메일 *<input name="email" type="email" required autoComplete="email" /></label>
      <label>이름 *<input name="name" required /></label>
      <label>휴대전화<input name="phone" placeholder="010-0000-0000" /></label>
      <label>회원유형<select name="memberType" defaultValue="INDIVIDUAL"><option value="INDIVIDUAL">개인</option><option value="SOLE_PROPRIETOR">개인사업자</option><option value="CORPORATION">법인</option></select></label>
      <label>비밀번호 *<input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
    </div>
    {message && <p className={done ? "success-message" : "form-message"}>{message}</p>}
    <div className="form-actions"><a className="btn" href="/login">로그인</a><button disabled={loading}>{loading ? "처리 중..." : "가입 신청"}</button></div>
  </form>;
}
