import DashboardShell from "@/components/DashboardShell";

const nav = [{ href: "/admin/campaigns", label: "← 캠페인 관리" }];
const steps = ["기본정보", "모집조건", "작성가이드", "제공자료", "검수조건", "비용·운영", "검토·등록"];

export default function NewPostingCampaignPage() {
  return (
    <DashboardShell title="포스팅 캠페인 등록" description="DBDBdeep 포스팅알바의 업무 흐름을 참고해 더 간단한 7단계 구조로 구성합니다." nav={nav}>
      <div className="wizard-steps">{steps.map((step, i) => <span key={step} className={i === 0 ? "active" : ""}>{i + 1}. {step}</span>)}</div>
      <section className="panel card form-card">
        <h2>1. 기본정보</h2>
        <div className="form-grid">
          <label>광고주 *<select defaultValue=""><option value="" disabled>광고주 선택</option></select></label>
          <label>광고매체 *<select defaultValue="BLOG"><option value="BLOG">네이버 블로그</option><option value="CAFE">카페</option><option value="SNS">SNS</option><option value="OTHER">기타</option></select></label>
          <label className="full">캠페인명 *<input placeholder="예: 부산 포장이사 후기 콘텐츠 모집" /></label>
          <label className="full">캠페인 소개<textarea rows={5} placeholder="파트너가 작업 전에 확인할 캠페인 목적과 내용을 입력하세요." /></label>
          <label>모집 시작일<input type="date" /></label>
          <label>모집 종료일<input type="date" /></label>
        </div>
        <div className="form-actions"><button className="secondary">임시저장</button><button>다음: 모집조건</button></div>
      </section>
    </DashboardShell>
  );
}
