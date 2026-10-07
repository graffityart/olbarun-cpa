import Link from 'next/link';import AdvertiserSignupForm from '@/components/AdvertiserSignupForm';import '../../login/auth.css';
export const metadata={title:'광고주 가입 신청 | 마이픽업'};
export default function Page(){return <main className="au-page"><div className="au-wrap"><Link className="au-brand" href="/">마이픽업<small>MY PICKUP</small></Link><AdvertiserSignupForm/><Link className="au-home" href="/">홈으로 돌아가기</Link></div></main>}
