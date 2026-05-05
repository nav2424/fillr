-- Per-ingredient cache vs OpenAI telemetry. Run in Supabase SQL Editor.
-- RLS: authenticated may INSERT only for their own scan_history rows; SELECT reserved for service role.

create table if not exists public.scan_ingredient_results (
  id uuid primary key default uuid_generate_v4(),
  scan_id uuid not null references public.scan_history (id) on delete cascade,
  ingredient_name text not null,
  from_cache boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists scan_ingredient_results_scan_id_idx
  on public.scan_ingredient_results (scan_id);

alter table public.scan_ingredient_results enable row level security;

-- Authenticated: insert only when linking to own scan_history row
drop policy if exists "scan_ingredient_results_insert_own_scan" on public.scan_ingredient_results;
create policy "scan_ingredient_results_insert_own_scan"
  on public.scan_ingredient_results
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.scan_history sh
      where sh.id = scan_id
        and sh.user_id = (select auth.uid())
    )
  );

-- No SELECT policy for anon/authenticated — clients cannot read this table; service role bypasses RLS.

grant insert on public.scan_ingredient_results to authenticated;
