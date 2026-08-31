import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { campaigns } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function CampaignLanding({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const [campaign] = await getDb().select().from(campaigns).where(eq(campaigns.slug, slug)).limit(1); if (!campaign) notFound();
  return <main className="landing-shell"><section className="landing-hero"><span className="badge">{campaign.category ?? "CPA"}</span><h1>{campaign.name}</h1><p>{campaign.description ?? "간단한 정보를 남겨주시면 상담을 도와드립니다."}</p><a className="btn primary" href="#apply">무료 상담 신청</a></section><section id="apply" className="panel card landing-form"><h2>상담 신청</h2><p className="muted">다음 단계에서 캠페인별 신청폼과 개인정보 동의, Conversion 저장을 연결합니다.</p><div className="form-grid"><label>이름<input disabled placeholder="이름" /></label><label>휴대전화<input disabled placeholder="010-0000-0000" /></label></div></section></main>;
}
