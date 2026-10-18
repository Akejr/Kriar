-- =============================================================================
-- Kriar — várias empresas por conta
--
-- Uma conta passa a ter vários ambientes de trabalho, um por empresa: cada um
-- com a sua marca, os seus projectos, a biblioteca da marca e a memória.
--
-- Três mudanças:
--
--  1. Sai o índice único `brands_owner_unique`, que limitava a uma marca por
--     conta. Entra um índice simples para a listagem por conta.
--  2. `brands.id` passa de uuid a texto. A aplicação gera identificadores
--     como `brd_…` (ver `newId`), que uma coluna uuid recusa — a primeira
--     gravação de uma marca falhava. `projects.brand_id` acompanha.
--  3. Apagar uma empresa apaga os projectos dela. Com `set null`, ficavam
--     projectos sem empresa, que nenhuma lista mostra.
--
-- Aplicar depois de `0001_init.sql` e `0002_storage.sql`, com
-- `supabase db push` ou no editor SQL.
-- Não apaga dados: as marcas e os projectos existentes ficam como estão.
-- =============================================================================

drop index if exists public.brands_owner_unique;
create index if not exists brands_owner_idx on public.brands (owner_id, created_at);

alter table public.projects drop constraint if exists projects_brand_id_fkey;

alter table public.brands alter column id drop default;
alter table public.brands alter column id type text using id::text;
alter table public.projects alter column brand_id type text using brand_id::text;

alter table public.projects
  add constraint projects_brand_id_fkey
  foreign key (brand_id) references public.brands (id) on delete cascade;

create index if not exists projects_brand_idx on public.projects (brand_id, updated_at desc);
