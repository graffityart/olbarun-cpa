import DashboardShell from "@/components/DashboardShell";
import AdvertiserCreateForm from "@/components/AdvertiserCreateForm";

const nav = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/advertisers", label: "광고주 관리" },
  { href: "/admin/campaigns", label: "캠페인 관리" },
];

export default function NewAdvertiserPage() {
  return (
    <DashboardShell title="광고주 등록" description="광고주 기본정보와 계약·결제 유형을 등록합니다." nav={nav}>
      <AdvertiserCreateForm />
    </DashboardShell>
  );
}
