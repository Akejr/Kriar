import type { Account, Asset, AssetKind, Brand, Project } from '@/lib/domain/types';

/**
 * Contrato de persistência.
 *
 * Há duas implementações:
 *
 *   · `local`    — IndexedDB no browser. É o modo de demonstração: funciona
 *                  sem nenhuma credencial, os dados persistem e cada conta
 *                  tem o seu espaço. Não é multi-dispositivo.
 *   · `supabase` — autenticação, base de dados e armazenamento reais, com
 *                  isolamento garantido por políticas RLS no servidor.
 *
 * A aplicação escolhe uma em `index.ts`, a partir das variáveis de ambiente.
 * Nenhum componente importa uma implementação directamente.
 */

export type SignUpInput = {
  name: string;
  email: string;
  password: string;
};

export type SignInInput = {
  email: string;
  password: string;
};

export type UploadInput = {
  accountId: string;
  kind: AssetKind;
  file: Blob;
  name: string;
  width?: number | null;
  height?: number | null;
  provenance?: Asset['provenance'];
};

export type BackendErrorCode =
  | 'credenciais'
  | 'email-em-uso'
  | 'sem-sessao'
  /** Conta criada no Supabase, à espera que o e-mail seja confirmado. */
  | 'confirmacao-pendente'
  | 'nao-encontrado'
  | 'invalido'
  | 'armazenamento';

export class BackendError extends Error {
  constructor(
    message: string,
    readonly code: BackendErrorCode = 'armazenamento',
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

export type DataBackend = {
  mode: 'local' | 'supabase';

  // Sessão
  getSession(): Promise<Account | null>;
  signUp(input: SignUpInput): Promise<Account>;
  signIn(input: SignInInput): Promise<Account>;
  signOut(): Promise<void>;

  // Empresas. Uma conta pode ter várias, cada uma com a sua marca e os seus
  // projectos — é o ambiente de trabalho de cada empresa.
  listBrands(accountId: string): Promise<Brand[]>;
  saveBrand(brand: Brand): Promise<Brand>;
  deleteBrand(id: string): Promise<void>;

  // Ficheiros
  uploadAsset(input: UploadInput): Promise<Asset>;
  getAsset(id: string): Promise<Asset | null>;
  listAssets(accountId: string): Promise<Asset[]>;
  resolveAssetUrl(asset: Asset): Promise<string>;
  deleteAsset(id: string): Promise<void>;

  // Projectos
  listProjects(accountId: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<Project>;
  deleteProject(id: string): Promise<void>;
};
