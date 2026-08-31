import DashboardShell from "@/components/DashboardShell";
import PostingCampaignForm from "@/components/PostingCampaignForm";
import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { advertisers } from "@/db/schema";

export const dynamic = "force-dynamic";
const nav = [{ href: "/admin/campaigns", label: "← 캠페인 관리" }];
const steps = ["기본정보", "모집조건", "작성가이드", "제공자료", "검수조건", "비용·운영", "검토·등록"];

async function loadAdvertisers() { try { return await getDb().select().from(advertisers).orderBy(asc(advertisers.companyName)); } catch { return []; } }

export default async function NewPostingCampaignPage() {
  const advertiserRows = await loadAdvertisers();
  const items = advertiserRows.map(({ id, companyName, advertiserCode }) => ({ id, companyName, advertiserCode }));
  return <DashboardShell title="포스팅 캠페인 등록" description="모집조건, 작성가이드, 검수조건과 비용을 입력하고 임시저장합니다." nav={nav}>
    <div className="wizard-steps">{steps.map((step, i) => <span key={step} className={i < 3 ? "active" : ""}>{i + 1}. {step}</span>)}</div>
    {!items.length ? <section className="panel card form-card"><div className="notice-box">등록된 광고주가 없습니다. 먼저 <a href="/admin/advertisers/new"><strong>광고주를 등록</strong></a>해 주세요.</div></section> : <PostingCampaignForm advertisers={items} />}
  </DashboardShell>;
}
