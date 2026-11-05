import DashboardShell from "@/components/DashboardShell";
import AdvertiserPostingRequestForm from "@/components/AdvertiserPostingRequestForm";
import {requireAdvertiser} from "@/lib/auth/advertiser";
import {advertiserNav} from "@/lib/advertiser-ui";
import "../../advertiser.css";
export const dynamic="force-dynamic";
export default async function Page(){await requireAdvertiser();return <DashboardShell title="포스팅알바 등록" description="광고주 직접 등록 · 관리자 승인형" nav={advertiserNav}><AdvertiserPostingRequestForm/></DashboardShell>;}
