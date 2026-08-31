"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdvertiserCreateForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    const response = await fetch("/api/admin/advertisers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error === "CREATE_FAILED" ? "DB 테이블 생성 후 등록할 수 있습니다." : "입력값을 확인해주세요.");
      setSubmitting(false);
      return;
    }

    router.push("/admin/advertisers");
    router.refresh();
  }

  return (
    <form className="panel card form-card" onSubmit={onSubmit}>
      <div className="form-grid">
        <label className="full">업체명 *<input name="companyName" required placeholder="예: 올바른이사" /></label>
        <label>사업자등록번호<input name="businessNumber" placeholder="000-00-00000" /></label>
        <label>대표자<input name="representativeName" /></label>
        <label className="full">홈페이지<input name="websiteUrl" type="url" placeholder="https://" /></label>
        <label>계약상태<select name="contractStatus" defaultValue="LEAD"><option value="LEAD">영업중</option><option value="REVIEW">검토중</option><option value="ACTIVE">운영중</option><option value="PAUSED">중지</option><option value="TERMINATED">종료</option></select></label>
        <label>결제방식<select name="paymentType" defaultValue="PREPAID"><option value="PREPAID">선불</option><option value="POSTPAID">후불</option><option value="CONTRACT">계약조건</option></select></label>
      </div>
      {message ? <p className="form-message">{message}</p> : null}
      <div className="form-actions"><a className="btn" href="/admin/advertisers">취소</a><button disabled={submitting}>{submitting ? "등록 중..." : "광고주 등록"}</button></div>
    </form>
  );
}
