import DashboardShell from '@/components/DashboardShell';
import NoticeWriteForm from '@/components/NoticeWriteForm';
import {requireAdmin} from '@/lib/auth/guards';
import './notice-editor.css';
export default async function Page(){await requireAdmin();return <DashboardShell title="공지사항 작성" description="관리자만 작성할 수 있습니다. 등록된 공지는 모든 방문자에게 표시됩니다." nav={[{href:'/customer',label:'← 공지사항'},{href:'/admin/customer',label:'문의 관리'}]}><section className="panel card"><NoticeWriteForm/></section></DashboardShell>}
