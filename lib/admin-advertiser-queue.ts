import {and,desc,getTableColumns,sql} from 'drizzle-orm';
import {getDb} from '@/db';
import {advertisers} from '@/db/schema';
import {contractStatus} from '@/lib/admin-members';

export const advertiserAccountStatuses:Record<string,string>={PENDING:'가입 승인 대기',ACTIVE:'이용 가능',SUSPENDED:'이용 중지',WITHDRAWN:'탈퇴',NONE:'계정 미생성'};
export function parseAdvertiserFilters(p:Record<string,string|string[]|undefined>){
 return {q:typeof p.q==='string'?p.q.trim().slice(0,160):'',status:typeof p.status==='string'&&Object.hasOwn(contractStatus,p.status)?p.status:'ALL',accountStatus:typeof p.accountStatus==='string'&&Object.hasOwn(advertiserAccountStatuses,p.accountStatus)?p.accountStatus:'ALL'};
}
const accountStatus=sql<string|null>`(select u.status::text from advertiser_users au join users u on u.id=au.user_id where au.advertiser_id="advertisers"."id" order by (au.role='OWNER') desc,au.id limit 1)`;
export async function listAdminAdvertisers(filters:ReturnType<typeof parseAdvertiserFilters>){
 const {q,status,accountStatus:account}=filters;
 return getDb().select({...getTableColumns(advertisers),accountStatus}).from(advertisers).where(and(
 status==='ALL'?undefined:sql`${advertisers.contractStatus}=${status}`,
 account==='ALL'?undefined:account==='NONE'?sql`${accountStatus} is null`:sql`${accountStatus}=${account}`,
 q?sql`position(lower(${q}) in lower(${advertisers.companyName} || ' ' || ${advertisers.advertiserCode} || ' ' || coalesce(${advertisers.representativeName},'')))>0`:undefined
 )).orderBy(desc(advertisers.createdAt)).limit(100);
}
export async function countPendingAdvertisers(){
 const [row]=await getDb().select({n:sql<number>`count(*)::int`}).from(advertisers).where(sql`${accountStatus}='PENDING'`);
 return Number(row?.n??0);
}
