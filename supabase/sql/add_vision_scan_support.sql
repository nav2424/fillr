-- Support v1.3 vision/manual/OCR scan persistence.
alter table public.products
  alter column barcode drop not null;

alter table public.products
  add column if not exists vision_confidence numeric;

alter table public.scan_history
  add column if not exists scan_method text;
