-- Track which capture path produced each scan history row.
alter table public.scan_history
  add column if not exists scan_method text not null default 'barcode';
