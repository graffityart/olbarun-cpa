"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Captcha = { id: string; question: string; expiresIn: number };

export default function QnaWritePage() {
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadCaptcha = useCallback(async () => {
    setMessage("");
    const res = await fetch("/api/customer/captcha", { cache: "no-store" });
    const data = await res.json();
    if (data.ok) setCaptcha(data);
    else setMessage(data.message || "스팸 방지 문제를 불러오지 못했습니다.");
  }, []);

  useEffect(() => { void loadCaptcha(); }, [loadCaptcha]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captcha) return;
    setLoading(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      nickname: form.get("nickname"), password: form.get("password"), title: form.get("title"), content: form.get("content"),
      isSecret: form.get("isSecret") === "on", website: form.get("website"), captchaId: captcha.id, captchaAnswer: form.get("captchaAnswer"),
    };
    try {
      const res = await fetch("/api/customer/qna", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setMessage(data.message || "등록하지 못했습니다."); await loadCaptcha(); return; }
      window.location.href = "/customer/qna?registered=1";
    } catch { setMessage("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요."); }
    finally { setLoading(false); }
  }

  return <main className="customer-page"><section className="customer-head"><div className="container"><span>MY PICKUP SUPPORT</span><h1>1:1 문의하기</h1><p>문의 내용을 남겨주시면 확인 후 답변해드립니다.</p></div></section><div className="customer-tabs-wrap"><nav className="container customer-tabs"><Link href="/customer">공지사항</Link><Link className="active" href="/customer/qna">질문과 답변</Link><Link href="/customer/faq">자주 묻는 질문</Link></nav></div><section className="customer-content container"><form className="qna-write-form" onSubmit={submit}><div className="qna-form-row"><label>닉네임 <b>*</b></label><input name="nickname" required minLength={2} maxLength={40} placeholder="닉네임을 입력하세요" /></div><div className="qna-form-row"><label>비밀번호 <b>*</b></label><input name="password" type="password" required minLength={4} maxLength={72} placeholder="글 확인에 사용할 비밀번호" /><small>비회원 문의 확인·수정 시 사용합니다.</small></div><div className="qna-form-row full"><label>제목 <b>*</b></label><input name="title" required minLength={2} maxLength={160} placeholder="문의 제목을 입력하세요" /></div><div className="qna-form-row full"><label>내용 <b>*</b></label><textarea name="content" required minLength={5} maxLength={5000} rows={10} placeholder="문의 내용을 자세히 입력해주세요." /></div><div className="qna-form-row full secret-check"><label><input type="checkbox" name="isSecret" defaultChecked /> 비밀글로 등록</label><small>비밀글은 작성자와 관리자만 내용을 확인할 수 있습니다.</small></div><input className="qna-honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" /><div className="captcha-box"><div><span>스팸 방지 확인</span><strong>{captcha?.question || "문제를 불러오는 중..."}</strong><small>문제는 5분 후 만료되며 한 번만 사용할 수 있습니다.</small></div><div className="captcha-answer"><input name="captchaAnswer" inputMode="numeric" required placeholder="정답" /><button type="button" className="secondary" onClick={() => void loadCaptcha()}>새 문제</button></div></div>{message && <p className="form-message">{message}</p>}<div className="qna-submit-row"><Link href="/customer/qna" className="btn">취소</Link><button type="submit" disabled={loading || !captcha}>{loading ? "등록 중..." : "문의 등록"}</button></div></form></section></main>;
}
