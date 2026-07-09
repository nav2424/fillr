alter table public.products
  alter column barcode drop not null;

alter table public.products
  add column if not exists vision_confidence numeric;

alter table public.scan_history
  add column if not exists scan_method text not null default 'barcode';

alter table public.scan_history
  drop constraint if exists scan_history_scan_method_check;

alter table public.scan_history
  add constraint scan_history_scan_method_check
  check (scan_method in ('barcode', 'ocr', 'manual', 'vision'));

