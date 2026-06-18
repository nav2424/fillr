-- Lock down high-impact client writes:
-- - profile entitlement/quota fields are server-managed
-- - shared barcode product cache is read-only to app clients

drop policy if exists "Products can be inserted" on public.products;
drop policy if exists "Products can be updated" on public.products;

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

revoke insert, update on public.profiles from anon, authenticated;
revoke insert, update on public.products from anon, authenticated;

grant select on public.profiles to authenticated;
grant insert (id, email, full_name, updated_at) on public.profiles to authenticated;
grant update (email, full_name, onboarding_completed, referral_code, updated_at)
  on public.profiles to authenticated;

grant select on public.products to anon, authenticated;

create or replace function public.increment_my_scan_usage()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.profiles
  set total_scans_used = coalesce(total_scans_used, 0) + 1,
      updated_at = now()
  where id = uid;
end;
$$;

revoke all on function public.increment_my_scan_usage() from public;
grant execute on function public.increment_my_scan_usage() to authenticated;
