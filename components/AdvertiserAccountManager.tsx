"use client";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdvertiserAccountManager({ advertiserId,hasAccount=false }: { advertiserId: string;hasAccount?:boolean }) {
  const router = useRouter();
  const [accountMessage, setAccountMessage] = useState("");
  const [depositMessage, setDepositMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  async function createAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    submitting.current = true; setLoading(true); setAccountMessage("");
    try {
      const res = await fetch(`/api/admin/advertisers/${advertiserId}/account`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: f.get("email"), password: f.get("password") }) });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const messages:Record<string,string>={EMAIL_ALREADY_EXISTS:"이미 사용 중인 이메일입니다.",ACCOUNT_ALREADY_EXISTS:"이미 로그인 계정이 있습니다. 화면을 새로고침해 확인해 주세요.",INVALID_INPUT:"이메일과 비밀번호(10~128자)를 확인해 주세요."};
        throw new Error(messages[data.error] ?? "계정 생성 결과를 확인하지 못했습니다. 계정 상태를 먼저 확인해 주세요.");
      }
      setAccountMessage("광고주 로그인 계정을 생성했습니다."); form.reset(); router.refresh();
    } catch (error) {
      setAccountMessage(error instanceof TypeError ? "연결이 원활하지 않습니다. 다시 신청하기 전에 계정 생성 여부를 확인해 주세요." : error instanceof SyntaxError ? "응답을 확인하지 못했습니다. 계정 생성 여부를 먼저 확인해 주세요." : error instanceof Error ? error.message : "계정 생성 결과를 확인하지 못했습니다.");
    } finally { submitting.current=false; setLoading(false); }
  }

  async function addDeposit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    submitting.current = true; setLoading(true); setDepositMessage("");
    try {
      const res = await fetch(`/api/admin/advertisers/${advertiserId}/deposit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: Number(f.get("amount") || 0), description: f.get("description") }) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error === "INVALID_AMOUNT" ? "충전금액을 확인해 주세요." : "충전 결과를 확인하지 못했습니다. 다시 충전하기 전에 최근 광고비 장부를 확인해 주세요.");
      setDepositMessage(`예치금 ${Number(data.amount).toLocaleString("ko-KR")}원을 충전했습니다.`); form.reset(); router.refresh();
    } catch (error) {
      setDepositMessage(error instanceof TypeError || error instanceof SyntaxError ? "응답을 확인하지 못했습니다. 다시 충전하기 전에 최근 광고비 장부를 확인해 주세요." : error instanceof Error ? error.message : "충전 결과를 확인하지 못했습니다. 최근 광고비 장부를 확인해 주세요.");
    } finally { submitting.current=false; setLoading(false); }
  }

  return <div className="grid-2">
    {!hasAccount&&<form className="panel card" aria-busy={loading} onSubmit={createAccount}><h2>광고주 로그인 계정</h2><fieldset disabled={loading} style={{border:0,padding:0,margin:0,minWidth:0}}><div className="form-grid"><label className="full">이메일 *<input name="email" type="email" maxLength={320} autoComplete="email" required /></label><label className="full">초기 비밀번호 *<input name="password" type="password" minLength={10} maxLength={128} autoComplete="new-password" required /></label></div>{accountMessage&&<p className="form-message" role="status">{accountMessage}</p>}<div className="form-actions"><button disabled={loading}>{loading?"처리 중…":"계정 생성"}</button></div></fieldset></form>}
    <form className="panel card" aria-busy={loading} onSubmit={addDeposit}><h2>예치금 충전</h2><fieldset disabled={loading} style={{border:0,padding:0,margin:0,minWidth:0}}><div className="form-grid"><label className="full">충전금액 *<input name="amount" type="number" min="1" step="1000" required /></label><label className="full">메모<input name="description" placeholder="예: 9월 광고비 입금" /></label></div>{depositMessage&&<p className="form-message" role="status">{depositMessage}</p>}<div className="form-actions"><button disabled={loading}>{loading?"처리 중…":"예치금 충전"}</button></div></fieldset></form>
  </div>;
}
