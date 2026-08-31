import DashboardShell from "@/components/DashboardShell";
import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { advertisers } from "@/db/schema";

export const dynamic = "force-dynamic";

const nav = [{ href: "/admin/campaigns", label: "← 캠페인 관리" }];
const steps = ["기본정보", "모집조건", "작성가이드", "제공자료", "검수조건", "비용·운영", "검토·등록"];

async function loadAdvertisers() {
  try {
    return await getDb().select().from(advertisers).orderBy(asc(advertisers.companyName));
  } catch {
    return [];
  }
}

export default async function NewPostingCampaignPage() {
  const advertiserRows = await loadAdvertisers();

  return (
    <DashboardShell title="포스팅 캠페인 등록" description="포스팅 업무 흐름을 7단계로 구성합니다." nav={nav}>
      <div className="wizard-steps">{steps.map((step, i) => <span key={step} className={i === 0 ? "active" : ""}>{i + 1}. {step}</span>)}</div>
      <section className="panel card form-card">
        <h2>1. 기본정보</h2>
        {!advertiserRows.length && <div className="notice-box">등록된 광고주가 없습니다. 먼저 <a href="/admin/advertisers/new"><strong>광고주를 등록</strong></a>해 주세요.</div>}
        <div className="form-grid">
          <label>광고주 *
            <select defaultValue="" disabled={!advertiserRows.length}>
              <option value="" disabled>광고주 선택</option>
              {advertiserRows.map((row) => <option key={row.id} value={row.id}>{row.companyName} · {row.advertiserCode}</option>)}
            </select>
          </label>
          <label>광고매체 *<select defaultValue="BLOG"><option value="BLOG">네이버 블로그</option><option value="CAFE">카페</option><option value="SNS">SNS</option><option value="OTHER">기타</option></select></label>
          <label className="full">캠페인명 *<input placeholder="예: 부산 포장이사 후기 콘텐츠 모집" /></label>
          <label className="full">캠페인 소개<textarea rows={5} placeholder="파트너가 작업 전에 확인할 캠페인 목적과 내용을 입력하세요." /></label>
          <label>모집 시작일<input type="date" /></label>
          <label>모집 종료일<input type="date" /></label>
        </div>
        <div className="form-actions"><button className="secondary">임시저장</button><button disabled={!advertiserRows.length}>다음: 모집조건</button></div>
      </section>
    </DashboardShell>
  );
}
