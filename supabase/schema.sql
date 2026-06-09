-- ============================================================
-- BeanRecipe – Esquema de base de dades
-- Executa aquest fitxer a: Supabase Dashboard → SQL Editor
-- ============================================================

-- Taula: configuració del molinet (1 fila per usuari)
create table public.grinder_config (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users(id) on delete cascade not null unique,
  calibration_offset   integer not null default 0,
  current_click        integer not null default 0,
  clicks_per_rotation  integer not null default 30,
  updated_at         timestamptz not null default now()
);

-- Si la taula ja existia, afegeix la nova columna (migració):
-- alter table public.grinder_config add column if not exists current_click integer not null default 0;

-- Taula: cafès
create table public.coffees (
  id         uuid primary key,           -- generat pel client
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  origin     text not null default '',
  roaster    text not null default '',
  roast_date date,
  process    text not null default '',
  notes      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Taula: mètodes de preparació
create table public.brew_methods (
  id           uuid primary key,         -- generat pel client
  coffee_id    uuid references public.coffees(id) on delete cascade not null,
  user_id      uuid references auth.users(id) on delete cascade not null,
  type         text not null check (type in ('v60', 'moka', 'aeropress')),
  grind_clicks integer not null default 0,
  notes        text not null default '',
  created_at   timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────────

alter table public.grinder_config enable row level security;
alter table public.coffees         enable row level security;
alter table public.brew_methods    enable row level security;

-- grinder_config: cada usuari només veu i modifica la seva fila
create policy "Propietari del molinet"
  on public.grinder_config for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- coffees: cada usuari només veu i modifica els seus cafès
create policy "Propietari dels cafès"
  on public.coffees for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- brew_methods: cada usuari només veu i modifica els seus mètodes
create policy "Propietari dels mètodes"
  on public.brew_methods for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
