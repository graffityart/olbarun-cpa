"use client";
import {useEffect,useRef,useState} from 'react';
export default function TrackingLinkDisplay({url}:{url:string}){
  const [message,setMessage]=useState('');
  const [canShare,setCanShare]=useState(false);
  useEffect(()=>{setCanShare(typeof navigator.share==='function')},[]);
  useEffect(()=>{setMessage('')},[url]);
  const inputRef=useRef<HTMLInputElement>(null);
  async function copyLink(){
    try{
      if(!navigator.clipboard?.writeText)throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(url);
      setMessage('링크를 복사했습니다.');
    }catch{
      inputRef.current?.focus();
      inputRef.current?.select();
      setMessage('링크 주소를 선택했습니다. Ctrl+C(모바일은 길게 누르기)로 복사해 주세요.');
    }
  }
  async function shareLink(){
    if(!navigator.share)return;
    try{await navigator.share({title:'마이픽업 광고링크',url});setMessage('링크 공유를 완료했습니다.');}
    catch(error){if(error instanceof Error&&error.name==='AbortError')return;setMessage('공유할 수 없습니다. 링크 복사를 이용해 주세요.');}
  }
  return <div className="cx-link"><input ref={inputRef} aria-label="광고링크 주소" value={url} readOnly onFocus={e=>e.target.select()}/><button type="button" onClick={copyLink}>링크 복사</button>{canShare&&<button type="button" onClick={shareLink}>링크 공유</button>}<a href={url} target="_blank" rel="noopener noreferrer">링크 열기 ↗</a>{message&&<p role="status">{message}</p>}</div>;
}
