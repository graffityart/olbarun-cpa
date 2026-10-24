-- Read-only preflight. Run on a database copy or production read-only session.
-- Do not create indexes until both duplicate counts are zero.
select 'advertiser_ledger' as source, count(*) as duplicate_conversion_groups
from (
  select conversion_id from advertiser_ledger
  where conversion_id is not null
  group by conversion_id having count(*) > 1
) d
union all
select 'earnings', count(*)
from (
  select conversion_id from earnings
  where conversion_id is not null
  group by conversion_id having count(*) > 1
) d;

-- Check whether the intended unique indexes already exist.
select tablename, indexname, indexdef
from pg_indexes
where schemaname = current_schema()
  and tablename in ('advertiser_ledger', 'earnings')
  and indexname in ('advertiser_ledger_conversion_unique', 'earnings_conversion_unique')
order by tablename, indexname;
