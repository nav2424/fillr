-- Analytics helper: top "wrong" ingredients from correctness feedback.
-- Depends on `public.scan_result_events` (see scan_result_events.sql).

create index if not exists scan_result_events_wrong_ingredient_idx
  on public.scan_result_events ((payload_json ->> 'wrong_ingredient'), created_at desc)
  where event_name = 'scan_result_correctness_feedback';

create or replace view public.scan_result_wrong_ingredients_last_7d as
select
  lower(trim(payload_json ->> 'wrong_ingredient')) as ingredient_name,
  count(*)::bigint as wrong_count,
  count(distinct user_id)::bigint as unique_users,
  min(created_at) as first_seen_at,
  max(created_at) as last_seen_at
from public.scan_result_events
where event_name = 'scan_result_correctness_feedback'
  and payload_json ->> 'response' = 'wrong'
  and coalesce(trim(payload_json ->> 'wrong_ingredient'), '') <> ''
  and created_at >= now() - interval '7 days'
group by lower(trim(payload_json ->> 'wrong_ingredient'))
order by wrong_count desc, unique_users desc, ingredient_name asc;

comment on view public.scan_result_wrong_ingredients_last_7d is
  'Top ingredients users marked as wrong in scan correctness feedback during the last 7 days.';

create or replace view public.scan_result_wrong_ingredients_last_30d as
select
  lower(trim(payload_json ->> 'wrong_ingredient')) as ingredient_name,
  count(*)::bigint as wrong_count,
  count(distinct user_id)::bigint as unique_users,
  min(created_at) as first_seen_at,
  max(created_at) as last_seen_at
from public.scan_result_events
where event_name = 'scan_result_correctness_feedback'
  and payload_json ->> 'response' = 'wrong'
  and coalesce(trim(payload_json ->> 'wrong_ingredient'), '') <> ''
  and created_at >= now() - interval '30 days'
group by lower(trim(payload_json ->> 'wrong_ingredient'))
order by wrong_count desc, unique_users desc, ingredient_name asc;

comment on view public.scan_result_wrong_ingredients_last_30d is
  'Top ingredients users marked as wrong in scan correctness feedback during the last 30 days.';

create or replace view public.scan_result_wrong_ingredients_daily_last_30d as
select
  date_trunc('day', created_at)::date as day,
  lower(trim(payload_json ->> 'wrong_ingredient')) as ingredient_name,
  count(*)::bigint as wrong_count,
  count(distinct user_id)::bigint as unique_users
from public.scan_result_events
where event_name = 'scan_result_correctness_feedback'
  and payload_json ->> 'response' = 'wrong'
  and coalesce(trim(payload_json ->> 'wrong_ingredient'), '') <> ''
  and created_at >= now() - interval '30 days'
group by 1, 2
order by day desc, wrong_count desc, ingredient_name asc;

comment on view public.scan_result_wrong_ingredients_daily_last_30d is
  'Daily trend of ingredients users marked as wrong in scan correctness feedback during the last 30 days.';

drop materialized view if exists public.scan_result_wrong_ingredients_summary;
create materialized view public.scan_result_wrong_ingredients_summary as
with base as (
  select
    lower(trim(payload_json ->> 'wrong_ingredient')) as ingredient_name,
    user_id,
    created_at
  from public.scan_result_events
  where event_name = 'scan_result_correctness_feedback'
    and payload_json ->> 'response' = 'wrong'
    and coalesce(trim(payload_json ->> 'wrong_ingredient'), '') <> ''
    and created_at >= now() - interval '30 days'
),
agg as (
  select
    ingredient_name,
    count(*) filter (where created_at >= now() - interval '7 days')::bigint as wrong_count_7d,
    count(distinct user_id) filter (where created_at >= now() - interval '7 days')::bigint as unique_users_7d,
    count(*) filter (
      where created_at >= now() - interval '14 days'
        and created_at < now() - interval '7 days'
    )::bigint as wrong_count_prev_7d,
    count(*)::bigint as wrong_count_30d,
    count(distinct user_id)::bigint as unique_users_30d,
    min(created_at) as first_seen_at,
    max(created_at) as last_seen_at
  from base
  group by ingredient_name
)
select
  ingredient_name,
  wrong_count_7d,
  unique_users_7d,
  wrong_count_prev_7d,
  (wrong_count_7d - wrong_count_prev_7d)::bigint as wow_delta,
  wrong_count_30d,
  unique_users_30d,
  first_seen_at,
  last_seen_at
