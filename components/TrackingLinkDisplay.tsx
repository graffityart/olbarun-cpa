"use client";
import {useState} from 'react';
export default function TrackingLinkDisplay({url}:{url:string}){const[message,setMessage]=useState('');return <div className="cx-link"><input aria-label="광고링크 주소" value={url} readOnly onFocus={e=>e.target.select()}/><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(url);setMessage('링크를 복사했습니다.');}catch{setMessage('주소를 선택해 직접 복사해 주세요.');}}}>링크 복사</button><a href={url} target="_blank" rel="noopener noreferrer">링크 열기 ↗</a>{message&&<p role="status">{message}</p>}</div>}
