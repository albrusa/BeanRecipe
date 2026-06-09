-- ============================================================
-- Migració: afegir clicks_per_rotation a grinder_config
-- Executa a: Supabase Dashboard → SQL Editor → New query
-- ============================================================

alter table public.grinder_config
  add column if not exists clicks_per_rotation integer not null default 30;
