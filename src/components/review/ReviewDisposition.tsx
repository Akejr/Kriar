'use client';

import * as React from 'react';
import { pickLogo } from '@/lib/brand/logoVariant';
import { ART_BASES, BASE_LABEL, baseHex } from '@/lib/composition/base';
import {
  defaultLayoutFor,
  fitLogoPlacement,
  LOGO_PLACEMENT_LABEL,
  LOGO_SIZE_LABEL,
  logoPlacementsFor,
} from '@/lib/composition/layouts';
import { describeColor } from '@/lib/composition/palette';
import type { ResolvedAsset } from '@/lib/composition/resolve';
import { getFormat } from '@/lib/domain/catalog';
import type { LayoutId } from '@/lib/domain/direction';
import type {
  ArtBase,
  Brand,
  Composition,
  ContactsPlacement,
  LogoPlacement,
  LogoSize,
} from '@/lib/domain/types';
import { cn } from '@/lib/utils/cn';
import { LayoutPicker } from './LayoutPicker';
import { ReviewBlueprint } from './ReviewBlueprint';

/**
 * A planta e os controlos da disposição, juntos.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Tudo o que decide ONDE fica cada coisa, num só sítio e à vista da planta:
 * a grelha, o logótipo (posição e tamanho), os contactos (no texto ou no
 * rodapé) e a cor de base. Cada controlo mexe na planta na hora — e a zona
 * que mudou pisca a verde —, por isso o cliente vê o efeito antes de pagar
 * uma geração.
 *
 * Estavam espalhados: a grelha e o logótipo num par de listas pendentes
 * dentro do cartão da ideia, os contactos sem controlo de posição nenhum,
 * e a cor de base não existia.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function ReviewDisposition({
  composition,
  brand,
  assets,
  onLayoutChange,
  onLogoPlacementChange,
  onLogoSizeChange,
  onContactsPlacementChange,
  onBaseChange,
}: {
  composition: Composition;
  brand: Brand;
  assets: Record<string, ResolvedAsset | undefined>;
  onLayoutChange: (layout: LayoutId) => void;
  onLogoPlacementChange: (placement: LogoPlacement) => void;
  onLogoSizeChange: (size: LogoSize) => void;
  onContactsPlacementChange: (placement: ContactsPlacement) => void;
  onBaseChange: (base: ArtBase) => void;
}) {
  const direction = composition.direction;
  const layout: LayoutId = direction?.layout ?? defaultLayoutFor(direction?.approach);
  const base: ArtBase = composition.base ?? 'primaria';
  const hasLogo =
    composition.logo.show && Boolean(pickLogo(brand, composition.colors, base));
  const hasContacts = composition.contacts.some((contact) => contact.value.trim());
  const spec = getFormat(composition.format);
  const ratio = spec.width / spec.height;

  return (
    <div className="flex flex-col gap-3">
      {direction ? (
        /*
          A planta nunca fica mais alta do que o ecrã deixa: num portátil de
          768 px de altura, uma planta 4:5 à largura da coluna empurrava os
          controlos para fora da vista.
        */
        <div
          className="mx-auto w-full"
          style={{ maxWidth: `max(11rem, calc((100dvh - 31rem) * ${ratio}))` }}
        >
          <ReviewBlueprint composition={composition} brand={brand} assets={assets} />
        </div>
      ) : (
        <div className="grid aspect-[4/5] place-items-center rounded-[6px] border border-dashed border-line px-4 text-center text-[11.5px] leading-relaxed text-fg-faint">
          A planta aparece quando houver uma ideia.
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-[14px] bg-ink-900/60 p-3 ring-1 ring-line backdrop-blur-sm">
        {direction ? (
          <Row label="Disposição">
            <LayoutPicker value={layout} format={composition.format} onChange={onLayoutChange} />
          </Row>
        ) : null}

        {hasLogo && direction ? (
          <Row label="Logótipo">
            <div className="flex flex-wrap items-center gap-2">
              <CompactSelect
                label="Posição do logótipo"
                value={fitLogoPlacement(layout, composition.format, composition.logo.placement)}
                onChange={(value) => onLogoPlacementChange(value as LogoPlacement)}
                options={logoPlacementsFor(layout, composition.format).map((value) => ({
                  value,
                  label: LOGO_PLACEMENT_LABEL[value],
                }))}
              />
              <Choice
                label="Tamanho do logótipo"
                value={composition.logo.size}
                onChange={onLogoSizeChange}
                options={(['pequeno', 'medio', 'grande'] as const).map((size) => ({
                  value: size,
                  label: LOGO_SIZE_LABEL[size].charAt(0),
                  title: LOGO_SIZE_LABEL[size],
                }))}
              />
            </div>
          </Row>
        ) : null}

        {hasContacts && direction ? (
          <Row label="Contactos">
            <Choice
              label="Onde ficam os contactos"
              value={composition.contactsPlacement ?? 'texto'}
              onChange={onContactsPlacementChange}
              options={[
                { value: 'texto', label: 'Por baixo do texto' },
                { value: 'rodape', label: 'No rodapé' },
              ]}
            />
          </Row>
        ) : null}

        <Row
          label="Cor de base"
          hint={composition.baseChosen ? undefined : 'Por omissão, alterna com a publicação anterior.'}
        >
          <div role="radiogroup" aria-label="Cor de base" className="grid grid-cols-2 gap-1.5">
            {ART_BASES.map((entry) => {
              const hex = baseHex(composition.colors, entry);
              const selected = entry === base;
              const name = describeColor(hex);
              return (
                <button
                  key={entry}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onBaseChange(entry)}
                  className={cn(
                    'flex min-w-0 items-center gap-2 rounded-[9px] px-2 py-1.5 text-left ring-1 transition-colors duration-150',
                    selected
                      ? 'bg-neon/8 ring-neon/60'
                      : 'bg-ink-950/70 ring-line hover:ring-line-strong',
                  )}
                >
                  <span
                    aria-hidden
                    className="size-6 shrink-0 rounded-[6px] ring-1 ring-white/15"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block truncate text-[11.5px] font-medium',
                        selected ? 'text-fg' : 'text-fg-muted',
                      )}
                    >
                      {name.charAt(0).toLocaleUpperCase('pt-PT') + name.slice(1)}
                    </span>
                    <span className="block truncate text-[10px] text-fg-faint">
                      {BASE_LABEL[entry]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Row>
      </div>
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
        {label}
      </span>
      {children}
      {hint ? <span className="text-[10.5px] leading-snug text-fg-faint">{hint}</span> : null}
    </div>
  );
}

/** Escolha curta, em pílula: duas ou três opções lado a lado. */
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; title?: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex max-w-full rounded-[9px] bg-ink-950/70 p-0.5 ring-1 ring-line"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.title}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-7 min-w-7 truncate rounded-[7px] px-2.5 text-[11.5px] font-medium transition-colors duration-150',
              selected ? 'bg-neon/12 text-neon' : 'text-fg-muted hover:text-fg',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function CompactSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <span className="relative block min-w-0 flex-1">
      <select
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full appearance-none truncate rounded-[9px] bg-ink-950/70 pl-2.5 pr-8 text-[11.5px] text-fg outline-none ring-1 ring-line transition-shadow hover:ring-line-strong focus:ring-neon/40"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-faint"
      >
        <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
