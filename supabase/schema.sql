-- Fillr Supabase Schema
-- Run this in Supabase SQL Editor to set up the database

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  onboarding_completed boolean default false,
  referral_code text unique,
  referred_by text,
  total_scans_used integer not null default 0,
  bonus_scans_earned integer not null default 0,
  is_pro boolean not null default false,
  /** Grandfathered premium — client treats as Fillr Premium regardless of RevenueCat. */
  lifetime_pro boolean not null default false,
  pro_expiry timestamptz,
  signup_device_id text,
  last_referral_attempt_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.referrals (
  id uuid primary key default uuid_generate_v4(),
  referrer_code text not null,
  new_user_id uuid references public.profiles(id) on delete cascade unique,
  created_at timestamptz default now(),
  bonus_granted boolean not null default false,
  bonus_granted_at timestamptz
);

create table if not exists public.referral_devices (
  id uuid primary key default uuid_generate_v4(),
  device_id text not null unique,
  first_seen_at timestamptz default now(),
  first_user_id uuid references public.profiles(id) on delete set null
);

-- Compatibility alias for product docs that reference a "users" table.
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

-- User settings / preferences
create table if not exists public.user_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade unique,
  primary_goal text,
  dietary_preferences jsonb default '[]',
  updated_at timestamptz default now()
);

-- User allergies
create table if not exists public.user_allergies (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  allergen_key text not null,
  severity text default 'allergy',
  created_at timestamptz default now(),
  unique(user_id, allergen_key)
);

-- User sensitivities
create table if not exists public.user_sensitivities (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  sensitivity_key text not null,
  created_at timestamptz default now(),
  unique(user_id, sensitivity_key)
);

-- Products (cached from scans / Open Food Facts)
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  barcode text unique not null,
  name text not null,
  brand text,
  image_url text,
  ingredient_text text,
  nutrition_json jsonb,
  source text default 'openfoodfacts',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ingredients (for explanations - optional enrichment)
create table if not exists public.ingredients (
  id uuid primary key default uuid_generate_v4(),
  canonical_name text not null,
  display_name text,
  plain_english text,
  function_summary text,
  common_uses text,
  notes text,
  synonyms jsonb default '[]',
  created_at timestamptz default now()
);

-- Ingredient-allergen links (for matching)
create table if not exists public.ingredient_allergen_links (
  id uuid primary key default uuid_generate_v4(),
  ingredient_id uuid references public.ingredients(id) on delete cascade,
  allergen_key text not null,
  match_type text,
  explanation text,
  created_at timestamptz default now()
);

-- Scan history
create table if not exists public.scan_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  barcode text not null,
  product_id uuid references public.products(id) on delete set null,
  result_json jsonb,
  created_at timestamptz default now()
);

-- Saved products
create table if not exists public.saved_products (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, product_id)
);

-- Disclaimer acknowledgments (legal audit trail; one row per user per disclaimer version)
create table if not exists public.user_acknowledgments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  disclaimer_version text not null default '1.0',
  platform text,
  app_version text,
  unique (user_id, disclaimer_version)
);

-- RLS policies
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_allergies enable row level security;
alter table public.user_sensitivities enable row level security;
alter table public.products enable row level security;
alter table public.ingredients enable row level security;
alter table public.ingredient_allergen_links enable row level security;
alter table public.scan_history enable row level security;
alter table public.saved_products enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_devices enable row level security;
alter table public.user_acknowledgments enable row level security;

-- Profiles: users can read/update own
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Users can view own referral basics" on public.profiles
  for select using (auth.uid() = id);

-- User settings: own only
create policy "Users can manage own settings" on public.user_settings
  for all using (auth.uid() = user_id);

-- User allergies: own only
create policy "Users can manage own allergies" on public.user_allergies
  for all using (auth.uid() = user_id);

-- User sensitivities: own only
create policy "Users can manage own sensitivities" on public.user_sensitivities
  for all using (auth.uid() = user_id);

-- Products: read for all (cached data)
create policy "Products are readable" on public.products
  for select using (true);
create policy "Products can be inserted" on public.products
  for insert with check (true);

-- Ingredients: read for all
create policy "Ingredients are readable" on public.ingredients
  for select using (true);

-- Ingredient-allergen links: read for all
create policy "Links are readable" on public.ingredient_allergen_links
  for select using (true);

-- Scan history: own only
create policy "Users can manage own scan history" on public.scan_history
  for all using (auth.uid() = user_id);

-- Saved products: own only
create policy "Users can manage own saved products" on public.saved_products
  for all using (auth.uid() = user_id);

-- Disclaimer acknowledgments: insert/select own rows (profile id = auth user id)
create policy "Users can insert own disclaimer acknowledgment" on public.user_acknowledgments
  for insert with check (auth.uid() = user_id);

create policy "Users can view own disclaimer acknowledgments" on public.user_acknowledgments
  for select using (auth.uid() = user_id);

create policy "Users can view own referrals" on public.referrals
  for select using (auth.uid() = new_user_id);

-- Utility: generate FLR-XXXX code with safe alphabet.
create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := 'FLR-';
  i integer;
begin
  for i in 1..4 loop
    code := code || substr(chars, 1 + floor(random() * length(chars))::integer, 1);
  end loop;
  return code;
