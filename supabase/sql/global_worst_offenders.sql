-- Community "worst offenders" for the home watchlist (all Fillr users).
-- SECURITY DEFINER reads scan_history across users; returns only aggregated counts + display names.
-- Apply in Supabase SQL Editor (or migration) before relying on the client RPC.

create or replace function public.get_global_worst_offenders(
  p_week_start timestamptz,
  p_week_end timestamptz,
  p_limit int default 4
)
returns table (
  ingredient_display text,
  scan_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with flagged_lines as (
    select
      sh.id as scan_id,
      trim(both from coalesce(elem->>'name', '')) as raw_name,
      coalesce(elem->>'ingredientRating', '') as rating
    from public.scan_history sh
    cross join lateral jsonb_array_elements(coalesce(sh.result_json->'ingredientBreakdown', '[]'::jsonb)) as elem
    where sh.result_json is not null
      and sh.created_at >= p_week_start
      and sh.created_at <= p_week_end
      and coalesce(elem->>'ingredientRating', '') in ('concerning', 'avoid')
      and length(trim(both from coalesce(elem->>'name', ''))) > 0
  ),
  normalized as (
    select
      scan_id,
      regexp_replace(lower(trim(both from raw_name)), '\s+', ' ', 'g') as norm_key,
      raw_name
    from flagged_lines
  ),
  dedup_per_scan as (
    select distinct scan_id, norm_key, raw_name
    from normalized
    where length(norm_key) > 0
  ),
  counts as (
    select norm_key, count(*)::bigint as cnt
    from dedup_per_scan
    group by norm_key
  ),
  display_pick as (
    select distinct on (d.norm_key)
      d.norm_key,
      d.raw_name as display_name
    from dedup_per_scan d
    order by d.norm_key, length(d.raw_name) desc
  )
  select
    p.display_name as ingredient_display,
    c.cnt as scan_count
  from counts c
  join display_pick p on p.norm_key = c.norm_key
  order by c.cnt desc, p.display_name asc
  limit greatest(1, least(coalesce(nullif(p_limit, 0), 4), 50));
$$;

revoke all on function public.get_global_worst_offenders(timestamptz, timestamptz, int) from public;
grant execute on function public.get_global_worst_offenders(timestamptz, timestamptz, int) to anon, authenticated;
