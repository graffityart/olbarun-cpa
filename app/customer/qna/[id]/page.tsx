"use client";

import Link from "next/link";
import { FormEvent, use, useState } from "react";

type Item = { id:string; nickname:string; title:string; content:string; status:string; answer:string|null; answeredAt:string|null; createdAt:string };

export default function QnaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [item, setItem] = useState<Item | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();if(loading)return; setLoading(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch(`/api/customer/qna/${id}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ password: form.get("password") }) });
      const data = await res.json();
      if (!res.ok) setMessage(data.message || "글을 확인할 수 없습니다."); else setItem(data.item);
    } catch { setMessage("네트워크 오류가 발생했습니다."); }
    finally { setLoading(false); }
  }

  return <main className="customer-page"><section className="customer-head"><div className="container"><span>MY PICKUP SUPPORT</span><h1>문의 확인</h1><p>작성 시 설정한 비밀번호로 문의 내용과 답변을 확인하세요.</p></div></section><section className="customer-content container">{!item ? <div className="qna-password-card"><h2>🔒 문의 비밀번호 확인</h2><p>문의 작성 시 입력한 비밀번호를 입력해주세요.</p><form onSubmit={verify}><input aria-label="문의 비밀번호" type="password" name="password" required minLength={4} maxLength={72} autoComplete="current-password" autoFocus placeholder="비밀번호" /><button disabled={loading}>{loading ? "확인 중..." : "확인"}</button></form>{message && <p className="form-message" role="alert">{message}</p>}<Link href="/customer/qna">목록으로 돌아가기</Link></div> : <article className="qna-detail"><header><span className={`answer-state ${item.status === "ANSWERED" ? "done" : "waiting"}`}>{item.status === "ANSWERED" ? "답변완료" : "답변대기"}</span><h2>{item.title}</h2><div>{item.nickname} · {new Date(item.createdAt).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})}</div></header><div className="qna-body">{item.content}</div><section className="qna-answer"><strong>마이픽업 답변</strong>{item.answer ? <><p>{item.answer}</p>{item.answeredAt && <small>{new Date(item.answeredAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</small>}</> : <p className="muted">담당자가 문의를 확인하고 있습니다. 답변이 등록되면 이곳에서 확인할 수 있습니다.</p>}</section><div className="qna-detail-actions"><Link className="btn" href="/customer/qna">목록</Link></div></article>}</section></main>;
}
