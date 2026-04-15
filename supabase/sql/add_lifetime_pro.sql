-- Run once in Supabase SQL Editor (existing projects).
-- New installs: column is already in schema.sql.

alter table public.profiles
  add column if not exists lifetime_pro boolean not null default false;

comment on column public.profiles.lifetime_pro is
  'Grandfathered Fillr Premium; client treats as premium with or without RevenueCat.';

drop view if exists public.users;

create or replace view public.users as
select
  id,
  email,
  created_at,
  referral_code,
  referred_by,
  total_scans_used,
  bonus_scans_earned,
  is_pro,
  lifetime_pro,
  pro_expiry
from public.profiles;
