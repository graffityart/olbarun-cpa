import { sql } from "drizzle-orm";
import { auditLogs, settlements } from "@/db/schema";

/** Keep admin settlement filtering, totals and ordering on the same audit rule. */
export const settlementAuditSequence = sql`coalesce((select array_agg(${auditLogs.action}::text order by ${auditLogs.createdAt}, ${auditLogs.id}) from ${auditLogs} where ${auditLogs.targetType}='SETTLEMENT' and ${auditLogs.targetId}=${settlements.id}::text and ${auditLogs.action} in ('SETTLEMENT_APPROVE','SETTLEMENT_PAID','SETTLEMENT_REJECT')),ARRAY[]::text[])`;

export const settlementAuditAnomaly = sql`not (case when ${settlements.status}='REQUESTED' then ${settlementAuditSequence}=ARRAY[]::text[] when ${settlements.status}='APPROVED' then ${settlementAuditSequence}=ARRAY['SETTLEMENT_APPROVE']::text[] when ${settlements.status}='PAID' then ${settlementAuditSequence}=ARRAY['SETTLEMENT_APPROVE','SETTLEMENT_PAID']::text[] when ${settlements.status}='REJECTED' then ${settlementAuditSequence}=ARRAY['SETTLEMENT_REJECT']::text[] else false end)`;
