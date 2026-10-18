-- =============================================================================
-- Kriar — armazenamento de ficheiros
--
-- Bucket privado. Os caminhos têm sempre o formato:
--   <uuid-do-utilizador>/<tipo>/<id-do-recurso>.<extensão>
--
-- As políticas comparam o primeiro segmento do caminho com `auth.uid()`, o que
-- impede qualquer conta de ler ou escrever ficheiros de outra. A aplicação
-- serve as imagens por URL assinado de curta duração.
--
-- O limite de tamanho e a lista de tipos aceites existem também aqui, para o
-- servidor recusar uploads inválidos mesmo que o cliente seja contornado.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets',
  'brand-assets',
  false,
  12582912, -- 12 MB
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/avif',
    'image/svg+xml',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- --- Políticas ---------------------------------------------------------------
drop policy if exists "brand_assets_read_own" on storage.objects;
create policy "brand_assets_read_own" on storage.objects
  for select
  using (
    bucket_id = 'brand-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "brand_assets_insert_own" on storage.objects;
create policy "brand_assets_insert_own" on storage.objects
  for insert
  with check (
    bucket_id = 'brand-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "brand_assets_update_own" on storage.objects;
create policy "brand_assets_update_own" on storage.objects
  for update
  using (
    bucket_id = 'brand-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "brand_assets_delete_own" on storage.objects;
create policy "brand_assets_delete_own" on storage.objects
  for delete
  using (
    bucket_id = 'brand-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
