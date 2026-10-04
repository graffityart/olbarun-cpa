import DashboardShell from "@/components/DashboardShell";import AdminPasswordForm from "@/components/AdminPasswordForm";import {requireAdmin} from "@/lib/auth/guards";
export const dynamic="force-dynamic";
const nav=[{href:"/admin",label:"대시보드"},{href:"/admin/partners",label:"파트너 관리"},{href:"/admin/advertisers",label:"광고주 관리"},{href:"/admin/campaigns",label:"캠페인 관리"},{href:"/admin/conversions",label:"전환 DB"},{href:"/admin/settlements",label:"정산"},{href:"/admin/settings",label:"관리자 설정"}];
export default async function Page(){await requireAdmin();return <DashboardShell title="관리자 설정" description="관리자 계정의 보안 설정을 관리합니다." nav={nav}><AdminPasswordForm/></DashboardShell>}
