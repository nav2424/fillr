-- Support products created from GPT-4o vision scans.
-- Vision products do not have a retail barcode, but should still be cached for
-- history/catalog lookup alongside Open Food Facts products.
alter table public.products
  alter column barcode drop not null;

alter table public.products
  add column if not exists vision_confidence numeric;
