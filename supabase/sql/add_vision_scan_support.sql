-- Support GPT-4o vision scans without a barcode-backed catalog row.
alter table public.products
  alter column barcode drop not null;

alter table public.products
  add column if not exists vision_confidence numeric;

create index if not exists products_vision_name_brand_idx
  on public.products (lower(name), lower(coalesce(brand, '')))
  where source = 'gpt4o_vision';

-- Atomically charge one scan before the product-vision function calls OpenAI.
create or replace function public.consume_vision_scan_credit()
returns table(allowed boolean, reason text, total_scans_used integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles%rowtype;
  free_limit constant integer := 5;
  max_scans integer;
  next_total integer;
begin
  if auth.uid() is null then
    return query select false, 'unauthorized', null::integer;
    return;
  end if;

  select *
  into p
  from public.profiles
  where id = auth.uid()
  for update;

  if not found then
    return query select false, 'profile_not_found', null::integer;
    return;
  end if;

  max_scans := free_limit + coalesce(p.bonus_scans_earned, 0);
  if not (
    coalesce(p.is_pro, false) or
    coalesce(p.lifetime_pro, false) or
    (p.pro_expiry is not null and p.pro_expiry > now())
  ) and coalesce(p.total_scans_used, 0) >= max_scans then
    return query select false, 'scan_limit_reached', p.total_scans_used;
    return;
  end if;

  next_total := coalesce(p.total_scans_used, 0) + 1;
  update public.profiles
  set total_scans_used = next_total,
      updated_at = now()
  where id = p.id;

  return query select true, 'charged', next_total;
end;
$$;

revoke all on function public.consume_vision_scan_credit() from public;
grant execute on function public.consume_vision_scan_credit() to authenticated;
