-- =============================================================================
-- Kriar — esquema inicial
--
-- Isolamento entre contas: cada tabela tem `owner_id` ligado a `auth.users` e
-- políticas RLS que só deixam ver e escrever as linhas próprias. A verificação
-- corre no servidor do Supabase, pelo que a chave anónima no browser não
-- permite ler dados de outra conta.
--
-- Aplicar com:
--   supabase db push
-- ou colando no editor SQL do painel do Supabase.
-- =============================================================================

create extension if not exists "pgcrypto";

-- --- Marca -------------------------------------------------------------------
-- Uma marca por conta no MVP, garantido pelo índice único em `owner_id`.
-- O modelo não impede mais do que uma no futuro: basta remover o índice.
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  company jsonb not null default '{}'::jsonb,
  contacts jsonb not null default '[]'::jsonb,
  identity jsonb not null default '{}'::jsonb,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists brands_owner_unique on public.brands (owner_id);

-- --- Ficheiros ---------------------------------------------------------------
create table if not exists public.assets (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (
    kind in (
      'logo',
      'logo-light-bg',
      'logo-dark-bg',
      'product',
      'reference',
      'brand-manual',
      'generated-bg'
    )
  ),
  name text not null default '',
  mime text not null default 'application/octet-stream',
  size integer not null default 0 check (size >= 0),
  width integer,
  height integer,
  -- Caminho no bucket. O primeiro segmento tem de ser o id do utilizador.
  path text not null,
  provenance text not null default 'upload' check (provenance in ('upload', 'ia', 'local')),
  created_at timestamptz not null default now()
);

create index if not exists assets_owner_idx on public.assets (owner_id, created_at desc);

-- --- Projectos ---------------------------------------------------------------
create table if not exists public.projects (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  brand_id uuid references public.brands (id) on delete set null,
  name text not null default 'Publicação sem nome',
  status text not null default 'rascunho' check (status in ('rascunho', 'composicao', 'arte-final')),
  brief text not null default '',
  -- Composição estruturada: modelo escolhido, textos (com a marca de
  -- protecção), imagens, paleta, posições manuais e fundo gerado.
  composition jsonb not null default '{}'::jsonb,
  missing_fields jsonb not null default '[]'::jsonb,
  plan_source text check (plan_source in ('ia', 'deterministico')),
  thumbnail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_owner_idx on public.projects (owner_id, updated_at desc);

-- --- `updated_at` automático -------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists brands_touch on public.brands;
create trigger brands_touch before update on public.brands
  for each row execute function public.touch_updated_at();

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- --- RLS ---------------------------------------------------------------------
alter table public.brands enable row level security;
alter table public.assets enable row level security;
alter table public.projects enable row level security;

-- Marca
drop policy if exists "brands_select_own" on public.brands;
create policy "brands_select_own" on public.brands
  for select using (auth.uid() = owner_id);

drop policy if exists "brands_insert_own" on public.brands;
create policy "brands_insert_own" on public.brands
  for insert with check (auth.uid() = owner_id);

drop policy if exists "brands_update_own" on public.brands;
create policy "brands_update_own" on public.brands
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "brands_delete_own" on public.brands;
create policy "brands_delete_own" on public.brands
  for delete using (auth.uid() = owner_id);

-- Ficheiros
drop policy if exists "assets_select_own" on public.assets;
create policy "assets_select_own" on public.assets
  for select using (auth.uid() = owner_id);

drop policy if exists "assets_insert_own" on public.assets;
create policy "assets_insert_own" on public.assets
  for insert with check (
    auth.uid() = owner_id
    -- O caminho tem de começar pela pasta da própria conta.
    and path like (auth.uid()::text || '/%')
  );

drop policy if exists "assets_delete_own" on public.assets;
create policy "assets_delete_own" on public.assets
  for delete using (auth.uid() = owner_id);

-- Projectos
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
  for select using (auth.uid() = owner_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
  for insert with check (auth.uid() = owner_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects
  for delete using (auth.uid() = owner_id);
