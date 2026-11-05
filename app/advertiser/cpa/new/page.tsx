import DashboardShell from "@/components/DashboardShell";
import AdvertiserCpaRequestForm from "@/components/AdvertiserCpaRequestForm";
import {requireAdvertiser} from "@/lib/auth/advertiser";
import {advertiserNav} from "@/lib/advertiser-ui";
import "../../advertiser.css";
export const dynamic="force-dynamic";
export default async function Page(){await requireAdvertiser();return <DashboardShell title="CPA 광고 신청" description="광고주 직접 등록 · 관리자 승인형" nav={advertiserNav}><AdvertiserCpaRequestForm/></DashboardShell>;}
