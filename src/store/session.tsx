'use client';

import * as React from 'react';
import { APP } from '@/config/app';
import { migrateBrand } from '@/lib/brand/migrateIdentity';
import { backendMode, getBackend } from '@/lib/data';
import { createBrand, isBrandReady } from '@/lib/domain/factories';
import type { Account, Brand, IntegrationStatus } from '@/lib/domain/types';
import { useEditor } from './editor';

type Status = 'loading' | 'anon' | 'authed';

type SessionValue = {
  status: Status;
  account: Account | null;
  /** A empresa activa: é a marca de tudo o que se cria e edita agora. */
  brand: Brand | null;
  /** Todas as empresas da conta, pela ordem em que foram criadas. */
  brands: Brand[];
  /** Onde os dados estão guardados. */
  storage: 'local' | 'supabase';
  /** Estado real das integrações de IA. `null` enquanto carrega. */
  integrations: IntegrationStatus | null;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signUp: (input: { name: string; email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  /** Grava a marca e actualiza o estado. */
  saveBrand: (brand: Brand) => Promise<Brand>;
  /**
   * Aplica uma alteração à versão MAIS RECENTE de uma marca e grava.
   *
   * Para gravações que correm em segundo plano — a biblioteca da marca, a
   * memória da empresa. Ficam em fila: duas a acabar ao mesmo tempo já não
   * se apagam uma à outra.
   */
  updateBrand: (brandId: string, updater: (brand: Brand) => Brand) => Promise<Brand | null>;
  /** Volta a ler as empresas do armazenamento. */
  reloadBrand: (preferId?: string) => Promise<void>;
  /** Muda de empresa. */
  selectBrand: (brandId: string) => void;
  /** Começa uma empresa nova, que fica activa e por configurar. */
  createCompany: () => Brand | null;
  /** Apaga uma empresa e os projectos dela. Nunca a última. */
  deleteCompany: (brandId: string) => Promise<void>;
};

const SessionContext = React.createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const context = React.useContext(SessionContext);
  if (!context) throw new Error('useSession tem de ser usado dentro de <SessionProvider>.');
  return context;
}

/** Onde fica, neste browser, a última empresa aberta de cada conta. */
function activeKey(accountId: string): string {
  return `${APP.slug}.empresa.${accountId}`;
}

function readActive(accountId: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(activeKey(accountId));
  } catch {
    return null;
  }
}

function writeActive(accountId: string, brandId: string): void {
  try {
    localStorage.setItem(activeKey(accountId), brandId);
  } catch {
    // Sem armazenamento (modo privado): a escolha vale até fechar o separador.
  }
}

/**
 * A empresa que abre.
 *
 * A última escolhida neste browser, se ainda existir; senão, a pronta usada
 * mais recentemente; senão, a primeira.
 */
