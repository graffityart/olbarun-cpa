"use client";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
const errors: Record<string,string> = {
  SETTLEMENT_ALREADY_PENDING: "이미 처리 중인 출금 신청이 있습니다. 기존 신청 내역을 확인해 주세요.",
  NO_AVAILABLE_EARNINGS: "현재 출금할 수 있는 수익이 없습니다.",
  REQUEST_FULL_AVAILABLE_AMOUNT: "출금 가능 금액이 변경되었습니다. 화면을 새로고침한 뒤 다시 신청해 주세요.",
  INVALID_INPUT: "은행명, 계좌번호, 예금주를 확인해 주세요.",
  INVALID_EARNINGS_AMOUNT: "수익 금액 확인이 필요합니다. 고객센터에 문의해 주세요.",
  EARNINGS_CHANGED: "출금 가능 금액이 변경되었습니다. 신청 내역을 확인한 뒤 다시 시도해 주세요.",
  UNAUTHORIZED: "로그인 상태를 확인해 주세요.",
  INVALID_ORIGIN: "화면을 새로고침한 뒤 다시 신청해 주세요.",
  ORIGIN_CHECK_FAILED: "화면을 새로고침한 뒤 다시 신청해 주세요.",
};
export default function SettlementRequest({ available, pending = false }: { available: number; pending?: boolean }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [message,setMessage] = useState("");
  const [loading,setLoading] = useState(false);
  const [completed,setCompleted] = useState(false);
  const [outcomeUnknown,setOutcomeUnknown] = useState(false);
  const [historyMessage,setHistoryMessage] = useState("");
  const [historyMatches,setHistoryMatches] = useState<Array<{settlementCode:string;status:string;requestedAmount:number}>>([]);
  const [historyLoading,setHistoryLoading] = useState(false);
  const [confirmation,setConfirmation] = useState<{bankName:string;accountNumber:string;accountHolder:string}|null>(null);
  async function checkRecentRequests() {
    if (historyLoading) return;
    setHistoryLoading(true); setHistoryMessage(""); setHistoryMatches([]);
    try {
      const res = await fetch("/api/partner/settlements", {cache:"no-store"});
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok !== true || !Array.isArray(data.settlements)) throw new Error("최근 출금 내역을 확인할 수 없습니다. 잠시 후 다시 확인해 주세요.");
      const rows = data.settlements as Array<{settlementCode:string;status:string;requestedAmount:number}>;
      const matches = rows.filter(row => row !== null && typeof row === "object" && typeof row.settlementCode === "string" && /^SET-[0-9A-F]{12}$/.test(row.settlementCode) && typeof row.requestedAmount === "number" && Number.isSafeInteger(row.requestedAmount) && row.requestedAmount === available && ["REQUESTED","APPROVED","PAID","REJECTED"].includes(row.status));
      setHistoryMatches(matches);
      setHistoryMessage(matches.length ? `동일 금액 신청 내역 ${matches.length}건이 확인됐습니다. 출금 신청 내역에서 상태와 신청 시각을 확인해 주세요.` : "최근 10건에서 동일 금액 신청을 찾지 못했습니다. 이전 신청의 처리 결과를 확정할 수 없으므로 출금 신청 내역을 확인해 주세요.");
      router.refresh();
    } catch(error) {setHistoryMessage(error instanceof Error ? error.message : "출금 내역을 조회할 수 없습니다.");}
    finally {setHistoryLoading(false);}
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current || completed || outcomeUnknown || available <= 0 || pending) return;
    const form = new FormData(e.currentTarget);
    const bankName = String(form.get("bankName") ?? "").trim();
    const accountNumber = String(form.get("accountNumber") ?? "").replace(/\s/g,"");
    const accountHolder = String(form.get("accountHolder") ?? "").trim();
    if (!bankName || !accountNumber || !accountHolder || bankName.length>50 || accountNumber.length>50 || accountHolder.length>50 || !/^[0-9]+(?:-[0-9]+)*$/.test(accountNumber) || accountNumber.replace(/-/g,"").length<6 || /[\u0000-\u001f\u007f]/.test(bankName) || /[\u0000-\u001f\u007f]/.test(accountHolder)) {setMessage("은행명, 계좌번호, 예금주를 정확히 입력해 주세요.");setConfirmation(null);return;}
    if (!confirmation || confirmation.bankName !== bankName || confirmation.accountNumber !== accountNumber || confirmation.accountHolder !== accountHolder) {
      setConfirmation({bankName,accountNumber,accountHolder});
      setMessage("신청 금액과 입금 계좌를 확인한 뒤 최종 신청 버튼을 눌러 주세요.");
      return;
    }
    inFlight.current = true;
    let accepted = false;
    setLoading(true); setMessage("");
    try {
      const res = await fetch("/api/partner/settlements", {
        method:"POST", headers:{"content-type":"application/json"},
        body:JSON.stringify({amount:available,bankName,accountNumber,accountHolder}),
      });
      const data = await res.json().catch(() => null);
      if (!data || typeof data.ok !== "boolean") {
        setOutcomeUnknown(true);
        throw new Error("서버 응답을 확인할 수 없습니다. 중복 신청 방지를 위해 신청 내역을 확인하기 전에는 다시 신청할 수 없습니다.");
      }
      if (!res.ok || !data.ok) {
        if (res.ok || res.status >= 500 || typeof data.error !== "string" || !Object.hasOwn(errors,data.error)) setOutcomeUnknown(true);
        throw new Error(errors[data.error] ?? "처리 결과가 불확실합니다. 신청 내역을 확인한 뒤 다시 시도해 주세요.");
      }
      if (res.status !== 201) {
        setOutcomeUnknown(true);
        throw new Error("서버에서 출금 신청 접수 상태를 확인할 수 없습니다. 신청 내역을 먼저 확인해 주세요.");
      }
      if (typeof data.settlementCode !== "string" || !/^SET-[0-9A-F]{12}$/.test(data.settlementCode)) {
        setOutcomeUnknown(true);
        throw new Error("신청 접수번호를 확인할 수 없습니다. 중복 신청 방지를 위해 신청 내역을 먼저 확인해 주세요.");
      }
      accepted = true; setCompleted(true);
      setMessage(`출금 신청이 접수되었습니다. 신청번호: ${data.settlementCode}`);
      router.refresh();
    } catch (error) {
      if (error instanceof TypeError || (error instanceof Error && error.name === "AbortError")) setOutcomeUnknown(true);
      setConfirmation(null);
      setMessage(error instanceof TypeError || (error instanceof Error && error.name === "AbortError") ? "연결이 중단되어 신청 결과가 불확실합니다. 신청 내역을 확인한 뒤 다시 시도해 주세요." : error instanceof Error ? error.message : "신청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally { if (!accepted) { inFlight.current = false; setLoading(false); } }
  }
  return <section className="pf-panel" id="request"><div className="pf-section-head"><div><h2>출금 신청</h2><p>출금 가능한 금액 전체를 한 번에 신청합니다.</p></div></div>
    {pending&&<div className="pf-notice" role="status">이미 처리 중인 출금 신청이 있습니다. 기존 신청이 완료된 후 다시 신청할 수 있습니다.</div>}
    {!pending&&available<=0&&<div className="pf-notice">현재 출금 가능한 금액이 없습니다. 작업 승인 후 수익이 확정되면 신청할 수 있습니다.</div>}
    <form onSubmit={submit} onChange={() => { if (confirmation) { setConfirmation(null); setMessage(""); } }} aria-busy={loading&&!completed}><fieldset disabled={loading||completed||outcomeUnknown||available<=0||pending} className="pf-fieldset"><div className="pf-fields">
      <label>신청 금액<input value={`${available.toLocaleString("ko-KR")}원`} readOnly /></label>
      <label>은행명<input name="bankName" required maxLength={50} autoComplete="off" placeholder="예: 국민은행" /></label>
      <label>계좌번호<input name="accountNumber" required maxLength={50} inputMode="numeric" autoComplete="off" placeholder="계좌번호를 입력해 주세요" /></label>
      <label>예금주<input name="accountHolder" required maxLength={50} autoComplete="off" placeholder="예금주명을 입력해 주세요" /></label>
    </div><p className="pf-help">입력한 계좌로 지급되므로 은행명·계좌번호·예금주를 정확히 확인해 주세요. 신청한 금액은 처리 중 금액으로 이동합니다.</p>
    {confirmation&&!completed&&<div className="pf-notice" role="region" aria-label="출금 신청 최종 확인"><strong>출금 신청 최종 확인</strong><p>신청 금액: <strong>{available.toLocaleString("ko-KR")}원</strong></p><p>은행: {confirmation.bankName}</p><p>계좌번호: {confirmation.accountNumber.length>4?`${"*".repeat(Math.min(8,confirmation.accountNumber.length-4))}${confirmation.accountNumber.slice(-4)}`:"****"}</p><p>예금주: {confirmation.accountHolder}</p><p>확정하면 출금 가능 수익 전체가 지급 처리 대기 상태로 전환됩니다.</p><button type="button" className="pf-primary" onClick={() => {setConfirmation(null);setMessage("");}}>계좌정보 수정</button></div>}
    <button className="pf-primary" type="submit">{completed?"신청 접수 완료":loading?"신청 중…":confirmation?"출금 신청 최종 확정":`${available.toLocaleString("ko-KR")}원 출금 신청 확인`}</button></fieldset>
    {message&&<p className="pf-notice" role="status">{message}</p>}{outcomeUnknown&&<div className="pf-notice" role="alert"><strong>신청 결과 확인 필요</strong><p>신청이 이미 접수되었을 수 있습니다. 신청 내역을 새로 확인한 후 처리해 주세요.</p><button type="button" className="pf-primary" disabled={historyLoading} onClick={checkRecentRequests}>{historyLoading?"내역 확인 중…":"최근 신청 내역 확인"}</button>{historyMessage&&<p role="status">{historyMessage}</p>}{historyMatches.length>0&&<div role="region" aria-label="동일 금액 정산 신청 내역"><ul style={{listStyle:"none",padding:0,margin:"12px 0",display:"grid",gap:8}}>{historyMatches.map(row=><li key={row.settlementCode} style={{padding:12,border:"1px solid var(--border,#d9e2ed)",borderRadius:10,overflowWrap:"anywhere"}}><strong>{row.settlementCode}</strong><div>신청 금액: {row.requestedAmount.toLocaleString("ko-KR")}원</div><div>처리 상태: {({REQUESTED:"접수",APPROVED:"승인",PAID:"지급 완료",REJECTED:"반려"} as Record<string,string>)[row.status]??"확인 필요"}</div></li>)}</ul></div>}<a href="/partner/settlements">출금 신청 내역 확인</a></div>}</form></section>;
}
