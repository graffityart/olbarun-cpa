import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import TrackingLinkCreator from "@/components/TrackingLinkCreator";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/auth/guards";
import { campaignRates, campaigns } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePartner();
  const { id } = await params;
  const [row] = await getDb().select({ campaign: campaigns, rate: campaignRates }).from(campaigns).leftJoin(campaignRates, eq(campaignRates.campaignId, campaigns.id)).where(eq(campaigns.id, id)).limit(1);
  if (!row || row.campaign.type !== "CPA") notFound();
  const c = row.campaign; const settings = (c.settings ?? {}) as Record<string, unknown>;
  return <DashboardShell title={c.name} description={c.campaignCode} nav={[{ href: "/partner/campaigns", label: "← CPA 캠페인" }, { href: "/partner/links", label: "내 광고링크" }]}>
    <section className="grid-2"><div className="panel card"><h2>캠페인 조건</h2><p><strong>카테고리</strong><br/>{c.category ?? "-"}</p><p><strong>승인 수익</strong><br/>{(row.rate?.partnerBaseRate ?? 0).toLocaleString("ko-KR")}원</p><p><strong>중복기간</strong><br/>{c.duplicateDays}일</p><p><strong>검수기간</strong><br/>{c.reviewDays}일</p><p><strong>광고지역</strong><br/>{String(settings.region ?? "제한 없음")}</p></div><div className="panel card"><h2>운영 정책</h2><p><strong>승인조건</strong><br/>{String(settings.approvalRules ?? "관리자 기준에 따름")}</p><p><strong>거절조건</strong><br/>{String(settings.rejectionRules ?? "중복·허위·정책위반 등")}</p><p><strong>허용매체</strong><br/>{String(settings.allowedMedia ?? "별도 제한 없음")}</p><p><strong>금지매체</strong><br/>{String(settings.prohibitedMedia ?? "스팸 및 부정 유입 금지")}</p></div></section>
    <section style={{marginTop:18}}><TrackingLinkCreator campaignId={c.id} /></section>
  </DashboardShell>;
}
