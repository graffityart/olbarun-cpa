import Link from 'next/link';import PartnerSignupForm from '@/components/PartnerSignupForm';import '../../login/auth.css';
export default function Page(){return <main className="au-page"><div className="au-wrap"><Link className="au-brand" href="/">마이픽업<small>MY PICKUP</small></Link><PartnerSignupForm/><Link className="au-home" href="/">홈으로 돌아가기</Link></div></main>}
