"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
export default function PostingThumbnailEditor({id,initial}:{id:string;initial:string|null}){
 const [image,setImage]=useState(initial),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const router=useRouter();
 async function select(file:File|undefined){
  if(!file)return;
  if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>5*1024*1024){setMessage("JPG·PNG·WebP 이미지 5MB 이하만 등록할 수 있습니다.");return;}
  try{
   const bitmap=await createImageBitmap(file);
   const canvas=document.createElement("canvas");canvas.width=640;canvas.height=400;
   const ctx=canvas.getContext("2d");if(!ctx)throw Error();
   const scale=Math.max(canvas.width/bitmap.width,canvas.height/bitmap.height);
   const w=bitmap.width*scale,h=bitmap.height*scale;
   ctx.drawImage(bitmap,(640-w)/2,(400-h)/2,w,h);bitmap.close();
   const data=canvas.toDataURL("image/webp",0.72);
   if(data.length>200000)throw Error("SIZE");
   setImage(data);setMessage("미리보기가 준비되었습니다. 저장 버튼을 눌러 적용하세요.");
  }catch{setMessage("이미지를 처리하지 못했습니다. 다른 이미지를 선택해 주세요.");}
 }
 async function save(){
  setBusy(true);setMessage("");
  try{
   const response=await fetch(`/api/admin/campaigns/${id}/thumbnail`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({image})});
   if(!response.ok)throw Error();
   setMessage("대표 이미지가 저장되었습니다. 메인 포스팅알바 카드에 반영됩니다.");router.refresh();
  }catch{setMessage("저장에 실패했습니다. 다시 시도해 주세요.");}
  finally{setBusy(false);}
 }
 return <section className="panel card" style={{padding:24,margin:"16px 0"}}>
  <h2>포스팅알바 메인 카드 대표 이미지</h2>
  <p>홈페이지의 POST 기본 이미지 대신 표시됩니다. 권장 비율은 8:5이며 업로드 시 자동으로 맞춰집니다.</p>
  <div style={{width:"min(100%,320px)",aspectRatio:"8 / 5",background:"#e8f3ee",borderRadius:12,overflow:"hidden",display:"grid",placeItems:"center",margin:"14px 0"}}>
   {image?<img src={image} alt="포스팅 대표 이미지 미리보기" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<strong>POST</strong>}
  </div>
  <label style={{display:"block",marginBottom:12}}>대표 이미지 선택 (JPG·PNG·WebP, 최대 5MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{void select(e.target.files?.[0]);e.target.value="";}} style={{display:"block",marginTop:8}}/></label>
  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
   <button type="button" disabled={busy} onClick={()=>void save()} style={{padding:"10px 18px",borderRadius:8,background:"#285ee5",color:"#fff"}}>{busy?"저장 중...":"대표 이미지 저장"}</button>
   <button type="button" disabled={busy} onClick={()=>setImage(null)} style={{padding:"10px 18px",borderRadius:8,border:"1px solid #cbd5e1"}}>기본 이미지로 변경</button>
  </div>
  {message&&<p role="status">{message}</p>}
 </section>;
}
