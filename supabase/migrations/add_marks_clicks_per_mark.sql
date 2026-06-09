-- ============================================================
-- Migració: substituir clicks_per_rotation per marks_on_dial + clicks_per_mark
-- Executa a: Supabase Dashboard → SQL Editor → New query
-- ============================================================

alter table public.grinder_config
  add column if not exists marks_on_dial   integer not null default 10,
  add column if not exists clicks_per_mark integer not null default 3;

-- Si vas executar la migració anterior (add_clicks_per_rotation), pots eliminar-la:
-- alter table public.grinder_config drop column if exists clicks_per_rotation;
