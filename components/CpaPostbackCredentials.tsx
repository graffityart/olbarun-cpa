"use client";
import {useState} from "react";

export default function CpaPostbackCredentials({campaignId}:{campaignId:string}){
 const [token,setToken]=useState("");const [url,setUrl]=useState("");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 async function load(){setBusy(true);setMessage("");try{const r=await fetch(`/api/admin/campaigns/${campaignId}/postback-key`,{cache:"no-store",credentials:"same-origin"});const data=await r.json();if(!r.ok||!data.ok)throw Error(data.error??"조회 실패");setToken(data.token);setUrl(data.postbackUrl);}catch(e){setMessage(e instanceof Error?e.message:"인증키를 불러올 수 없습니다.");}finally{setBusy(false);}}
 async function copy(){try{await navigator.clipboard.writeText(token);setMessage("인증키를 복사했습니다. 광고주 서버에서만 보관하세요.");}catch{setMessage("복사에 실패했습니다. HTTPS 환경을 확인하세요.");}}
 return <section className="panel card"><h2>외부 CPA 성과 연동</h2><p>이 캠페인에만 사용할 수 있는 Postback 인증키입니다. 광고주 서버 담당자에게 안전한 경로로 전달하세요. 공개 페이지나 브라우저 코드에 넣으면 안 됩니다.</p><p><strong>전송 주소:</strong> <code>{url||"https://www.mypickup.kr/api/postback/cpa"}</code></p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" className="cm-primary" onClick={load} disabled={busy}>{busy?"조회 중…":token?"인증키 다시 조회":"인증키 확인"}</button>{token&&<button type="button" className="btn" onClick={copy}>인증키 복사</button>}{token&&<button type="button" className="btn" onClick={()=>{setToken("");setMessage("인증키를 화면에서 숨겼습니다.");}}>숨기기</button>}</div>{token&&<p role="status">인증키가 준비되었습니다. 보안을 위해 화면에 전체 문자열을 표시하지 않습니다.</p>}{message&&<p role="status">{message}</p>}</section>;
}
