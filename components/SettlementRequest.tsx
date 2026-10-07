"use client";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
const errors: Record<string,string> = {
  NO_AVAILABLE_EARNINGS: "현재 출금할 수 있는 수익이 없습니다.",
  REQUEST_FULL_AVAILABLE_AMOUNT: "출금 가능 금액이 변경되었습니다. 화면을 새로고침한 뒤 다시 신청해 주세요.",
  INVALID_INPUT: "은행명, 계좌번호, 예금주를 확인해 주세요.",
  UNAUTHORIZED: "로그인 상태를 확인해 주세요.",
  INVALID_ORIGIN: "화면을 새로고침한 뒤 다시 신청해 주세요.",
  ORIGIN_CHECK_FAILED: "화면을 새로고침한 뒤 다시 신청해 주세요.",
};
export default function SettlementRequest({ available }: { available: number }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [message,setMessage] = useState("");
  const [loading,setLoading] = useState(false);
  const [completed,setCompleted] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current || available <= 0) return;
    inFlight.current = true;
    const form = new FormData(e.currentTarget);
    let accepted = false;
    setLoading(true); setMessage("");
    try {
      const res = await fetch("/api/partner/settlements", {
        method:"POST", headers:{"content-type":"application/json"},
        body:JSON.stringify({amount:available,bankName:form.get("bankName"),accountNumber:form.get("accountNumber"),accountHolder:form.get("accountHolder")}),
      });
      const data = await res.json().catch(() => { throw new Error("응답을 확인하지 못했습니다. 신청 내역을 확인한 뒤 다시 시도해 주세요."); });
      if (!res.ok || !data.ok) throw new Error(errors[data.error] ?? "신청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      accepted = true; setCompleted(true);
      setMessage(`출금 신청이 접수되었습니다. 신청번호: ${data.settlementCode}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof TypeError ? "연결이 원활하지 않습니다. 신청 내역을 확인한 뒤 다시 시도해 주세요." : error instanceof Error ? error.message : "신청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally { if (!accepted) { inFlight.current = false; setLoading(false); } }
  }
  return <section className="pf-panel" id="request"><div className="pf-section-head"><div><h2>출금 신청</h2><p>출금 가능한 금액 전체를 한 번에 신청합니다.</p></div></div>
    {available<=0&&<div className="pf-notice">현재 출금 가능한 금액이 없습니다. 작업 승인 후 수익이 확정되면 신청할 수 있습니다.</div>}
    <form onSubmit={submit} aria-busy={loading&&!completed}><fieldset disabled={loading||available<=0} className="pf-fieldset"><div className="pf-fields">
      <label>신청 금액<input value={`${available.toLocaleString("ko-KR")}원`} readOnly /></label>
      <label>은행명<input name="bankName" required maxLength={50} autoComplete="off" placeholder="예: 국민은행" /></label>
      <label>계좌번호<input name="accountNumber" required maxLength={50} inputMode="numeric" autoComplete="off" placeholder="계좌번호를 입력해 주세요" /></label>
      <label>예금주<input name="accountHolder" required maxLength={50} autoComplete="off" placeholder="예금주명을 입력해 주세요" /></label>
    </div><p className="pf-help">입력한 계좌로 지급되므로 은행명·계좌번호·예금주를 정확히 확인해 주세요. 신청한 금액은 처리 중 금액으로 이동합니다.</p>
    <button className="pf-primary" type="submit">{completed?"신청 접수 완료":loading?"신청 중…":`${available.toLocaleString("ko-KR")}원 출금 신청`}</button></fieldset>
    {message&&<p className="pf-notice" role="status">{message}</p>}</form></section>;
}
