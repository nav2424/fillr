-- Scan pipeline health analytics
-- Uses events emitted to public.scan_result_events.

create or replace view public.scan_source_decision_last_30d as
select
  date_trunc('day', created_at)::date as day,
  coalesce(payload_json ->> 'chosen_source', 'unknown') as chosen_source,
  count(*)::bigint as decision_count,
  round(avg(nullif((payload_json ->> 'off_score')::numeric, null)), 2) as avg_off_score,
  round(avg(nullif((payload_json ->> 'cached_score')::numeric, null)), 2) as avg_cached_score
from public.scan_result_events
where event_name = 'source_decision'
  and created_at >= now() - interval '30 days'
group by 1, 2
order by day desc, decision_count desc, chosen_source asc;

comment on view public.scan_source_decision_last_30d is
  'Daily source decision counts for scan fusion (OFF vs cached/backfill), with average score context.';

create or replace view public.scan_queue_write_health_last_30d as
select
  date_trunc('day', created_at)::date as day,
  coalesce(payload_json ->> 'lane', 'unknown') as lane,
  count(*)::bigint as write_count,
  count(*) filter (where coalesce((payload_json ->> 'success')::boolean, false) = true)::bigint as success_count,
  count(*) filter (where coalesce((payload_json ->> 'success')::boolean, false) = false)::bigint as failure_count,
  round(avg(coalesce((payload_json ->> 'queued_ahead')::numeric, 0)), 2) as avg_queued_ahead,
  round(avg(coalesce((payload_json ->> 'attempts')::numeric, 1)), 2) as avg_attempts,
  max(coalesce((payload_json ->> 'queued_ahead')::int, 0)) as max_queued_ahead
from public.scan_result_events
where event_name = 'queue_write_health'
  and created_at >= now() - interval '30 days'
group by 1, 2
order by day desc, lane asc;

comment on view public.scan_queue_write_health_last_30d is
  'Daily queue write telemetry by lane: success/failure counts, queue depth, and retry attempts.';

create or replace function public.get_scan_pipeline_health_snapshot(days_back integer default 7)
returns table (
  lane text,
  write_count bigint,
  success_count bigint,
  failure_count bigint,
  success_rate_pct numeric,
  avg_queued_ahead numeric,
  avg_attempts numeric,
  max_queued_ahead integer
)
language sql
stable
set search_path = public
as $$
  select
    coalesce(payload_json ->> 'lane', 'unknown') as lane,
    count(*)::bigint as write_count,
    count(*) filter (where coalesce((payload_json ->> 'success')::boolean, false) = true)::bigint as success_count,
    count(*) filter (where coalesce((payload_json ->> 'success')::boolean, false) = false)::bigint as failure_count,
    case
      when count(*) = 0 then 0::numeric
      else round(
        (
          count(*) filter (where coalesce((payload_json ->> 'success')::boolean, false) = true)::numeric
          / count(*)::numeric
        ) * 100,
        2
      )
    end as success_rate_pct,
    round(avg(coalesce((payload_json ->> 'queued_ahead')::numeric, 0)), 2) as avg_queued_ahead,
    round(avg(coalesce((payload_json ->> 'attempts')::numeric, 1)), 2) as avg_attempts,
    max(coalesce((payload_json ->> 'queued_ahead')::int, 0)) as max_queued_ahead
  from public.scan_result_events
  where event_name = 'queue_write_health'
    and created_at >= now() - make_interval(days => greatest(coalesce(days_back, 7), 1))
  group by coalesce(payload_json ->> 'lane', 'unknown')
  order by failure_count desc, avg_queued_ahead desc, lane asc;
$$;

grant execute on function public.get_scan_pipeline_health_snapshot(integer) to authenticated;

-- Example queries:
-- select * from public.scan_source_decision_last_30d;
-- select * from public.scan_queue_write_health_last_30d;
-- select * from public.get_scan_pipeline_health_snapshot(7);

