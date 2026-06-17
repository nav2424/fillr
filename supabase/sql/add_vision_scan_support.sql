-- Vision scan support. Safe to re-run in Supabase SQL Editor.

alter table public.scan_history
  add column if not exists scan_method text;

alter table public.scan_history
  drop constraint if exists scan_history_scan_method_check;

alter table public.scan_history
  add constraint scan_history_scan_method_check
  check (scan_method is null or scan_method in ('barcode', 'ocr', 'manual', 'vision'));

alter table public.products
  alter column barcode drop not null;

alter table public.products
  add column if not exists vision_confidence double precision;

alter table public.products
  drop constraint if exists products_vision_confidence_check;

alter table public.products
  add constraint products_vision_confidence_check
  check (vision_confidence is null or (vision_confidence >= 0 and vision_confidence <= 1));

