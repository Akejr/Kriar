'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { resolveAsset } from '@/lib/data/assetCache';
import { isBrandReady } from '@/lib/domain/factories';
import type { Brand } from '@/lib/domain/types';
import { cn } from '@/lib/utils/cn';
import { useSession } from '@/store/session';

/**
 * O ambiente de trabalho: a empresa activa, e a troca entre empresas.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * No topo, ao lado da marca da Kriar, e sempre com o NOME à vista. Quem
 * gere várias empresas tem de saber, em qualquer ecrã, para qual está a
 * criar — uma publicação da perfumaria com o logótipo da loja de
 * subscrições é o erro que esta barra existe para evitar.
 *
 * Cada empresa tem a sua marca, os seus projectos, a sua biblioteca e a sua
 * memória. "Nova empresa" abre o cadastro, como na primeira vez.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function CompanySwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { brand, brands, selectBrand, createCompany } = useSession();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const marks = useBrandMarks(brands);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!brand) return null;

  function choose(target: Brand) {
    setOpen(false);
    if (!brand || target.id === brand.id) return;
    selectBrand(target.id);
    /*
      Uma publicação aberta pertence à empresa de antes: fica-se com um
      rascunho novo da empresa escolhida. Nos projectos e na marca, a página
      mostra logo a outra empresa.
    */
    if (pathname === '/inicio' || pathname.startsWith('/editor')) router.push('/inicio');
  }

  function startNew() {
    setOpen(false);
    if (createCompany()) router.push('/onboarding');
  }

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Empresa activa: ${brand.company.name || 'sem nome'}. Mudar de empresa`}
        onClick={() => setOpen((value) => !value)}
        className="flex min-w-0 max-w-[15rem] items-center gap-1.5 rounded-[8px] py-1 pl-1 pr-1.5 transition-colors hover:bg-ink-800"
      >
        <BrandMark brand={brand} url={marks[brand.id]} />
        <span className="truncate text-[12.5px] font-medium text-fg">
          {brand.company.name || 'Nova empresa'}
        </span>
        <ChevronsUpDown className="size-3 shrink-0 text-fg-faint" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Empresas da conta"
          className="absolute left-0 top-9 z-40 w-64 overflow-hidden rounded-[12px] bg-ink-800 py-1 shadow-[0_20px_50px_-18px_rgba(0,0,0,0.95)] ring-1 ring-line-strong animate-[kriar-rise_0.14s_var(--ease-out-soft)]"
        >
          <p className="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
            Empresas
          </p>
          <ul className="no-scrollbar max-h-72 overflow-y-auto">
            {brands.map((entry) => {
              const active = entry.id === brand.id;
              const ready = isBrandReady(entry);
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => choose(entry)}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-ink-700',
                      active && 'bg-ink-700/60',
                    )}
                  >
                    <BrandMark brand={entry} url={marks[entry.id]} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-fg">
                        {entry.company.name || 'Nova empresa'}
                      </span>
                      {!ready ? (
                        <span className="block text-[10.5px] text-fg-faint">Cadastro por concluir</span>
                      ) : null}
                    </span>
                    {active ? <Check className="size-3.5 shrink-0 text-neon" aria-hidden /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <span aria-hidden className="my-1 block h-px bg-line" />
          <button
            type="button"
            role="menuitem"
            onClick={startNew}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-fg-muted transition-colors hover:bg-ink-700 hover:text-fg"
          >
            <span className="grid size-6 place-items-center rounded-[7px] border border-dashed border-line-strong">
              <Plus className="size-3.5" aria-hidden />
            </span>
            Nova empresa
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** O logótipo da empresa, ou as iniciais quando ainda não há. */
function BrandMark({ brand, url }: { brand: Brand; url: string | undefined }) {
  const initials = brand.company.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('pt-PT') ?? '')
    .join('');
  return (
    <span className="grid size-6 shrink-0 place-items-center overflow-hidden rounded-[7px] bg-ink-950 ring-1 ring-line">
      {url ? (
        <img src={url} alt="" className="size-full object-contain p-0.5" />
      ) : (
        <span className="text-[9.5px] font-semibold text-fg-muted">{initials || '+'}</span>
      )}
    </span>
  );
}

/**
 * Os logótipos das empresas, para a lista.
 *
 * A versão para fundo escuro primeiro: a interface é escura, e um logótipo
 * azul-marinho sobre ela não se via.
 */
function useBrandMarks(brands: Brand[]): Record<string, string> {
  const [marks, setMarks] = React.useState<Record<string, string>>({});
  const key = brands
    .map(
      (entry) =>
        `${entry.id}:${entry.identity.logoForDarkBgAssetId ?? entry.identity.logoAssetId ?? ''}`,
    )
    .join('|');

  React.useEffect(() => {
    let cancelled = false;
    const pairs = key
      ? key.split('|').map((pair) => {
          const [brandId, assetId] = pair.split(':');
          return { brandId, assetId };
        })
      : [];
    void Promise.all(
      pairs.map(async ({ brandId, assetId }) => {
        if (!assetId) return [brandId, ''] as const;
        const asset = await resolveAsset(assetId).catch(() => null);
        return [brandId, asset?.url ?? ''] as const;
      }),
    ).then((entries) => {
      if (!cancelled) setMarks(Object.fromEntries(entries.filter(([, url]) => url)));
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return marks;
}
