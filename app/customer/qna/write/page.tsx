"use client";

import Link from "next/link";
import "./qna-write.css";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Captcha = { id: string; question: string; expiresIn: number };

export default function QnaWritePage() {
  const submitting=useRef(false);
  const captchaBusy=useRef(false);
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [captchaLoading,setCaptchaLoading]=useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadCaptcha = useCallback(async () => {
    if(captchaBusy.current)return;captchaBusy.current=true;
    setCaptcha(null);setCaptchaLoading(true);
    try{const res=await fetch("/api/customer/captcha",{cache:"no-store"});const data=await res.json();if(!res.ok||!data.ok)throw new Error("CAPTCHA_FAILED");setCaptcha(data);}catch{setMessage("스팸 방지 문제를 불러오지 못했습니다. 새 문제 버튼으로 다시 시도해 주세요.");}finally{captchaBusy.current=false;setCaptchaLoading(false);}
  }, []);

  useEffect(() => { void loadCaptcha(); }, [loadCaptcha]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captcha||submitting.current||captchaBusy.current) return;
    submitting.current=true;let accepted=false;
    setLoading(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      nickname: form.get("nickname"), password: form.get("password"), title: form.get("title"), content: form.get("content"),
      isSecret: form.get("isSecret") === "on", website: form.get("website"), captchaId: captcha.id, captchaAnswer: form.get("captchaAnswer"),
    };
    try {
      const res = await fetch("/api/customer/qna", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok||!data.ok) { await loadCaptcha(); setMessage(data.message || "등록하지 못했습니다. 입력 내용과 새 스팸 방지 문제를 확인해 주세요."); return; }
      accepted=true;
      window.location.href = "/customer/qna?registered=1";
    } catch { await loadCaptcha();setMessage("접수 결과를 확인하지 못했습니다. 질문과 답변 목록에서 접수 여부를 먼저 확인해 주세요. 접수되지 않았다면 새 스팸 방지 문제를 풀어 다시 등록해 주세요. 작성 내용은 그대로 유지됩니다."); }
    finally { if(!accepted){submitting.current=false;setLoading(false);} }
  }

  return <main className="customer-page qna-write-page"><section className="customer-head"><div className="container"><span>MY PICKUP SUPPORT</span><h1>1:1 문의하기</h1><p>문의 내용을 남겨주시면 확인 후 답변해드립니다.</p></div></section><div className="customer-tabs-wrap"><nav className="container customer-tabs"><Link href="/customer">공지사항</Link><Link className="active" href="/customer/qna">질문과 답변</Link><Link href="/customer/faq">자주 묻는 질문</Link></nav></div><section className="customer-content container"><form className="qna-write-form" onSubmit={submit} aria-busy={loading}><div className="qna-write-intro"><span className="qna-write-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2Z"/><path d="M7 9h10M7 13h7"/></svg></span><div><h2>어떤 도움이 필요하신가요?</h2><p>문의 내용과 답변은 작성한 비밀번호로 확인할 수 있어요.</p></div><span className="qna-required-note">* 필수 입력</span></div><div className="qna-form-row"><label htmlFor="qna-nickname">닉네임 <b>*</b></label><input id="qna-nickname" name="nickname" autoComplete="nickname" required minLength={2} maxLength={40} placeholder="닉네임을 입력하세요" /></div><div className="qna-form-row"><label htmlFor="qna-password">비밀번호 <b>*</b></label><input id="qna-password" aria-describedby="qna-password-help" autoComplete="new-password" name="password" type="password" required minLength={4} maxLength={72} placeholder="글 확인에 사용할 비밀번호" /><small id="qna-password-help">4자 이상 입력하고 기억해 주세요. 문의 본문과 답변을 확인할 때 사용합니다.</small></div><div className="qna-form-row full"><label htmlFor="qna-title">제목 <b>*</b></label><input id="qna-title" name="title" required minLength={2} maxLength={160} placeholder="문의 제목을 입력하세요" /></div><div className="qna-form-row full"><label htmlFor="qna-content">내용 <b>*</b></label><textarea id="qna-content" aria-describedby="qna-content-help" name="content" required minLength={5} maxLength={5000} rows={10} placeholder="문의하실 내용과 문제가 발생한 화면·상황을 알려주세요." /><small id="qna-content-help">최대 5,000자 · 비밀번호나 금융정보 등 민감한 정보는 입력하지 마세요.</small></div><div className="qna-form-row full secret-check"><label><input type="checkbox" name="isSecret" defaultChecked /> 비밀글로 등록</label><small>제목과 닉네임은 목록에 표시됩니다. 모든 문의 본문은 비밀번호 확인 후 열람합니다.</small></div><input className="qna-honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" /><div className="captcha-box"><div><span>스팸 방지 확인</span><strong>{captcha?.question || (captchaLoading ? "문제를 불러오는 중..." : "새 문제 버튼으로 다시 불러와 주세요.")}</strong><small>문제는 5분 후 만료되며 한 번만 사용할 수 있습니다.</small></div><div className="captcha-answer"><input key={captcha?.id??"loading"} aria-label="스팸 방지 정답" name="captchaAnswer" inputMode="numeric" required placeholder="정답" /><button type="button" className="secondary" disabled={captchaLoading||loading} onClick={() => void loadCaptcha()}>새 문제</button></div></div>{message && <p className="form-message" role="alert">{message}</p>}<div className="qna-submit-row"><Link href="/customer/qna" className="btn">취소</Link><button type="submit" disabled={loading || captchaLoading || !captcha}>{loading ? "등록 중..." : "문의 등록"}</button></div></form></section></main>;
}
