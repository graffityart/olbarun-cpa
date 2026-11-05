"use client";
import { useState } from "react";

export default function AdditionalAdminRecovery() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/recover-additional-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error === "CURRENT_PASSWORD_INVALID" ? "현재 로그인한 관리자 비밀번호가 올바르지 않습니다." : result.error === "PASSWORD_LENGTH" ? "새 비밀번호는 12~128자로 설정해 주세요." : "비밀번호 재설정에 실패했습니다.");
      setCurrentPassword("");
      setNewPassword("");
      setMessage("추가 관리자 비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "요청에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return <section style={{maxWidth:560,marginTop:28,padding:24,border:"1px solid #ddd",borderRadius:14}}>
    <h2 style={{fontSize:20,fontWeight:700,marginBottom:8}}>추가 관리자 비밀번호 초기화</h2>
    <p style={{marginBottom:16}}>대상: admin@naver.com · 기존 관리자 본인 확인 후 새 비밀번호를 지정합니다.</p>
    <form onSubmit={submit} style={{display:"grid",gap:12}}>
      <label>현재 로그인한 관리자 비밀번호<input autoComplete="current-password" type="password" required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} style={{display:"block",width:"100%",padding:10,marginTop:6,border:"1px solid #bbb",borderRadius:8}}/></label>
      <label>추가 관리자 새 비밀번호 (12자 이상)<input autoComplete="new-password" type="password" required minLength={12} maxLength={128} value={newPassword} onChange={e=>setNewPassword(e.target.value)} style={{display:"block",width:"100%",padding:10,marginTop:6,border:"1px solid #bbb",borderRadius:8}}/></label>
      <button type="submit" disabled={busy} style={{padding:12,borderRadius:8,background:"#1d4ed8",color:"white",fontWeight:700}}>{busy?"처리 중...":"추가 관리자 비밀번호 재설정"}</button>
      {message&&<p role="status">{message}</p>}
    </form>
  </section>;
}
