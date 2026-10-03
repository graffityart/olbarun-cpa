import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import TrackingLinkCreator from "@/components/TrackingLinkCreator";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/auth/guards";
import { campaignRates, campaigns, advertisers } from "@/db/schema";
import "../cpa-market.css";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePartner();
  const { id } = await params;
  const [row] = await getDb().select({ campaign: campaigns, rate: campaignRates, advertiser: advertisers }).from(campaigns).leftJoin(campaignRates, eq(campaignRates.campaignId, campaigns.id)).leftJoin(advertisers, eq(advertisers.id, campaigns.advertiserId)).where(eq(campaigns.id, id)).limit(1);
  if (!row || row.campaign.type !== "CPA") notFound();
  const c = row.campaign; const settings = (c.settings ?? {}) as Record<string, unknown>;
  return <DashboardShell title={c.name} description="캠페인 상세 조건을 확인한 뒤 전용 광고링크를 생성하세요." nav={[{ href: "/partner/campaigns", label: "← CPA알바" }, { href: "/partner/links", label: "내 광고링크" }]}>
    <div className="cpa-detail">
      <section className="detail-hero"><div><span className="cpa-kicker">MY PICKUP · CPA CAMPAIGN</span><h2>{c.name}</h2><p>{c.description ?? "캠페인의 운영 조건과 승인 기준을 확인하세요."}</p><div className="hero-pills"><span>{c.category ?? "CPA"}</span><span>{c.status === "ACTIVE" ? "● 모집중" : c.status}</span><span>{row.advertiser?.companyName ?? "마이픽업 제휴 광고주"}</span></div></div><div className="detail-pay"><small>승인 1건당 예상 수익</small><strong>{(row.rate?.partnerBaseRate ?? 0).toLocaleString("ko-KR")}원</strong><span>승인 완료 건 기준</span></div></section>
      <div className="detail-layout"><main><section className="panel card detail-section"><h3>캠페인 핵심 조건</h3><div className="detail-metrics"><div><span>중복기간</span><b>{c.duplicateDays}일</b></div><div><span>검수기간</span><b>{c.reviewDays}일</b></div><div><span>광고지역</span><b>{String(settings.region ?? "제한 없음")}</b></div><div><span>운영시간</span><b>{String(settings.operatingHours ?? "상시 접수")}</b></div></div></section>
      <section className="panel card detail-section"><h3>승인 및 운영 정책</h3><div className="policy-row"><b>✓ 승인조건</b><p>{String(settings.approvalRules ?? "정상 연락처와 실제 상담 의사가 확인된 유효 신청")}</p></div><div className="policy-row reject"><b>× 거절조건</b><p>{String(settings.rejectionRules ?? "중복·허위번호·타인정보·서비스 대상 외 신청 등")}</p></div><div className="policy-row"><b>허용매체</b><p>{String(settings.allowedMedia ?? "블로그, SNS, 홈페이지 등 정상적인 온라인 매체")}</p></div><div className="policy-row reject"><b>금지매체</b><p>{String(settings.prohibitedMedia ?? "스팸, 허위·과장 표현, 부정 유입 및 정책 위반 매체")}</p></div></section></main>
      <aside><div className="detail-sticky"><div className="detail-side-title"><span>캠페인 참여</span><b>전용 링크 만들기</b></div><TrackingLinkCreator campaignId={c.id} /><p className="detail-note">생성된 링크를 통해 발생한 성과만 내 실적으로 추적됩니다.</p></div></aside></div>
    </div>
  </DashboardShell>;
}
