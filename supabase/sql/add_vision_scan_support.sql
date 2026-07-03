alter table if exists public.products
  alter column barcode drop not null;

alter table if exists public.products
  add column if not exists vision_confidence double precision;

alter table if exists public.scan_history
  add column if not exists scan_method text;
