"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdvertiserAccountManager({ advertiserId }: { advertiserId: string }) {
  const router = useRouter();
  const [accountMessage, setAccountMessage] = useState("");
  const [depositMessage, setDepositMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function createAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setAccountMessage("");
    const f = new FormData(e.currentTarget);
    const res = await fetch(`/api/admin/advertisers/${advertiserId}/account`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: f.get("email"), password: f.get("password") }) });
    const data = await res.json(); setLoading(false);
    setAccountMessage(data.ok ? "광고주 로그인 계정을 생성했습니다." : `계정 생성 실패: ${data.error}`);
    if (data.ok) { e.currentTarget.reset(); router.refresh(); }
  }

  async function addDeposit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setDepositMessage("");
    const f = new FormData(e.currentTarget);
    const res = await fetch(`/api/admin/advertisers/${advertiserId}/deposit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: Number(f.get("amount") || 0), description: f.get("description") }) });
    const data = await res.json(); setLoading(false);
    setDepositMessage(data.ok ? `예치금 ${Number(data.amount).toLocaleString("ko-KR")}원을 충전했습니다.` : `충전 실패: ${data.error}`);
    if (data.ok) { e.currentTarget.reset(); router.refresh(); }
  }

  return <div className="grid-2">
    <form className="panel card" onSubmit={createAccount}><h2>광고주 로그인 계정</h2><div className="form-grid"><label className="full">이메일 *<input name="email" type="email" required /></label><label className="full">초기 비밀번호 *<input name="password" type="password" minLength={8} required /></label></div>{accountMessage&&<p className="form-message">{accountMessage}</p>}<div className="form-actions"><button disabled={loading}>계정 생성</button></div></form>
    <form className="panel card" onSubmit={addDeposit}><h2>예치금 충전</h2><div className="form-grid"><label className="full">충전금액 *<input name="amount" type="number" min="1" step="1000" required /></label><label className="full">메모<input name="description" placeholder="예: 9월 광고비 입금" /></label></div>{depositMessage&&<p className="form-message">{depositMessage}</p>}<div className="form-actions"><button disabled={loading}>예치금 충전</button></div></form>
  </div>;
}
