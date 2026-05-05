-- Scan results UX metrics telemetry (best-effort client inserts).

create table if not exists public.scan_result_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  barcode text not null,
  event_name text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists scan_result_events_user_idx
  on public.scan_result_events (user_id, created_at desc);

create index if not exists scan_result_events_event_idx
  on public.scan_result_events (event_name, created_at desc);

alter table public.scan_result_events enable row level security;

drop policy if exists "scan_result_events_select_own_user" on public.scan_result_events;
drop policy if exists "scan_result_events_insert_own_user" on public.scan_result_events;

create policy "scan_result_events_select_own_user"
  on public.scan_result_events
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "scan_result_events_insert_own_user"
  on public.scan_result_events
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

grant select, insert on public.scan_result_events to authenticated;

