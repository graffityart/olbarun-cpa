"use client";
import {useEffect,useState} from "react";
import {upload as uploadBlob} from "@vercel/blob/client";
type Item={id:string;filename:string;file_size:number;created_at:string};
export default function PostingMaterialManager({campaignId,admin=false,kind="POSTING"}:{campaignId:string;admin?:boolean;kind?:"CPA"|"POSTING"}){
 const [downloading,setDownloading]=useState<string|null>(null),[items,setItems]=useState<Item[]>([]),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[listState,setListState]=useState<"loading"|"ready"|"error">("loading");
 async function refresh(){setListState("loading");try{const r=await fetch(`/api/posting-materials/${campaignId}`,{cache:"no-store"});if(r.ok){const j=await r.json();setItems(j.files??[]);setListState("ready");}else{setListState("error");setMessage("자료 목록을 불러올 수 없습니다.");}}catch{setListState("error");setMessage("자료 조회 중 연결 오류가 발생했습니다.");}}
 useEffect(()=>{void refresh();},[campaignId]);
 async function upload(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;const form=e.currentTarget;const file=new FormData(form).get("file");if(!(file instanceof File))return;const extForLimit=file.name.toLowerCase().match(/\.[^.]+$/)?.[0]??"";const limit=extForLimit===".zip"?50:extForLimit===".pdf"?20:10;if(file.size>limit*1024*1024){setMessage(`파일 크기 제한은 ZIP 50MB, PDF 20MB, 이미지 10MB입니다. (선택 파일 제한: ${limit}MB)`);return;}setBusy(true);setProgress(0);setMessage("");try{const ext=file.name.toLowerCase().match(/\.[^.]+$/)?.[0]??"";if(![".zip",".pdf",".jpg",".jpeg",".png",".webp"].includes(ext))throw Error("ZIP·PDF·JPG·PNG·WebP만 등록할 수 있습니다.");const uploaded=await uploadBlob(`campaigns/${campaignId}/${file.name.normalize("NFC").replace(/[\\/\x00-\x1f\x7f]/g,"_")}`,file,{access:"private",handleUploadUrl:`/api/campaign-blob-upload/${campaignId}`,multipart:file.size>5*1024*1024,onUploadProgress:({percentage})=>setProgress(Math.round(percentage))});const finalized=await fetch(`/api/campaign-blob-upload/${campaignId}/finalize`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:uploaded.url})});if(!finalized.ok){const detail=await finalized.json().catch(()=>({}));throw Error(detail.error??"자료 등록 확인에 실패했습니다.");}const saved=await finalized.json() as {id:string};form.reset();let confirmed=false;for(let attempt=0;attempt<8;attempt++){const response=await fetch(`/api/posting-materials/${campaignId}`,{cache:"no-store"});if(response.ok){const data=await response.json();const files=(data.files??[]) as Item[];setItems(files);if(files.some(item=>item.id===saved.id)){confirmed=true;break;}}await new Promise(resolve=>setTimeout(resolve,1000));}setMessage(confirmed?"자료 등록이 완료되었습니다.":"파일 전송이 완료되었습니다. 목록 반영이 지연되고 있으니 잠시 후 새로고침해 주세요.");}catch(err){setMessage(err instanceof Error?err.message:"업로드 실패");}finally{setBusy(false);}}
 async function download(item:Item){
  if(downloading)return;
  setDownloading(item.id);setMessage("");
  try{
   const response=await fetch(`/api/posting-materials/${campaignId}/${item.id}`,{credentials:"same-origin",cache:"no-store"});
   if(!response.ok)throw Error(response.status===401?"로그인 후 다시 다운로드해 주세요.":response.status===404?"자료가 삭제되었거나 다운로드할 수 없습니다.":"다운로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
   const blob=await response.blob();
   const url=URL.createObjectURL(blob);
   const anchor=document.createElement("a");anchor.href=url;anchor.download=item.filename;document.body.appendChild(anchor);anchor.click();anchor.remove();
   setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(error){setMessage(error instanceof Error?error.message:"다운로드에 실패했습니다.");}
  finally{setDownloading(null);}
 }
 async function remove(id:string){if(busy||!confirm("이 자료를 삭제하시겠습니까?"))return;setBusy(true);try{const r=await fetch(`/api/posting-materials/${campaignId}/${id}`,{method:"DELETE"});if(!r.ok)throw Error();await refresh();setMessage("삭제되었습니다.");}catch{setMessage("삭제에 실패했습니다.");}finally{setBusy(false);}}
 return <section className="pt-panel"><h2>{kind==="CPA"?"CPA 광고자료":"포스팅 제공 자료"}</h2><p>{kind==="CPA"?"공식 광고 이미지·ZIP·PDF 자료를 내려받아 승인된 홍보 매체에 사용하세요.":"이미지·ZIP·PDF 자료를 내려받아 작성 가이드에 맞게 사용하세요."}</p>{admin&&<form onSubmit={upload}><label>자료 업로드 (ZIP, PDF, JPG, PNG, WebP · ZIP 50MB · PDF 20MB · 이미지 10MB)<input type="file" name="file" accept=".zip,.pdf,.jpg,.jpeg,.png,.webp" required/></label><button disabled={busy} type="submit">{busy?"처리 중":"자료 등록"}</button></form>}
 {busy&&admin&&<p role="status">업로드 진행률: {progress}%</p>}{message&&<p role="status">{message}</p>}{items.length?<ul>{items.map(item=><li key={item.id}><button type="button" disabled={downloading!==null} onClick={()=>void download(item)}>{downloading===item.id?"다운로드 준비 중…":`${item.filename} (${(item.file_size/1024).toFixed(0)}KB) 다운로드`}</button>{admin&&<button type="button" disabled={busy} onClick={()=>void remove(item.id)}>삭제</button>}</li>)}</ul>:listState==="loading"?<p role="status">자료 목록을 불러오는 중입니다.</p>:listState==="error"?<p role="alert">자료 목록을 확인하지 못했습니다. <button type="button" onClick={()=>void refresh()}>다시 조회</button></p>:<p>현재 제공된 첨부자료가 없습니다.</p>}</section>;
}
