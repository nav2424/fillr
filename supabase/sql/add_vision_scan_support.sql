-- Support GPT-4o vision scans, which can identify products before a barcode exists.
alter table public.products
  alter column barcode drop not null;

alter table public.products
  add column if not exists vision_confidence double precision;

alter table public.scan_history
  add column if not exists scan_method text;
