"use client";

import { useState } from "react";

export default function PartnerApprovalButton({ partnerId }: { partnerId: string }) {
  const [loading, setLoading] = useState(false);
  async function approve() {
    if (!confirm("이 파트너를 승인하시겠습니까?")) return;
    setLoading(true);
    const res = await fetch(`/api/admin/partners/${partnerId}/approve`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (data.ok) window.location.reload(); else alert("승인 처리에 실패했습니다.");
  }
  return <button onClick={approve} disabled={loading}>{loading ? "처리 중" : "승인"}</button>;
}
