-- Run on live Supabase after deploying app with FREE_SCAN_LIMIT=3.
-- Updates referrer grant from +5 to +3 per conversion (invitee stays +3).

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
  set bonus_scans_earned = least(max_bonus, coalesce(bonus_scans_earned, 0) + 3),
      updated_at = now()
  where id = referrer_id;

  update public.referrals
  set bonus_granted = true,
      bonus_granted_at = now()
  where id = r.id;

  return query select true, 'granted';
end;
$$;
