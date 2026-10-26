"use client";
import { useEffect } from "react";
import Link from "next/link";
export default function SettlementDetailError({error,reset}:{error:Error & {digest?:string};reset:()=>void}) {
 useEffect(()=>{console.error("Settlement detail failed",error);},[error]);
 return <main style={{maxWidth:720,margin:"64px auto",padding:24}}>
  <section className="panel card" role="alert">
   <h1>정산 상세 정보를 표시할 수 없습니다.</h1>
   <p>지급정보 열람 기록 저장에 실패했거나 일시적인 오류가 발생했습니다. 보안을 위해 상세 정보를 표시하지 않았습니다.</p>
   <p>잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 감사 기록 저장 상태 확인을 요청하세요.</p>
   <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:20}}>
    <button type="button" onClick={reset}>다시 시도</button>
    <Link href="/admin/settlements">정산 목록으로 돌아가기</Link>
   </div>
  </section>
 </main>;
}