end;
$$;

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  candidate text;
begin
  loop
    candidate := public.generate_referral_code();
    exit when not exists (select 1 from public.profiles p where p.referral_code = candidate);
  end loop;

  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name;

  update public.profiles
  set
    referral_code = coalesce(referral_code, candidate),
    referred_by = nullif(new.raw_user_meta_data->>'referred_by', ''),
    signup_device_id = nullif(new.raw_user_meta_data->>'signup_device_id', ''),
    updated_at = now()
  where id = new.id;

  -- Track first device seen for anti-abuse checks.
  if nullif(new.raw_user_meta_data->>'signup_device_id', '') is not null then
    insert into public.referral_devices (device_id, first_user_id)
    values (new.raw_user_meta_data->>'signup_device_id', new.id)
    on conflict (device_id) do nothing;
  end if;

  -- Seed referral row when signup had a ref code. Bonus is granted later after
  -- onboarding + first scan via finalize_referral_bonus().
  if nullif(new.raw_user_meta_data->>'referred_by', '') is not null then
    insert into public.referrals (referrer_code, new_user_id, bonus_granted)
    values (new.raw_user_meta_data->>'referred_by', new.id, false)
    on conflict (new_user_id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Grants referral bonuses once user is fully converted.
create or replace function public.finalize_referral_bonus(target_user_id uuid)
returns table(granted boolean, reason text)
language plpgsql
security definer
as $$
declare
  u public.profiles%rowtype;
  r public.referrals%rowtype;
  referrer_id uuid;
  referrer_bonus integer;
  max_bonus constant integer := 50;
begin
  if auth.uid() is null or auth.uid() <> target_user_id then
    return query select false, 'unauthorized';
    return;
  end if;

  select * into u from public.profiles where id = target_user_id;
  if not found then
    return query select false, 'user_not_found';
    return;
  end if;

  if coalesce(u.onboarding_completed, false) = false then
    return query select false, 'onboarding_incomplete';
    return;
  end if;

  if coalesce(u.total_scans_used, 0) < 1 then
    return query select false, 'needs_first_scan';
    return;
  end if;

  select * into r
  from public.referrals
  where new_user_id = target_user_id
  order by created_at asc
  limit 1;

  if not found then
    return query select false, 'no_referral';
    return;
  end if;

  if r.bonus_granted then
    return query select false, 'already_granted';
    return;
  end if;

  select id, bonus_scans_earned into referrer_id, referrer_bonus
  from public.profiles
  where referral_code = r.referrer_code
  limit 1;

  if referrer_id is null then
    return query select false, 'invalid_referrer';
    return;
  end if;

  if referrer_id = target_user_id then
    return query select false, 'self_referral';
    return;
  end if;

  -- 24h cooldown/device abuse heuristic.
  if u.signup_device_id is not null then
    if exists (
      select 1
      from public.profiles p
      where p.signup_device_id = u.signup_device_id
        and p.id <> u.id
        and p.created_at > now() - interval '24 hours'
    ) then
      return query select false, 'device_cooldown';
      return;
    end if;
  end if;

  update public.profiles
  set bonus_scans_earned = least(max_bonus, coalesce(bonus_scans_earned, 0) + 3),
      updated_at = now()
  where id = target_user_id;

  update public.profiles
  set bonus_scans_earned = least(max_bonus, coalesce(bonus_scans_earned, 0) + 5),
      updated_at = now()
  where id = referrer_id;

  update public.referrals
  set bonus_granted = true,
      bonus_granted_at = now()
  where id = r.id;

  return query select true, 'granted';
end;
$$;

-- Public-safe referral code validator used during signup.
create or replace function public.validate_referral_code(code text)
returns table(valid boolean, referrer_user_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := upper(trim(coalesce(code, '')));
  ref_id uuid;
begin
  if normalized !~ '^FLR-[A-Z2-9]{4}$' then
    return query select false, null::uuid;
    return;
  end if;

  select p.id
  into ref_id
  from public.profiles p
  where p.referral_code = normalized
  limit 1;

  if ref_id is null then
    return query select false, null::uuid;
    return;
  end if;

  if auth.uid() is not null and auth.uid() = ref_id then
    return query select false, null::uuid;
    return;
  end if;

  return query select true, ref_id;
end;
$$;

-- Returns referral conversion stats for the current user only.
create or replace function public.get_my_referral_stats()
returns table(
  referral_code text,
  referrals_joined bigint,
  bonus_scans_earned integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;

  return query
  select
    p.referral_code,
    coalesce((
      select count(*)::bigint
      from public.referrals r
      where r.referrer_code = p.referral_code
        and r.bonus_granted = true
    ), 0) as referrals_joined,
    coalesce(p.bonus_scans_earned, 0) as bonus_scans_earned
  from public.profiles p
  where p.id = uid
  limit 1;
end;
$$;

-- Admin growth view.
create or replace view public.referral_stats as
with referral_rows as (
  select r.*, p.referral_code, p.email
  from public.referrals r
  left join public.profiles p on p.referral_code = r.referrer_code
)
select
  (select count(*)::bigint from referral_rows) as total_referrals_sent,
  (select count(*)::bigint from referral_rows where bonus_granted) as total_referrals_converted,
  case
    when (select count(*) from referral_rows) = 0 then 0
    else round(
      ((select count(*)::numeric from referral_rows where bonus_granted)
      / (select count(*)::numeric from referral_rows)) * 100, 2
    )
  end as conversion_rate_pct,
  (
    select json_agg(t order by t.referrals_count desc)
    from (
      select
        rr.referrer_code,
        max(rr.email) as referrer_email,
        count(*)::int as referrals_count
      from referral_rows rr
      group by rr.referrer_code
      order by referrals_count desc
      limit 25
    ) t
  ) as top_referrers,
  (
    select coalesce(sum(
      case when bonus_granted then 8 else 0 end
    ), 0)::bigint
    from referral_rows
  ) as bonus_scans_given_total;

create policy "Enable insert for authenticated users" on public.profiles
  for insert with check (auth.uid() = id);

-- Trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Optional: shared ingredient decode cache (OpenAI results + feedback). See sql/ingredient_knowledge.sql.
-- Optional: per-scan ingredient cache telemetry. See sql/scan_ingredient_results.sql.
