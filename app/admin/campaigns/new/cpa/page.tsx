import DashboardShell from "@/components/DashboardShell";

const nav = [{ href: "/admin/campaigns", label: "← 캠페인 관리" }];
const steps = ["기본정보", "CPA 조건", "랜딩·신청폼", "광고자료", "파트너 정책", "예산·운영", "검토·등록"];

export default function NewCpaCampaignPage() {
  return (
    <DashboardShell title="CPA 캠페인 등록" description="7단계로 CPA 캠페인의 운영조건을 설정합니다." nav={nav}>
      <div className="wizard-steps">{steps.map((step, i) => <span key={step} className={i === 0 ? "active" : ""}>{i + 1}. {step}</span>)}</div>
      <section className="panel card form-card">
        <h2>1. 기본정보</h2>
        <div className="form-grid">
          <label>광고주 *<select defaultValue=""><option value="" disabled>광고주 선택</option></select></label>
          <label>카테고리 *<select defaultValue=""><option value="" disabled>카테고리 선택</option><option>이사</option><option>청소</option><option>인터넷</option><option>렌탈</option><option>교육</option></select></label>
          <label className="full">캠페인명 *<input placeholder="예: 부산 포장이사 무료견적" /></label>
          <label className="full">캠페인 설명<textarea rows={5} placeholder="파트너에게 보여줄 캠페인 설명을 입력하세요." /></label>
          <label>시작일<input type="date" /></label>
          <label>종료일<input type="date" /></label>
          <label className="full">광고지역<input placeholder="예: 부산 전체 또는 부산 해운대구, 수영구" /></label>
        </div>
        <div className="form-actions"><button className="secondary">임시저장</button><button>다음: CPA 조건</button></div>
      </section>
    </DashboardShell>
  );
}
