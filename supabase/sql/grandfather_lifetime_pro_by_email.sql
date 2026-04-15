-- Grant lifetime Fillr Premium to specific accounts by auth email.
-- 1) Replace the two emails in the IN list with real addresses (lowercase).
-- 2) Run in Supabase SQL Editor.

begin;

update public.profiles p
set
  lifetime_pro = true,
  is_pro = true,
  updated_at = now()
from auth.users u
where p.id = u.id
  and lower(trim(u.email)) in (
    'you@example.com',
    'partner@example.com'
  );

commit;

-- Verify:
-- select u.email, p.lifetime_pro, p.is_pro from public.profiles p join auth.users u on u.id = p.id where p.lifetime_pro;
