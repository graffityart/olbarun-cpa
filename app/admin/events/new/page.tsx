import DashboardShell from "@/components/DashboardShell";
import EventWriteForm from "@/components/EventWriteForm";
import {requireAdmin} from "@/lib/auth/guards";
import "../../notices/new/notice-editor.css";
export default async function Page(){await requireAdmin();return <DashboardShell title="이벤트 등록" description="관리자 전용 이벤트 작성 화면입니다." nav={[{href:"/admin/events",label:"← 이벤트 관리"}]}><section className="panel card"><EventWriteForm/></section></DashboardShell>}
