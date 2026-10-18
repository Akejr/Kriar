'use client';

import * as React from 'react';
import { History, Pencil, Sparkles } from 'lucide-react';
import type { ResolvedAsset } from '@/lib/composition/resolve';
import type { ArtworkVersion, CompositionArtwork } from '@/lib/domain/types';
import { cn } from '@/lib/utils/cn';

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}

/**
 * O número de cada versão, pela ordem em que foi CRIADA.
 *
 * Numerava pela posição na lista, e repor uma versão renumerava todas: a
 * "versão 2" passava a chamar-se "versão 3" depois de reposta. Pela data de
 * criação, cada versão tem o mesmo número do princípio ao fim — repor só
 * muda qual delas é a actual.
 */
export function versionNumbers(artwork: CompositionArtwork): Map<string, number> {
  const list = [
    ...(artwork.assetId ? [{ assetId: artwork.assetId, createdAt: artwork.generatedAt ?? '' }] : []),
    ...artwork.history.map((version) => ({ assetId: version.assetId, createdAt: version.createdAt })),
  ];
  const ordered = list
    .map((entry, index) => ({ ...entry, index, time: Date.parse(entry.createdAt) || 0 }))
    // Empate na data: mais abaixo na lista é mais antigo.
    .sort((a, b) => a.time - b.time || b.index - a.index);
  return new Map(ordered.map((entry, position) => [entry.assetId, position + 1]));
}

/**
 * As versões da arte: a actual primeiro, depois as outras da mais recente
 * para a mais antiga.
 *
 * Escolher uma abre a comparação com a actual; repor faz-se a partir daí,
 * depois de ver as duas lado a lado.
 */
export function VersionStrip({
  artwork,
  assets,
  selected,
  onSelect,
}: {
  artwork: CompositionArtwork;
  assets: Record<string, ResolvedAsset | undefined>;
  /** Versão aberta em comparação, se houver. */
  selected: string | null;
  onSelect: (assetId: string) => void;
}) {
  if (!artwork.assetId || artwork.history.length === 0) return null;

  const numbers = versionNumbers(artwork);
  const entries: Array<{ version: ArtworkVersion; number: number; current: boolean }> = [
    {
      version: {
        assetId: artwork.assetId,
        origin: artwork.origin ?? 'geracao',
        createdAt: artwork.generatedAt ?? '',
        width: artwork.width,
        height: artwork.height,
        summary: artwork.summary,
      },
      number: numbers.get(artwork.assetId) ?? 1,
      current: true,
    },
    ...artwork.history.map((version) => ({
      version,
      number: numbers.get(version.assetId) ?? 1,
      current: false,
    })),
  ];

  return (
    <div className="flex items-center gap-3 px-5 pb-2 pt-1">
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-fg-faint">
        <History className="size-3.5" aria-hidden />
        Versões
      </span>
      <ol className="no-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto py-1">
        {entries.map(({ version, number, current }) => {
          const url = assets[version.assetId]?.url;
          const label = `Versão ${number}${current ? ' (actual)' : ''} — ${
            version.origin === 'edicao' ? 'editada' : 'gerada'
          } ${when(version.createdAt)}${version.summary ? `. ${version.summary}` : ''}`;
          return (
            <li key={version.assetId} className="shrink-0">
              <button
                type="button"
                disabled={current}
                onClick={() => onSelect(version.assetId)}
                title={label}
                aria-label={label}
                aria-current={current ? 'true' : undefined}
                className={cn(
                  'group relative block h-12 w-10 overflow-hidden rounded-[7px] bg-ink-800 ring-1 transition-[box-shadow,transform] duration-150',
                  current
                    ? 'cursor-default ring-2 ring-neon'
                    : selected === version.assetId
                      ? 'ring-2 ring-neon/70'
                      : 'ring-line hover:-translate-y-0.5 hover:ring-line-strong',
                )}
              >
                {url ? (
                  <img src={url} alt="" className="size-full object-cover" loading="lazy" />
                ) : null}
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-ink-950/80 py-px text-[9px] font-semibold tabular-nums text-fg">
                  {version.origin === 'edicao' ? (
                    <Pencil className="size-2" aria-hidden />
                  ) : (
                    <Sparkles className="size-2" aria-hidden />
                  )}
                  V{number}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
