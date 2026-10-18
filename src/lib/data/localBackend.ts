/**
 * Implementação local (modo de demonstração).
 *
 * Tudo fica no browser: IndexedDB para dados e ficheiros, `localStorage`
 * para a sessão activa.
 *
 * Sobre a autenticação local: a palavra-passe é guardada como derivação
 * PBKDF2 com sal aleatório, para não ficar em texto simples. Mesmo assim, é
 * uma verificação feita NO BROWSER e serve apenas para separar contas numa
 * demonstração. Não substitui autenticação de servidor — para isso configura
 * o Supabase, e a aplicação passa automaticamente a usá-lo.
 */
import { APP } from '@/config/app';
import type { Account, Asset, Brand, Project } from '@/lib/domain/types';
import { newId } from '@/lib/utils/id';
import {
  BackendError,
  type DataBackend,
  type SignInInput,
  type SignUpInput,
  type UploadInput,
} from './backend';
import { idbDelete, idbGet, idbGetAll, idbPut } from './idb';

const SESSION_KEY = `${APP.slug}.session`;

type StoredAccount = Account & {
  passwordSalt: string;
  passwordHash: string;
};

// --- Palavra-passe ----------------------------------------------------------

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function derive(password: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = Uint8Array.from(saltHex.match(/.{2}/g) ?? [], (byte) => parseInt(byte, 16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 120_000, hash: 'SHA-256' },
    key,
    256,
  );
  return toHex(bits);
}

function newSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// --- Endereços dos ficheiros ------------------------------------------------

const urlCache = new Map<string, string>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function stripSecrets(account: StoredAccount): Account {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    createdAt: account.createdAt,
  };
}

export function createLocalBackend(): DataBackend {
  return {
    mode: 'local',

    async getSession() {
      if (typeof localStorage === 'undefined') return null;
      const id = localStorage.getItem(SESSION_KEY);
      if (!id) return null;
      const account = await idbGet<StoredAccount>('accounts', id);
      if (!account) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return stripSecrets(account);
    },

    async signUp({ name, email, password }: SignUpInput) {
      const normalized = normalizeEmail(email);
      const existing = await idbGetAll<StoredAccount>('accounts');
      if (existing.some((a) => normalizeEmail(a.email) === normalized)) {
        throw new BackendError('Já existe uma conta com este e-mail.', 'email-em-uso');
      }
      if (password.length < 8) {
        throw new BackendError('A palavra-passe tem de ter pelo menos 8 caracteres.', 'invalido');
      }

      const salt = newSalt();
      const account: StoredAccount = {
        id: newId('acc'),
        email: normalized,
        name: name.trim() || normalized,
        createdAt: new Date().toISOString(),
        passwordSalt: salt,
        passwordHash: await derive(password, salt),
      };
      await idbPut('accounts', account);
      localStorage.setItem(SESSION_KEY, account.id);
      return stripSecrets(account);
    },

    async signIn({ email, password }: SignInInput) {
      const normalized = normalizeEmail(email);
      const accounts = await idbGetAll<StoredAccount>('accounts');
      const account = accounts.find((a) => normalizeEmail(a.email) === normalized);
      if (!account) {
        throw new BackendError('E-mail ou palavra-passe incorrectos.', 'credenciais');
      }
      const hash = await derive(password, account.passwordSalt);
      if (hash !== account.passwordHash) {
        throw new BackendError('E-mail ou palavra-passe incorrectos.', 'credenciais');
      }
      localStorage.setItem(SESSION_KEY, account.id);
      return stripSecrets(account);
    },

    async signOut() {
      localStorage.removeItem(SESSION_KEY);
    },

    async listBrands(accountId: string) {
      const brands = await idbGetAll<Brand>('brands');
      // Pela ordem de criação: a primeira empresa da conta fica em primeiro.
      return brands
        .filter((brand) => brand.accountId === accountId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async saveBrand(brand: Brand) {
      const next: Brand = { ...brand, updatedAt: new Date().toISOString() };
      await idbPut('brands', next);
      return next;
    },

    async deleteBrand(id: string) {
      await idbDelete('brands', id);
    },

    async uploadAsset(input: UploadInput) {
      const asset: Asset = {
        id: newId('ast'),
        accountId: input.accountId,
        kind: input.kind,
        name: input.name,
        mime: input.file.type || 'application/octet-stream',
        size: input.file.size,
        width: input.width ?? null,
        height: input.height ?? null,
        path: null,
        provenance: input.provenance ?? 'upload',
        createdAt: new Date().toISOString(),
      };
      await idbPut('blobs', input.file, asset.id);
      await idbPut('assets', asset);
      return asset;
    },

    async getAsset(id: string) {
      return (await idbGet<Asset>('assets', id)) ?? null;
    },

    async listAssets(accountId: string) {
      const assets = await idbGetAll<Asset>('assets');
      return assets.filter((asset) => asset.accountId === accountId);
    },

    async resolveAssetUrl(asset: Asset) {
      const cached = urlCache.get(asset.id);
      if (cached) return cached;
      const blob = await idbGet<Blob>('blobs', asset.id);
      if (!blob) throw new BackendError('O ficheiro já não está disponível.', 'nao-encontrado');
      const url = URL.createObjectURL(blob);
      urlCache.set(asset.id, url);
      return url;
    },

    async deleteAsset(id: string) {
      const cached = urlCache.get(id);
      if (cached) {
        URL.revokeObjectURL(cached);
        urlCache.delete(id);
      }
      await idbDelete('blobs', id);
      await idbDelete('assets', id);
    },

    async listProjects(accountId: string) {
      const projects = await idbGetAll<Project>('projects');
      return projects
        .filter((project) => project.accountId === accountId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async getProject(id: string) {
      return (await idbGet<Project>('projects', id)) ?? null;
    },

    async saveProject(project: Project) {
      const next: Project = { ...project, updatedAt: new Date().toISOString() };
      await idbPut('projects', next);
      return next;
    },

    async deleteProject(id: string) {
      await idbDelete('projects', id);
    },
  };
}
