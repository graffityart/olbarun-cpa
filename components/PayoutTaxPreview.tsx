"use client";
import {useState} from "react";
import {estimatePayout,type PayoutTaxMode} from "@/lib/payout-tax";
export default function PayoutTaxPreview({amount}:{amount:number}){
 const [mode,setMode]=useState<PayoutTaxMode>("INDIVIDUAL");
 const estimate=estimatePayout(amount,mode);
 return <section className="pf-panel" aria-labelledby="payout-estimate"><div className="pf-section-head"><div><h2 id="payout-estimate">출금 예상 금액</h2><p>개인·사업자 지급 방식에 따른 참고 금액을 미리 확인하세요.</p></div></div>
 <label>출금 유형 <select value={mode} onChange={e=>setMode(e.target.value as PayoutTaxMode)}><option value="INDIVIDUAL">개인 (3.3% 공제)</option><option value="BUSINESS">사업자 (부가세 10% 합산)</option></select></label>
 <dl style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
 <div><dt>수익금 기준액</dt><dd><strong>{estimate.baseAmount.toLocaleString("ko-KR")}원</strong></dd></div>
 <div><dt>{mode==="INDIVIDUAL"?"예상 세금 공제":"예상 부가세"}</dt><dd><strong>{estimate.taxAdjustment.toLocaleString("ko-KR")}원</strong></dd></div>
 <div><dt>예상 지급액</dt><dd><strong>{estimate.estimatedPayment.toLocaleString("ko-KR")}원</strong></dd></div></dl>
 {mode==="BUSINESS"&&<p>사업자 출금 신청 후 세금계산서를 먼저 발행해 주세요. 발행 이메일: <strong>c0810@naver.com</strong></p>}
 <p className="pf-help">안내용 예상 계산입니다. 실제 출금 신청·정산 장부에는 아직 자동 반영되지 않습니다. 사업자 과세 유형과 세무 검토 결과에 따라 실제 지급액이 달라질 수 있습니다.</p></section>;
}
