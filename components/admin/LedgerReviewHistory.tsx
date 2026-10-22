"use client";
import { useState } from "react";

type Entry = { id: string; at: string; reviewer: string; status: string; note: string | null };
export default function LedgerReviewHistory({ entries }: { entries: Entry[] }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const visible = entries.slice((page - 1) * pageSize, page * pageSize);
  return <details><summary>검토 이력 전체 ({entries.length}건)</summary>
    {visible.map(entry => <p key={entry.id} className="muted">{new Date(entry.at).toLocaleString("ko-KR")} · {entry.reviewer} · {entry.status === "RESOLVED" ? "검토 완료" : entry.status === "IN_REVIEW" ? "검토 중" : "재검토"}{entry.note ? ` · ${entry.note}` : ""}</p>)}
    {entries.length > pageSize ? <div style={{display:"flex",gap:8,alignItems:"center"}}>
      <button type="button" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>이전</button>
      <span>{page} / {totalPages} 페이지</span>
      <button type="button" disabled={page===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>다음</button>
    </div> : null}
  </details>;
}
