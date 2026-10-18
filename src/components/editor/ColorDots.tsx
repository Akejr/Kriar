'use client';

import * as React from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import type { BrandColors } from '@/lib/domain/types';
import { cn } from '@/lib/utils/cn';
import { bestTextOn, deriveAccent, normalizeHex, safeHex } from '@/lib/utils/color';

/**
 * Cores da publicação, em círculos.
 *
 * Compacto de propósito: no painel do editor um selector com campo
 * hexadecimal por cor ocupava três vezes este espaço. Clicar abre o selector
 * do sistema; para escrever um código exacto há a área Marca.
 *
 * Alterar aqui afecta APENAS esta publicação — o perfil da empresa não é
 * tocado, e o botão de reposição volta às cores da marca.
 */
export function ColorDots({
  colors,
  fromBrand,
  onChange,
  onReset,
}: {
  colors: BrandColors;
  fromBrand: boolean;
  onChange: (patch: Partial<BrandColors>) => void;
  onReset: () => void;
}) {
  const entries: Array<{ key: keyof BrandColors; label: string; value: string | null }> = [
    { key: 'primary', label: 'Cor principal', value: normalizeHex(colors.primary) },
    { key: 'secondary', label: 'Cor secundária', value: normalizeHex(colors.secondary) },
    { key: 'accent', label: 'Terceira cor', value: normalizeHex(colors.accent) },
  ];

  return (
    <div className="flex items-center gap-2">
      {entries.map((entry) =>
        entry.value ? (
          <Dot
            key={entry.key}
            label={entry.label}
            value={entry.value}
            onChange={(hex) => onChange({ [entry.key]: hex } as Partial<BrandColors>)}
          />
        ) : (
          <button
            key={entry.key}
            type="button"
            aria-label={`Acrescentar ${entry.label.toLowerCase()}`}
            title={`Acrescentar ${entry.label.toLowerCase()}`}
            onClick={() =>
              onChange({
                accent: deriveAccent(safeHex(colors.primary), safeHex(colors.secondary)),
              })
            }
            className="grid size-9 place-items-center rounded-full border border-dashed border-line-strong text-fg-faint transition-colors hover:border-neon/50 hover:text-neon"
          >
            <Plus className="size-3.5" aria-hidden />
          </button>
        ),
      )}

      <button
        type="button"
        disabled={fromBrand}
        onClick={onReset}
        title={fromBrand ? 'A usar as cores da marca' : 'Repor as cores da marca'}
        aria-label={fromBrand ? 'A usar as cores da marca' : 'Repor as cores da marca'}
        className={cn(
          'ml-auto grid size-8 place-items-center rounded-full transition-colors',
          fromBrand
            ? 'cursor-not-allowed text-fg-faint/50'
            : 'text-fg-muted hover:bg-ink-800 hover:text-neon',
        )}
      >
        <RotateCcw className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

function Dot({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const id = React.useId().replace(/:/g, '');
  return (
    <span
      className="relative grid size-9 place-items-center overflow-hidden rounded-full ring-1 ring-inset ring-white/12"
      style={{ backgroundColor: value }}
    >
      <label htmlFor={`cor-${id}`} className="sr-only-focusable absolute">
        {label}
      </label>
      <span
        aria-hidden
        className="pointer-events-none select-none font-mono text-[8px] opacity-0 transition-opacity hover:opacity-100"
        style={{ color: bestTextOn(value) }}
      >
        {value.slice(1)}
      </span>
      <input
        id={`cor-${id}`}
        type="color"
        value={value}
        title={`${label}: ${value}`}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        className="absolute inset-0 size-full cursor-pointer appearance-none border-0 bg-transparent p-0 opacity-0"
      />
    </span>
  );
}
