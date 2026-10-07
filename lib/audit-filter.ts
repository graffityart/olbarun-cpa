import {and,eq,or,sql} from 'drizzle-orm';
import {auditLogs,users} from '@/db/schema';
export function parseAuditFilter(params:{q?:string|string[];target?:string|string[]}){return {q:typeof params.q==='string'?params.q.trim().slice(0,100):'',target:typeof params.target==='string'&&/^[A-Z_]{1,50}$/.test(params.target)?params.target:''};}
export function auditFilterWhere(filter:{q:string;target:string}){
 const literal=filter.q.toLocaleLowerCase('ko-KR');
 return and(filter.target?eq(auditLogs.targetType,filter.target):undefined,literal?or(sql`position(${literal} in lower(${auditLogs.summary})) > 0`,sql`position(${literal} in lower(${auditLogs.action})) > 0`,sql`position(${literal} in lower(coalesce(${users.email}, 'system'))) > 0`,sql`position(${literal} in lower(coalesce(${auditLogs.targetId}, ''))) > 0`):undefined);
}
