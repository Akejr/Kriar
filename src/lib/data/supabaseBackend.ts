/**
 * Implementação Supabase.
 *
 * Activa automaticamente quando `NEXT_PUBLIC_SUPABASE_URL` e
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` estão definidas. A chave anónima é pública
 * por design: o isolamento entre contas é garantido pelas políticas RLS
 * definidas em `supabase/migrations/0001_init.sql`, que correm no servidor.
 *
 * O acesso é feito do browser, directamente, com a sessão do utilizador.
 * Não há rota de API intermediária para dados porque as políticas RLS já
 * fazem a verificação do lado do servidor.
 *
 * Estado: implementado e revisto, mas não verificado contra um projecto
 * Supabase real neste ambiente. Ver a secção correspondente no README.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Account, Asset, Brand, Project } from '@/lib/domain/types';
import { newId } from '@/lib/utils/id';
import {
  BackendError,
  type DataBackend,
  type SignInInput,
  type SignUpInput,
  type UploadInput,
} from './backend';

const BUCKET = 'brand-assets';

type BrandRow = {
  id: string;
  owner_id: string;
  company: Brand['company'];
  contacts: Brand['contacts'];
  identity: Brand['identity'];
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
};

type AssetRow = {
  id: string;
  owner_id: string;
  kind: Asset['kind'];
  name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  path: string;
  provenance: Asset['provenance'];
  created_at: string;
};

type ProjectRow = {
  id: string;
  owner_id: string;
  brand_id: string;
  name: string;
  status: Project['status'];
  brief: string;
  composition: Project['composition'];
  missing_fields: Project['missingFields'];
  plan_source: Project['planSource'];
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
};

function brandFromRow(row: BrandRow): Brand {
  return {
    id: row.id,
    accountId: row.owner_id,
    company: row.company,
    contacts: row.contacts ?? [],
    identity: row.identity,
    onboardingComplete: row.onboarding_complete,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assetFromRow(row: AssetRow): Asset {
  return {
    id: row.id,
    accountId: row.owner_id,
    kind: row.kind,
    name: row.name,
    mime: row.mime,
    size: row.size,
    width: row.width,
    height: row.height,
    path: row.path,
    provenance: row.provenance ?? 'upload',
    createdAt: row.created_at,
  };
}

function projectFromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    accountId: row.owner_id,
    brandId: row.brand_id,
    name: row.name,
    status: row.status,
    brief: row.brief,
    composition: row.composition,
    missingFields: row.missing_fields ?? [],
    planSource: row.plan_source,
    thumbnail: row.thumbnail,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function extensionFor(mime: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/svg+xml': 'svg',
    'application/pdf': 'pdf',
  };
  return map[mime] ?? 'bin';
}

export function createSupabaseBackend(url: string, anonKey: string): DataBackend {
  const client: SupabaseClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Necessário para os links de confirmação de e-mail e de recuperação
      // funcionarem: o cliente apanha o código na URL e troca-o por sessão.
      detectSessionInUrl: true,
    },
  });

  const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

  async function requireUserId(): Promise<string> {
    const { data } = await client.auth.getUser();
    if (!data.user) throw new BackendError('Sessão expirada. Volta a entrar.', 'sem-sessao');
    return data.user.id;
  }

  function accountFrom(
    user: { id: string; email?: string | null; created_at?: string },
    metadataName?: string,
  ): Account {
    return {
      id: user.id,
      email: user.email ?? '',
      name: metadataName || user.email || 'Conta',
      createdAt: user.created_at ?? new Date().toISOString(),
    };
  }

  async function getAsset(id: string): Promise<Asset | null> {
    const { data, error } = await client
      .from('assets')
      .select('*')
      .eq('id', id)
      .maybeSingle<AssetRow>();
    if (error) throw new BackendError(error.message);
    return data ? assetFromRow(data) : null;
  }

  return {
    mode: 'supabase',

    async getSession() {
      const { data } = await client.auth.getUser();
      if (!data.user) return null;
      const name =
        (data.user.user_metadata?.name as string | undefined) ?? data.user.email ?? 'Conta';
      return accountFrom(data.user, name);
    },

    async signUp({ name, email, password }: SignUpInput) {
      const { data, error } = await client.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { name: name.trim() },
          /*
            O link de confirmação leva directamente ao cadastro da empresa.
            Apontava para `/`, que encaminhava sozinho para lá; `/` passou a
            ser a página pública. No painel do Supabase, este endereço tem de
            estar nos "Redirect URLs" — sem isso, o Supabase cai no "Site
            URL" (a página pública), onde o botão "Abrir a Kriar" continua o
            caminho.
          */
          emailRedirectTo:
            typeof window !== 'undefined' ? `${window.location.origin}/onboarding` : undefined,
        },
      });

      if (error) {
        const code = /already registered|already exists|user already/i.test(error.message)
          ? 'email-em-uso'
          : 'credenciais';
        throw new BackendError(error.message, code);
      }

      // Com confirmação de e-mail activa no Supabase, `signUp` devolve o
      // utilizador mas não a sessão. Avisamos em vez de deixar a aplicação
      // num estado meio autenticado.
      if (!data.session) {
        throw new BackendError(
          'Conta criada. Abre o e-mail de confirmação que enviámos e depois entra.',
          'confirmacao-pendente',
        );
      }
      if (!data.user) {
        throw new BackendError('A conta foi criada mas não devolveu sessão.', 'sem-sessao');
      }
      return accountFrom(data.user, name);
    },

    async signIn({ email, password }: SignInInput) {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error || !data.user) {
        throw new BackendError('E-mail ou palavra-passe incorrectos.', 'credenciais');
      }
      return accountFrom(data.user, data.user.user_metadata?.name as string | undefined);
    },

    async signOut() {
      await client.auth.signOut();
    },

    async listBrands(accountId: string) {
      // As políticas RLS já limitam as linhas visíveis, mas filtramos
      // explicitamente: a intenção fica legível e não dependemos só delas.
      // Várias por conta desde `0003_empresas.sql`.
      const { data, error } = await client
        .from('brands')
        .select('*')
        .eq('owner_id', accountId)
        .order('created_at', { ascending: true });
      if (error) throw new BackendError(error.message);
      return ((data ?? []) as BrandRow[]).map(brandFromRow);
    },

    async deleteBrand(id: string) {
      const { error } = await client.from('brands').delete().eq('id', id);
      if (error) throw new BackendError(error.message);
    },

    async saveBrand(brand: Brand) {
      const ownerId = await requireUserId();
      const payload = {
        id: brand.id,
        owner_id: ownerId,
        company: brand.company,
        contacts: brand.contacts,
        identity: brand.identity,
        onboarding_complete: brand.onboardingComplete,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await client
        .from('brands')
        .upsert(payload, { onConflict: 'id' })
        .select('*')
        .single<BrandRow>();
      if (error) throw new BackendError(error.message);
      return brandFromRow(data);
    },

    async uploadAsset(input: UploadInput) {
      const ownerId = await requireUserId();
      const id = newId('ast');
      const mime = input.file.type || 'application/octet-stream';
      // O primeiro segmento do caminho é o id do utilizador: é isso que as
      // políticas do armazenamento verificam.
      const path = `${ownerId}/${input.kind}/${id}.${extensionFor(mime)}`;

      const upload = await client.storage.from(BUCKET).upload(path, input.file, {
        contentType: mime,
        upsert: false,
      });
      if (upload.error) throw new BackendError(upload.error.message);

      const row = {
        id,
        owner_id: ownerId,
        kind: input.kind,
        name: input.name,
        mime,
        size: input.file.size,
        width: input.width ?? null,
        height: input.height ?? null,
        path,
        provenance: input.provenance ?? 'upload',
      };
      const { data, error } = await client
        .from('assets')
        .insert(row)
        .select('*')
        .single<AssetRow>();
      if (error) {
        await client.storage.from(BUCKET).remove([path]);
        throw new BackendError(error.message);
      }
      return assetFromRow(data);
    },

    getAsset,

    async listAssets(accountId: string) {
      const { data, error } = await client
        .from('assets')
        .select('*')
        .eq('owner_id', accountId)
        .order('created_at', { ascending: false });
      if (error) throw new BackendError(error.message);
      return (data ?? []).map(assetFromRow);
    },

    async resolveAssetUrl(asset: Asset) {
      if (!asset.path) {
        throw new BackendError('O ficheiro não tem caminho de armazenamento.', 'nao-encontrado');
      }
      const cached = signedUrlCache.get(asset.id);
      if (cached && cached.expiresAt > Date.now() + 60_000) return cached.url;

      const ttlSeconds = 60 * 60;
      const { data, error } = await client.storage
        .from(BUCKET)
        .createSignedUrl(asset.path, ttlSeconds);
      if (error || !data?.signedUrl) {
        throw new BackendError(error?.message ?? 'Não foi possível obter o ficheiro.');
      }
      signedUrlCache.set(asset.id, {
        url: data.signedUrl,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
      return data.signedUrl;
    },

    async deleteAsset(id: string) {
      const asset = await getAsset(id);
      if (asset?.path) await client.storage.from(BUCKET).remove([asset.path]);
      signedUrlCache.delete(id);
      const { error } = await client.from('assets').delete().eq('id', id);
      if (error) throw new BackendError(error.message);
    },

    async listProjects(accountId: string) {
      const { data, error } = await client
        .from('projects')
        .select('*')
        .eq('owner_id', accountId)
        .order('updated_at', { ascending: false });
      if (error) throw new BackendError(error.message);
      return (data ?? []).map(projectFromRow);
    },

    async getProject(id: string) {
      const { data, error } = await client
        .from('projects')
        .select('*')
        .eq('id', id)
        .maybeSingle<ProjectRow>();
      if (error) throw new BackendError(error.message);
      return data ? projectFromRow(data) : null;
    },

    async saveProject(project: Project) {
      const ownerId = await requireUserId();
      const payload = {
        id: project.id,
        owner_id: ownerId,
        brand_id: project.brandId,
        name: project.name,
        status: project.status,
        brief: project.brief,
        composition: project.composition,
        missing_fields: project.missingFields,
        plan_source: project.planSource,
        thumbnail: project.thumbnail,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await client
        .from('projects')
        .upsert(payload, { onConflict: 'id' })
        .select('*')
        .single<ProjectRow>();
      if (error) throw new BackendError(error.message);
      return projectFromRow(data);
    },

    async deleteProject(id: string) {
      const { error } = await client.from('projects').delete().eq('id', id);
      if (error) throw new BackendError(error.message);
    },
  };
}
