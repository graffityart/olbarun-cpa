import DashboardShell from "@/components/DashboardShell";
import QuickJobMarket,{type QuickJob} from "@/components/QuickJobMarket";
import "./quick.css";
export const metadata={title:"1초알바 | 마이픽업",description:"앱 설치, 채널 구독, 간단 참여 등 짧은 미션을 완료하고 수익을 받는 마이픽업 1초알바입니다."};
const nav=[{href:"/partner",label:"대시보드"},{href:"/partner/campaigns",label:"CPA 캠페인"},{href:"/partner/posting",label:"포스팅 광고"},{href:"/partner/quick",label:"1초알바"},{href:"/partner/earnings",label:"수익"},{href:"/partner/settlements",label:"정산"}];
const jobs:QuickJob[]=[
{id:"app-01",title:"앱 설치 후 첫 화면 확인",type:"앱설치",reward:500,remaining:83,status:"OPEN",icon:"A",description:"안내된 앱을 설치하고 지정 화면까지 진행해 주세요."},
{id:"app-02",title:"신규 앱 설치 및 간단 체험",type:"앱설치",reward:700,remaining:42,status:"OPEN",icon:"A",description:"앱 설치 후 가이드에 안내된 간단 체험을 완료합니다."},
{id:"channel-01",title:"공식 채널 구독 미션",type:"채널구독",reward:300,remaining:126,status:"OPEN",icon:"▶",description:"지정 채널을 구독하고 완료 화면을 인증해 주세요."},
{id:"video-01",title:"짧은 영상 시청 참여",type:"영상시청",reward:250,remaining:215,status:"OPEN",icon:"▶",description:"안내된 콘텐츠를 확인하고 참여 조건을 완료합니다."},
{id:"visit-01",title:"서비스 페이지 방문 미션",type:"페이지방문",reward:200,remaining:310,status:"OPEN",icon:"↗",description:"지정 페이지에 방문해 안내된 미션을 수행합니다."},
{id:"survey-01",title:"간단 설문 참여",type:"설문",reward:600,remaining:67,status:"OPEN",icon:"✓",description:"짧은 설문 문항에 응답하고 제출을 완료합니다."},
{id:"app-03",title:"앱 설치 참여 이벤트",type:"앱설치",reward:500,remaining:0,status:"CLOSED",icon:"A",description:"모집 수량이 모두 소진된 작업입니다."},
{id:"sns-01",title:"SNS 계정 팔로우 미션",type:"SNS",reward:300,remaining:94,status:"OPEN",icon:"#",description:"지정 SNS 계정을 확인하고 참여 조건을 완료합니다."}
];
export default function Page(){const open=jobs.filter(x=>x.status==="OPEN").length;return <DashboardShell title="1초알바" description="짧고 간단한 미션으로 부담 없이 수익을 시작해보세요." nav={nav}><main className="quick-market"><section className="qj-hero"><div><span>MY PICKUP · QUICK JOB</span><h1>클릭하고 참여하면<br/><b>짧은 미션도 수익이 됩니다.</b></h1><p>앱 설치·채널 구독·페이지 방문·설문처럼 간단한 작업을 골라 참여하고, 완료 조건을 충족하면 수익으로 반영됩니다.</p><div><i>✓ 간편 참여</i><i>✓ 건별 수익</i><i>✓ 완료 내역 확인</i></div></div><aside><small>현재 참여가능</small><strong>{open}</strong><b>개의 1초알바</b></aside></section><section className="qj-how"><b>1초알바 이용방법</b><span><i>1</i>작업 선택</span><span><i>2</i>미션 진행</span><span><i>3</i>완료 등록</span><span><i>4</i>검수</span><span><i>5</i>수익 반영</span></section><section className="qj-notice"><b>처음 참여하시나요?</b><p>각 작업마다 인정 조건과 중복 참여 기준이 다릅니다. <strong>작업등록 전 상세 가이드를 먼저 확인</strong>해 주세요.</p><a href="/about">초보자 가이드 →</a></section><QuickJobMarket items={jobs}/><section className="qj-bottom"><div><span>QUICK JOB GUIDE</span><h2>간단하지만 참여 조건은 꼭 확인하세요.</h2><p>이미 참여한 작업, 동일 기기·계정 중복, 조건을 충족하지 않은 인증은 검수 과정에서 인정되지 않을 수 있습니다.</p></div><ul><li>작업별 참여 가능 대상 확인</li><li>중복 참여 기준 확인</li><li>완료 화면 및 인증 조건 확인</li><li>검수 완료 후 수익 반영</li></ul></section></main></DashboardShell>}