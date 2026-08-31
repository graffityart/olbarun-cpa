"use client";
import { FormEvent, useState } from "react";

export default function TrackingLinkCreator({ campaignId }: { campaignId: string }) {
  const [subId, setSubId] = useState("");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setLoading(true); setMessage("");
    const res = await fetch("/api/partner/links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ campaignId, subId }) });
    const data = await res.json(); setLoading(false);
    if (!data.ok) return setMessage(`생성 실패: ${data.error}`);
    const absolute = `${window.location.origin}${data.url}`; setUrl(absolute); setMessage("광고링크가 생성되었습니다.");
  }

  async function copy() { if (!url) return; await navigator.clipboard.writeText(url); setMessage("링크를 복사했습니다."); }

  return <form onSubmit={submit} className="panel card">
    <h2>내 광고링크 만들기</h2>
    <p className="muted">Sub ID를 사용하면 블로그, 카페, 배너 등 유입경로별 성과를 구분할 수 있습니다.</p>
    <div className="form-grid"><label className="full">Sub ID (선택)<input value={subId} onChange={e=>setSubId(e.target.value)} maxLength={120} placeholder="예: blog01" /></label></div>
    <div className="form-actions"><button disabled={loading}>{loading ? "생성 중..." : "광고링크 생성"}</button></div>
    {url && <div className="notice-box"><strong>생성된 링크</strong><p style={{wordBreak:"break-all"}}>{url}</p><button type="button" className="secondary" onClick={copy}>링크 복사</button></div>}
    {message && <p className="form-message">{message}</p>}
  </form>;
}
