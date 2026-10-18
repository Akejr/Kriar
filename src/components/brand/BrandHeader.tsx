'use client';

import * as React from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { resolveAsset } from '@/lib/data/assetCache';
import { getSegment } from '@/lib/domain/catalog';
import type { Brand } from '@/lib/domain/types';
import { getFont } from '@/lib/fontCatalog';
import { Button } from '@/components/ui/primitives';

/**
 * O cabeçalho da página Marca: quem é a empresa, numa linha, e o Guardar.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Substitui o cartão "Resumo", que repetia em texto tudo o que os cartões
 * de baixo já mostravam em campos — o nome duas vezes, as cores duas vezes,
 * a tipografia duas vezes. Era a primeira coisa da página e a única que não
 * se podia editar. A queixa foi "muitas informações, muito scroll", e o
 * resumo era as duas coisas ao mesmo tempo.
 *
 * Ficou o essencial, sempre à vista: o logótipo, o nome, o segmento, o
 * website, as fontes e as três cores. Lê o RASCUNHO, não a marca gravada —
 * como o resumo lia —, para o cliente ver logo o efeito do que muda, antes
 * de guardar.
 *
 * O logótipo principal vai num quadrado CLARO. É o que o cliente carrega
 * primeiro e quase sempre foi desenhado para fundo branco; num quadrado
 * escuro, o logótipo azul-marinho da empresa de exemplo desaparecia (é o
 * que acontece no selector de empresas quando não há versão para fundo
 * escuro).
 * ──────────────────────────────────────────────────────────────────────────
 */
export function BrandHeader({
  brand,
  dirty,
  saving,
  onDiscard,
  onSave,
}: {
  /** O rascunho em edição. */
  brand: Brand;
  dirty: boolean;
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const logoUrl = useAssetUrl(brand.identity.logoAssetId);
  const name = brand.company.name.trim();
  const display = getFont(brand.identity.fontDisplay).label;
  const body = getFont(brand.identity.fontBody).label;
  const website = brand.company.website?.trim();
  const facts = [
    getSegment(brand.company.segment).label,
    website || null,
    display === body ? display : `${display} e ${body}`,
  ].filter(Boolean);
  // Na linha não cabe qual fonte é de quê; fica dito ao passar o rato.
  const fontsTitle =
    display === body ? `Títulos e texto em ${display}.` : `Títulos em ${display}, texto em ${body}.`;
  const swatches: Array<[label: string, hex: string | null | undefined]> = [
    ['Cor principal', brand.identity.colors.primary],
    ['Cor secundária', brand.identity.colors.secondary],
    ['Terceira cor', brand.identity.colors.accent],
  ];
  const colors = swatches.filter((entry): entry is [string, string] => Boolean(entry[1]));

  /*
    Uma grelha, e não duas colunas lado a lado.

    Com o logótipo e o texto numa coluna e os botões noutra, a linha dos
    factos ficava com a largura que os botões deixavam — e, com "Alterações
    por guardar" e "Descartar" à vista, cortava as fontes a meio, mesmo num
    ecrã de 1440 px. Aqui os botões alinham com o nome, e a linha dos factos
    passa por baixo deles quando precisa. Em ecrãs estreitos os botões descem
    para uma linha própria.
  */
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
      <div className="col-start-1 row-span-2 row-start-1">
        <LogoTile url={logoUrl} name={name} />
      </div>

      <div className="col-start-2 row-start-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-fg-faint">
          Marca
        </p>
        <h1 className="mt-1.5 truncate text-xl font-semibold leading-tight tracking-tight text-fg">
          {name || 'Sem nome'}
        </h1>
      </div>

      <div className="col-start-2 row-start-2 mt-1 flex min-w-0 items-center gap-3 sm:col-span-2">
        <p className="min-w-0 truncate text-[12.5px] text-fg-muted" title={`${facts.join(' · ')}. ${fontsTitle}`}>
          {facts.join(' · ')}
        </p>
        {colors.length > 0 ? (
          <ul aria-label="Cores da marca" className="flex shrink-0 items-center gap-1.5">
            {colors.map(([label, hex]) => (
              <li key={label}>
                <span
                  role="img"
                  aria-label={`${label}: ${hex}`}
                  title={`${label} · ${hex}`}
                  className="block size-3.5 rounded-full ring-1 ring-inset ring-fg/20"
                  style={{ backgroundColor: hex }}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="col-span-2 col-start-1 row-start-3 mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:justify-end">
        {/*
          O aviso de alterações por guardar, junto ao botão que as guarda.

          Estava no fundo da página, num aviso amarelo depois de cinco
          cartões: quem editava o nome no topo não o via. Aqui fica à vista
          em todos os separadores — o rascunho é um só, e o que muda em
          "Empresa" continua por guardar enquanto se olha para a "Memória".

          A região existe sempre, vazia quando não há nada por guardar: um
          leitor de ecrã só anuncia mudanças numa região que já estava lá.

          No telemóvel diz só "Por guardar": com "Descartar" e "Guardar" ao
          lado, a frase inteira não cabia na linha e empurrava os botões para
          fora do ecrã.
        */}
        <p role="status" aria-live="polite" className="text-[12px] text-fg-muted">
          {dirty ? (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-neon shadow-[0_0_8px_0_var(--color-neon)]"
              />
              <span className="sm:hidden">Por guardar</span>
              <span className="hidden sm:inline">Alterações por guardar</span>
            </span>
          ) : null}
        </p>
        <div className="flex items-center gap-2">
          {dirty ? (
            // No telemóvel fica só o ícone (o nome continua lá para leitores
            // de ecrã): com o texto, os dois botões e o aviso não cabiam numa
            // linha, e o cabeçalho preso crescia mais uma.
            <Button variant="ghost" onClick={onDiscard} disabled={saving} className="max-sm:px-3">
              <RotateCcw className="size-4" aria-hidden />
              <span className="max-sm:sr-only">Descartar</span>
            </Button>
          ) : null}
          <Button variant="primary" onClick={onSave} loading={saving} disabled={!dirty}>
            <Check className="size-4" aria-hidden />
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}

/** O logótipo num quadrado claro, ou as iniciais quando ainda não há. */
function LogoTile({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      <span className="flex h-12 w-[4.5rem] shrink-0 items-center justify-center rounded-[12px] bg-fg p-1.5 ring-1 ring-line-strong">
        {/* O nome está mesmo ao lado, no título: o texto alternativo repetia-o. */}
        <img src={url} alt="" className="max-h-full max-w-full object-contain" />
      </span>
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('pt-PT') ?? '')
    .join('');
  return (
    <span
      aria-hidden
      className="grid h-12 w-[4.5rem] shrink-0 place-items-center rounded-[12px] bg-ink-800 text-[14px] font-semibold text-fg-muted ring-1 ring-line"
    >
      {initials || '·'}
    </span>
  );
}

/** O endereço de um ficheiro da conta, ou `null` enquanto não se sabe. */
function useAssetUrl(assetId: string | null): string | null {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (!assetId) {
      setUrl(null);
      return;
    }
    resolveAsset(assetId)
      .then((asset) => {
        if (!cancelled) setUrl(asset?.url ?? null);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return url;
}
