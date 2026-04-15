-- Ingredient knowledge cache (shared library). Run in Supabase SQL Editor after main schema.
-- Requires uuid-ossp (same as schema.sql). Client reads via anon; writes via SECURITY DEFINER RPCs.

create table if not exists public.ingredient_knowledge (
  id uuid primary key default uuid_generate_v4(),
  name_normalized text unique not null,
  name_display text not null,
  common_name text,
  explanation text,
  what_it_is text,
  what_it_does_in_product text,
  body_effect text,
  fun_fact text,
  base_rating text not null check (base_rating in ('clean', 'okay', 'concerning', 'avoid')),
  rating_reason text,
  context_stat text,
  regulatory_flags jsonb not null default '[]'::jsonb,
  scan_count integer not null default 1,
  positive_feedback integer not null default 0,
  negative_feedback integer not null default 0,
  confidence_score double precision not null default 0.7,
  source text not null default 'openai',
  created_at timestamptz not null default now(),
  last_updated timestamptz not null default now()
);

create index if not exists ingredient_knowledge_name_normalized_idx
  on public.ingredient_knowledge (name_normalized);

alter table public.ingredient_knowledge enable row level security;

-- Anyone can read (public reference data). Drop first so this file is safe to re-run.
drop policy if exists "ingredient_knowledge_select_public" on public.ingredient_knowledge;
create policy "ingredient_knowledge_select_public"
  on public.ingredient_knowledge for select
  using (true);

-- No insert/update/delete policies for anon/authenticated — use RPCs below.

-- Passive scan counter (called after cache hit)
create or replace function public.increment_ingredient_knowledge_scan_count(p_name_normalized text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ingredient_knowledge
  set
    scan_count = scan_count + 1,
    last_updated = now()
  where name_normalized = lower(trim(p_name_normalized));
end;
$$;

-- Upsert row from app after OpenAI (or backfill)
create or replace function public.upsert_ingredient_knowledge(
  p_name_normalized text,
  p_name_display text,
  p_common_name text,
  p_explanation text,
  p_what_it_is text,
  p_what_it_does_in_product text,
  p_body_effect text,
  p_fun_fact text,
  p_base_rating text,
  p_rating_reason text,
  p_context_stat text,
  p_regulatory_flags jsonb,
  p_source text default 'openai'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n text := lower(trim(p_name_normalized));
  r text := lower(trim(p_base_rating));
begin
  if r not in ('clean', 'okay', 'concerning', 'avoid') then
    return;
  end if;
  insert into public.ingredient_knowledge (
    name_normalized,
    name_display,
    common_name,
    explanation,
    what_it_is,
    what_it_does_in_product,
    body_effect,
    fun_fact,
    base_rating,
    rating_reason,
    context_stat,
    regulatory_flags,
    source,
    scan_count,
    last_updated
  ) values (
    n,
    trim(p_name_display),
    nullif(trim(p_common_name), ''),
    nullif(trim(p_explanation), ''),
    nullif(trim(p_what_it_is), ''),
    nullif(trim(p_what_it_does_in_product), ''),
    nullif(trim(p_body_effect), ''),
    nullif(trim(p_fun_fact), ''),
    r,
    nullif(trim(p_rating_reason), ''),
    nullif(trim(p_context_stat), ''),
    coalesce(p_regulatory_flags, '[]'::jsonb),
    coalesce(nullif(trim(p_source), ''), 'openai'),
    1,
    now()
  )
  on conflict (name_normalized) do update set
    name_display = excluded.name_display,
    common_name = excluded.common_name,
    explanation = excluded.explanation,
    what_it_is = excluded.what_it_is,
    what_it_does_in_product = excluded.what_it_does_in_product,
    body_effect = excluded.body_effect,
    fun_fact = excluded.fun_fact,
    base_rating = excluded.base_rating,
    rating_reason = excluded.rating_reason,
    context_stat = excluded.context_stat,
    regulatory_flags = excluded.regulatory_flags,
    source = excluded.source,
    last_updated = now()
  where ingredient_knowledge.source != 'verified';
end;
$$;

-- Thumbs up / down on ingredient cards
create or replace function public.increment_feedback(p_name text, p_field text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n text := lower(trim(p_name));
begin
  if p_field is null or p_field not in ('positive_feedback', 'negative_feedback') then
    return;
  end if;
  update public.ingredient_knowledge
  set
    negative_feedback = case
      when p_field = 'negative_feedback' then negative_feedback + 1
      else negative_feedback
    end,
    positive_feedback = case
      when p_field = 'positive_feedback' then positive_feedback + 1
      else positive_feedback
    end,
    last_updated = now()
  where name_normalized = n;
end;
$$;

grant select on public.ingredient_knowledge to anon, authenticated;
grant execute on function public.increment_ingredient_knowledge_scan_count(text) to anon, authenticated;
grant execute on function public.upsert_ingredient_knowledge(
  text, text, text, text, text, text, text, text, text, text, text, jsonb, text
) to anon, authenticated;
grant execute on function public.increment_feedback(text, text) to anon, authenticated;