from agg
order by wrong_count_7d desc, wow_delta desc, wrong_count_30d desc, ingredient_name asc;

create unique index if not exists scan_result_wrong_ingredients_summary_name_idx
  on public.scan_result_wrong_ingredients_summary (ingredient_name);

comment on materialized view public.scan_result_wrong_ingredients_summary is
  'Combined 7d/30d wrong-ingredient feedback summary with week-over-week delta.';

create or replace function public.refresh_and_get_wrong_ingredients_summary(limit_rows integer default 50)
returns table (
  ingredient_name text,
  wrong_count_7d bigint,
  unique_users_7d bigint,
  wrong_count_prev_7d bigint,
  wow_delta bigint,
  wrong_count_30d bigint,
  unique_users_30d bigint,
  first_seen_at timestamptz,
  last_seen_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.scan_result_wrong_ingredients_summary;
  return query
  select
    s.ingredient_name,
    s.wrong_count_7d,
    s.unique_users_7d,
    s.wrong_count_prev_7d,
    s.wow_delta,
    s.wrong_count_30d,
    s.unique_users_30d,
    s.first_seen_at,
    s.last_seen_at
  from public.scan_result_wrong_ingredients_summary s
  order by s.wrong_count_7d desc, s.wow_delta desc, s.wrong_count_30d desc, s.ingredient_name asc
  limit greatest(coalesce(limit_rows, 50), 1);
end;
$$;

grant execute on function public.refresh_and_get_wrong_ingredients_summary(integer) to authenticated;

create or replace view public.scan_result_verification_recommended_last_30d as
select
  date_trunc('day', created_at)::date as day,
  count(*)::bigint as rendered_count,
  count(*) filter (
    where coalesce((payload_json ->> 'verification_recommended')::boolean, false) = true
  )::bigint as verification_recommended_count,
  case
    when count(*) = 0 then 0::numeric
    else round(
      (
        count(*) filter (
          where coalesce((payload_json ->> 'verification_recommended')::boolean, false) = true
        )::numeric
        / count(*)::numeric
      ) * 100,
      2
    )
  end as verification_recommended_rate_pct
from public.scan_result_events
where event_name = 'scan_result_rendered'
  and created_at >= now() - interval '30 days'
group by 1
order by day desc;

comment on view public.scan_result_verification_recommended_last_30d is
  'Daily rendered scans and verification-recommended rate for the last 30 days.';

create or replace function public.get_top_uncertain_ingredients_last_30d(limit_rows integer default 50)
returns table (
  ingredient_name text,
  uncertain_clicks bigint,
  unique_users bigint,
  first_seen_at timestamptz,
  last_seen_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    lower(trim(payload_json ->> 'ingredient')) as ingredient_name,
    count(*)::bigint as uncertain_clicks,
    count(distinct user_id)::bigint as unique_users,
    min(created_at) as first_seen_at,
    max(created_at) as last_seen_at
  from public.scan_result_events
  where event_name = 'possible_match_action_clicked'
    and coalesce(trim(payload_json ->> 'ingredient'), '') <> ''
    and created_at >= now() - interval '30 days'
  group by lower(trim(payload_json ->> 'ingredient'))
  order by uncertain_clicks desc, unique_users desc, ingredient_name asc
  limit greatest(coalesce(limit_rows, 50), 1);
$$;

grant execute on function public.get_top_uncertain_ingredients_last_30d(integer) to authenticated;

-- Example query:
-- select * from public.scan_result_wrong_ingredients_last_7d limit 25;
-- select * from public.scan_result_wrong_ingredients_last_30d limit 25;
-- select * from public.scan_result_wrong_ingredients_daily_last_30d limit 100;
-- refresh materialized view public.scan_result_wrong_ingredients_summary;
-- select * from public.scan_result_wrong_ingredients_summary limit 50;
-- select * from public.refresh_and_get_wrong_ingredients_summary(50);
-- select * from public.scan_result_verification_recommended_last_30d;
-- select * from public.get_top_uncertain_ingredients_last_30d(50);

