'use client';

import * as React from 'react';
import { LAYOUTS, regionsFor } from '@/lib/composition/layouts';
import { getFormat } from '@/lib/domain/catalog';
import type { LayoutId } from '@/lib/domain/direction';
import type { FormatId } from '@/lib/domain/types';
import { cn } from '@/lib/utils/cn';

/**
 * As seis grelhas, em miniaturas de planta.
 *
 * Era uma lista pendente com frases — "Texto à esquerda, imagem à direita"
 * —, e o cliente tinha de imaginar cada uma. Uma miniatura diz o mesmo de
 * relance. Desenhadas a partir das MESMAS regiões que o esboço usa
 * (`regionsFor`), pelo que a miniatura escolhida é a planta que aparece por
 * cima.
 */
export function LayoutPicker({
  value,
  format,
  onChange,
}: {
  value: LayoutId;
  format: FormatId;
  onChange: (layout: LayoutId) => void;
}) {
  const spec = getFormat(format);
  const ratio = spec.width / spec.height;

  return (
    <div role="radiogroup" aria-label="Disposição" className="grid grid-cols-6 gap-1.5">
      {LAYOUTS.map((layout) => {
        const selected = layout.id === value;
        return (
          <button
            key={layout.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={layout.label}
            title={layout.label}
            onClick={() => onChange(layout.id)}
            className={cn(
              'group relative overflow-hidden rounded-[5px] ring-1 transition-[box-shadow,background-color] duration-150',
              selected
                ? 'bg-neon/8 ring-neon/70'
                : 'bg-ink-950/70 ring-line hover:ring-line-strong',
            )}
            style={{ aspectRatio: `${ratio}` }}
          >
            <Thumbnail layout={layout.id} format={format} selected={selected} />
          </button>
        );
      })}
    </div>
  );
}

/** A grelha em ponto pequeno: a imagem tracejada e três linhas de texto. */
function Thumbnail({
  layout,
  format,
  selected,
}: {
  layout: LayoutId;
  format: FormatId;
  selected: boolean;
}) {
  const regions = regionsFor(layout, format);
  // A margem da arte, em ponto pequeno.
  const inset = 12;
  const area = (value: number) => `${inset + value * (100 - inset * 2)}%`;
  const size = (value: number) => `${value * (100 - inset * 2)}%`;
  const text = regions.text;
  const bars = layout === 'tipografica' ? [0.92, 0.8, 0.86, 0.5] : [0.9, 0.66, 0.42];
  const tone = selected ? 'bg-neon/75' : 'bg-[#56645A] group-hover:bg-[#6B7A6F]';

  return (
    <span aria-hidden className="absolute inset-0">
      <span
        className={cn(
          'absolute rounded-[1px] border',
          selected ? 'border-neon/45' : 'border-[rgb(162_173_164/0.35)]',
        )}
        style={{
          left: area(regions.subject.x),
          top: area(regions.subject.y),
          width: size(regions.subject.w),
          height: size(regions.subject.h),
          backgroundImage: `repeating-linear-gradient(135deg, ${
            selected ? 'rgb(191 248 57 / 0.28)' : 'rgb(162 173 164 / 0.22)'
          } 0, ${selected ? 'rgb(191 248 57 / 0.28)' : 'rgb(162 173 164 / 0.22)'} 1px, transparent 1px, transparent 4px)`,
        }}
      />
      <span
        className={cn(
          'absolute flex flex-col gap-[3px]',
          text.align === 'center' ? 'items-center' : 'items-start',
          text.anchor === 'top' ? 'justify-start' : text.anchor === 'bottom' ? 'justify-end' : 'justify-center',
        )}
        style={{
          left: area(text.x),
          top: area(text.y),
          width: size(text.w),
          height: size(text.h),
        }}
      >
        {bars.map((width, index) => (
          <span
            key={index}
            className={cn('block rounded-full', tone, index > 1 && 'opacity-70')}
            style={{
              width: `${width * (layout === 'tipografica' ? 100 : 78)}%`,
              height: index < (layout === 'tipografica' ? 3 : 2) ? 3 : 2,
            }}
          />
        ))}
      </span>
    </span>
  );
}
