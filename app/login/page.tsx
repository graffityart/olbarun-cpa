import Link from 'next/link';
import LoginForm from '@/components/LoginForm';
import './auth.css';
import './login.css';
export default async function Page({searchParams}:{searchParams:Promise<{next?:string|string[];error?:string|string[]}>}){
 const params=await searchParams;
 return <main className="au-page login-page"><div className="login-layout"><section className="login-welcome" aria-label="마이픽업 소개"><div className="login-welcome-copy"><span className="login-pill">당신의 다음 기회를 픽업</span><h2>좋은 기회를 만나고,<br/><em>함께 성장하는 곳.</em></h2><p>나에게 맞는 캠페인을 발견하고<br/>마이픽업에서 새로운 활동을 시작하세요.</p><Link href="/about">처음이라면, 이용가이드 <span aria-hidden="true">↗</span></Link></div><div className="login-welcome-footer"><span aria-hidden="true">✦</span> 오늘의 작은 시작이 새로운 가능성으로.</div></section><div className="login-form-column"><LoginForm next={typeof params.next==='string'?params.next:undefined} notice={params.error==='account_not_active'?'계정 상태를 확인해 주세요. 광고주 승인 대기 또는 이용이 제한된 계정일 수 있습니다.':undefined}/><Link className="au-home" href="/">← 홈으로 돌아가기</Link></div></div></main>;
}
