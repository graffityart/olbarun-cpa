"use client";
import { FormEvent, useState } from "react";

export default function SettlementRequest({ available }: { available: number }) {
  const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setMessage(""); const f = new FormData(e.currentTarget);
    const payload = { amount: available, bankName: f.get("bankName"), accountNumber: f.get("accountNumber"), accountHolder: f.get("accountHolder") };
    const res = await fetch("/api/partner/settlements", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(payload) }); const data = await res.json(); setLoading(false);
    setMessage(data.ok ? `정산 신청 완료: ${data.settlementCode}` : `신청 실패: ${data.error}`); if (data.ok) location.reload();
  }
  return <form onSubmit={submit} className="panel card"><h2>정산 신청</h2><p className="muted">현재는 출금가능금액 전체를 한 번에 정산 신청합니다.</p><div className="form-grid"><label>신청금액<input value={available.toLocaleString("ko-KR")} readOnly /></label><label>은행명 *<input name="bankName" required /></label><label>계좌번호 *<input name="accountNumber" required /></label><label>예금주 *<input name="accountHolder" required /></label></div>{message&&<p className="form-message">{message}</p>}<div className="form-actions"><button disabled={loading||available<=0}>{loading?"신청 중...":"전체 금액 정산 신청"}</button></div></form>;
}