function pickActive(list: Brand[], preferred: string | null): string | null {
  if (preferred && list.some((brand) => brand.id === preferred)) return preferred;
  const ready = list
    .filter((brand) => isBrandReady(brand))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return ready[0]?.id ?? list[0]?.id ?? null;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<Status>('loading');
  const [account, setAccount] = React.useState<Account | null>(null);
  const [brands, setBrands] = React.useState<Brand[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [integrations, setIntegrations] = React.useState<IntegrationStatus | null>(null);

  /*
    As empresas mais recentes numa referência.

    `updateBrand` corre no fim de operações que levam meio minuto. Com a
    lista do render em que começaram, gravava por cima do que tivesse mudado
    entretanto.
  */
  const brandsRef = React.useRef<Brand[]>([]);
  const queue = React.useRef<Promise<unknown>>(Promise.resolve());

  const commitList = React.useCallback((next: Brand[]) => {
    brandsRef.current = next;
    setBrands(next);
  }, []);

  /** Junta uma marca gravada à lista, no lugar dela ou no fim. */
  const upsertInList = React.useCallback(
    (saved: Brand) => {
      const current = brandsRef.current;
      const exists = current.some((entry) => entry.id === saved.id);
      commitList(
        exists
          ? current.map((entry) => (entry.id === saved.id ? saved : entry))
          : [...current, saved],
      );
    },
    [commitList],
  );

  const loadBrandsFor = React.useCallback(
    async (current: Account, preferId?: string) => {
      /*
        Fronteira do armazenamento.

        Nem o `jsonb` do Supabase nem o IndexedDB validam a forma do que
        guardam: o que uma versão anterior escreveu volta tal e qual. É aqui
        que se normaliza, antes de chegar a qualquer componente.
      */
      const stored = (await getBackend().listBrands(current.id)).map(migrateBrand);
      // Primeira entrada: o esqueleto da marca para o cadastro, só em memória.
      const list = stored.length > 0 ? stored : [createBrand(current.id)];
      commitList(list);
      const chosen = pickActive(list, preferId ?? readActive(current.id));
      setActiveId(chosen);
      if (chosen) writeActive(current.id, chosen);
      return list;
    },
    [commitList],
  );

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const current = await getBackend().getSession();
        if (cancelled) return;
        if (!current) {
          setStatus('anon');
          return;
        }
        setAccount(current);
        await loadBrandsFor(current);
        if (!cancelled) setStatus('authed');
      } catch {
        if (!cancelled) setStatus('anon');
      }
    })();

    fetch('/api/status')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: IntegrationStatus | null) => {
        if (!cancelled && data) setIntegrations(data);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [loadBrandsFor]);

  const signIn = React.useCallback(
    async (input: { email: string; password: string }) => {
      const current = await getBackend().signIn(input);
      setAccount(current);
      await loadBrandsFor(current);
      setStatus('authed');
    },
    [loadBrandsFor],
  );

  const signUp = React.useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const current = await getBackend().signUp(input);
      setAccount(current);
      await loadBrandsFor(current);
      setStatus('authed');
    },
    [loadBrandsFor],
  );

  const signOut = React.useCallback(async () => {
    await getBackend().signOut();
    setAccount(null);
    commitList([]);
    setActiveId(null);
    setStatus('anon');
  }, [commitList]);

  const saveBrand = React.useCallback(
    async (next: Brand) => {
      const saved = await getBackend().saveBrand(next);
      // O que volta da gravação passa pela mesma fronteira: o backend devolve
      // o que leu da base de dados, não o que lhe enviámos.
      const migrated = migrateBrand(saved);
      upsertInList(migrated);
      return migrated;
    },
    [upsertInList],
  );

  const updateBrand = React.useCallback(
    (brandId: string, updater: (brand: Brand) => Brand) => {
      const run = queue.current.then(async () => {
        const latest = brandsRef.current.find((entry) => entry.id === brandId);
        if (!latest) return null;
        const next = updater(latest);
        if (next === latest) return latest;
        return saveBrand(next);
      });
      // Uma gravação que falha não pode parar a fila das seguintes.
      queue.current = run.catch(() => undefined);
      return run;
    },
    [saveBrand],
  );

  const reloadBrand = React.useCallback(
    async (preferId?: string) => {
      /*
        A conta vem do estado OU do backend.

        Quem chama logo a seguir a `signUp` — a conta de demonstração — tem
        uma versão desta função de antes de a conta chegar ao estado. Só com
        o estado, saía sem fazer nada: a marca de exemplo ficava gravada mas
        a sessão continuava com o esqueleto vazio.
      */
      const current = account ?? (await getBackend().getSession());
      if (!current) return;
      await loadBrandsFor(current, preferId);
    },
    [account, loadBrandsFor],
  );

  const selectBrand = React.useCallback(
    (brandId: string) => {
      if (!brandsRef.current.some((entry) => entry.id === brandId)) return;
      setActiveId(brandId);
      if (account) writeActive(account.id, brandId);
    },
    [account],
  );

  const createCompany = React.useCallback(() => {
    if (!account) return null;
    /*
      Só em memória até ao primeiro "Continuar" do cadastro.

      Uma empresa começada e abandonada no primeiro ecrã não deixa um
      registo vazio na conta. Uma que já tem um esqueleto por gravar é
      reaproveitada, em vez de se empilharem várias "sem nome".
    */
    const pending = brandsRef.current.find(
      (entry) => !entry.onboardingComplete && !entry.company.name.trim(),
    );
    const fresh = pending ?? createBrand(account.id);
    if (!pending) commitList([...brandsRef.current, fresh]);
    setActiveId(fresh.id);
    writeActive(account.id, fresh.id);
    return fresh;
  }, [account, commitList]);

  const deleteCompany = React.useCallback(
    async (brandId: string) => {
      if (!account) return;
      const remaining = brandsRef.current.filter((entry) => entry.id !== brandId);
      if (remaining.length === 0) {
        throw new Error('A conta precisa de pelo menos uma empresa.');
      }
      const backend = getBackend();
      // Os projectos primeiro: uma empresa apagada não deixa trabalho órfão.
      const projects = await backend.listProjects(account.id);
      for (const project of projects.filter((entry) => entry.brandId === brandId)) {
        await backend.deleteProject(project.id);
      }
      // O editor larga a publicação aberta desta empresa: uma gravação
      // pendente trá-la-ia de volta, já sem empresa.
      const editor = useEditor.getState();
      if (editor.project?.brandId === brandId) editor.teardown();
      // Uma empresa ainda por gravar não está no armazenamento; apagá-la lá
      // não faz nada e não falha.
      await backend.deleteBrand(brandId);
      commitList(remaining);
      const next = pickActive(remaining, null);
      setActiveId(next);
      if (next) writeActive(account.id, next);
    },
    [account, commitList],
  );

  const brand = React.useMemo(
    () => brands.find((entry) => entry.id === activeId) ?? null,
    [brands, activeId],
  );

  const value = React.useMemo<SessionValue>(
    () => ({
      status,
      account,
      brand,
      brands,
      storage: backendMode(),
      integrations,
      signIn,
      signUp,
      signOut,
      saveBrand,
      updateBrand,
      reloadBrand,
      selectBrand,
      createCompany,
      deleteCompany,
    }),
    [
      status,
      account,
      brand,
      brands,
      integrations,
      signIn,
      signUp,
      signOut,
      saveBrand,
      updateBrand,
      reloadBrand,
      selectBrand,
      createCompany,
      deleteCompany,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
