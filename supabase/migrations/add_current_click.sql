-- ============================================================
-- Migració: afegir current_click a grinder_config
-- Executa a: Supabase Dashboard → SQL Editor → New query
-- ============================================================

alter table public.grinder_config
  add column if not exists current_click integer not null default 0;
