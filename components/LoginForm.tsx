"use client";

import { FormEvent, useState } from "react";

const messages: Record<string, string> = {
  INVALID_CREDENTIALS: "이메일 또는 비밀번호가 올바르지 않습니다.",
  APPROVAL_PENDING: "관리자 승인 대기 중입니다.",
  ACCOUNT_DISABLED: "사용할 수 없는 계정입니다. 관리자에게 문의해 주세요.",
  LOGIN_FAILED: "로그인 처리 중 오류가 발생했습니다.",
};

export default function LoginForm() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const data = await res.json(); setLoading(false);
    if (data.ok) window.location.href = data.destination;
    else setMessage(messages[data.error] ?? "로그인할 수 없습니다.");
  }

  return <form onSubmit={submit} className="panel card auth-card">
    <h2>로그인</h2>
    <p className="muted">파트너·광고주·관리자 계정이 하나의 로그인 화면을 사용합니다.</p>
    <div className="form-grid">
      <label className="full">이메일<input name="email" type="email" required autoComplete="email" /></label>
      <label className="full">비밀번호<input name="password" type="password" required autoComplete="current-password" /></label>
    </div>
    {message && <p className="form-message">{message}</p>}
    <div className="form-actions"><a className="btn" href="/partner/signup">파트너 가입</a><button disabled={loading}>{loading ? "로그인 중..." : "로그인"}</button></div>
  </form>;
}
