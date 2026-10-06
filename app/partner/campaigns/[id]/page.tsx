import Link from "next/link";
import { eq,sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import TrackingLinkCreator from "@/components/TrackingLinkCreator";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/auth/guards";
import { campaigns, advertisers } from "@/db/schema";
import "../cpa-market.css";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePartner();
  const { id } = await params;if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
  const [row] = await getDb().select({ campaign: campaigns, partnerRate:sql<number|null>`(select partner_base_rate from campaign_rates where campaign_id=${campaigns.id} and effective_from<=now() and (effective_to is null or effective_to>now()) order by effective_from desc,created_at desc,id desc limit 1)`, advertiser: advertisers }).from(campaigns).leftJoin(advertisers, eq(advertisers.id, campaigns.advertiserId)).where(eq(campaigns.id, id)).limit(1);
  if (!row || row.campaign.type !== "CPA" || !["ACTIVE","PAUSED","COMPLETED"].includes(row.campaign.status)) notFound();
  const c = row.campaign;const now=new Date();const open=c.status==="ACTIVE"&&(!c.startAt||c.startAt<=now)&&(!c.endAt||c.endAt>now); const settings = (c.settings ?? {}) as Record<string, unknown>;
  return <DashboardShell title="CPA알바" description="캠페인 상세 조건을 확인한 뒤 전용 광고링크를 생성하세요." nav={[{ href: "/partner/campaigns", label: "← CPA알바" }, { href: "/partner/links", label: "내 광고링크" }]}>
    <div className="cpa-detail cx-detail"><Link href="/partner/campaigns" className="cx-back">← CPA 캠페인 목록</Link>
      <section className="detail-hero"><div><span className="cpa-kicker">MY PICKUP · CPA CAMPAIGN</span><h2>{c.name}</h2><p>{c.description ?? "캠페인의 운영 조건과 승인 기준을 확인하세요."}</p><div className="hero-pills"><span>{c.category ?? "CPA"}</span><span>{open ? "모집 중" : "현재 참여 불가"}</span><span>{row.advertiser?.companyName ?? "마이픽업 제휴 광고주"}</span></div></div><div className="detail-pay"><small>승인 1건당 예상 수익</small><strong>{row.partnerRate==null?"단가 확인 중":row.partnerRate.toLocaleString("ko-KR")+"원"}</strong><span>승인 완료 건 기준</span></div></section>
      <div className="detail-layout"><main><section className="panel card detail-section"><h3>캠페인 핵심 조건</h3><div className="detail-metrics"><div><span>중복기간</span><b>{c.duplicateDays}일</b></div><div><span>검수기간</span><b>{c.reviewDays}일</b></div><div><span>광고지역</span><b>{String(settings.region ?? "별도 지정 없음")}</b></div><div><span>운영시간</span><b>{String(settings.operatingHours ?? "별도 지정 없음")}</b></div></div></section>
      <section className="panel card detail-section"><h3>승인 및 운영 정책</h3><div className="policy-row"><b>✓ 승인조건</b><p>{String(settings.approvalRules ?? "별도 승인 조건을 관리자에게 확인해 주세요.")}</p></div><div className="policy-row reject"><b>× 거절조건</b><p>{String(settings.rejectionRules ?? "별도 거절 조건을 관리자에게 확인해 주세요.")}</p></div><div className="policy-row"><b>허용매체</b><p>{String(settings.allowedMedia ?? "별도 허용 매체 안내 없음")}</p></div><div className="policy-row reject"><b>금지매체</b><p>{String(settings.prohibitedMedia ?? "별도 금지 매체 안내 없음")}</p></div></section></main>
      <aside><div className="detail-sticky"><div className="detail-side-title"><span>캠페인 참여</span><b>전용 링크 만들기</b></div>{open?<TrackingLinkCreator campaignId={c.id} />:<div className="cx-notice">현재 모집 기간 또는 상태로 광고링크를 생성할 수 없습니다.</div>}<p className="detail-note">생성된 링크를 통해 발생한 성과만 내 실적으로 추적됩니다.</p></div></aside></div>
    </div>
  </DashboardShell>;
}
