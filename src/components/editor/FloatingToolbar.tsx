'use client';

import * as React from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Lock,
  Minus,
  Pencil,
  Plus,
  Replace,
  RotateCcw,
  Unlock,
} from 'lucide-react';
import { APP } from '@/config/app';
import type { ResolvedLayer } from '@/lib/composition/resolve';
import { FONT_CATALOG, type FontId } from '@/lib/fontCatalog';
import type { Composition } from '@/lib/domain/types';
import { cn } from '@/lib/utils/cn';

/**
 * Barra de ferramentas do elemento seleccionado.
 *
 * Aparece sobre o elemento e só mostra o que a aplicação sabe fazer. Em
 * particular, o selector de tipografia muda a fonte da MARCA para este papel
 * (títulos ou texto) e não a de uma camada isolada: deixar cada bloco com uma
 * fonte diferente destruiria a identidade visual que o produto existe para
 * proteger.
 */
export function FloatingToolbar({
  layer,
  composition,
  hasOverride,
  onEdit,
  onFontChange,
  onSizeFactor,
  onWeightChange,
  onAlign,
  onToggleLock,
  onReset,
  onReplaceImage,
}: {
  layer: ResolvedLayer;
  composition: Composition;
  hasOverride: boolean;
  onEdit: () => void;
  onFontChange: (role: 'display' | 'body', font: FontId) => void;
  onSizeFactor: (factor: number) => void;
  onWeightChange: (weight: 400 | 700) => void;
  onAlign: (align: 'left' | 'center' | 'right') => void;
  onToggleLock: () => void;
  onReset: () => void;
  onReplaceImage: (file: File) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isText = layer.kind === 'text';
  // Fotografias livres e imagens de peças são as duas substituíveis. O
  // logótipo e o fundo não: vêm da marca e da geração.
  const canReplace =
    (layer.kind === 'image' || layer.kind === 'placeholder') &&
    (layer.role === 'produto' || layer.role === 'peca');

  const fontRole = isText ? layer.fontRole : 'body';
  const currentFont = fontRole === 'display' ? composition.fontDisplay : composition.fontBody;
  const size = isText ? Math.round(layer.fontSize) : 0;
  const bold = isText && layer.fontWeight >= 600;

  /** Converte um tamanho absoluto em factor de escala sobre o actual. */
  function sizeTo(next: number) {
    if (!isText || size <= 0) return;
    const clamped = Math.min(220, Math.max(10, next));
    onSizeFactor(clamped / size);
  }

  return (
    <div className="flex items-center gap-0.5 rounded-[11px] bg-ink-800/95 p-1 shadow-[0_14px_40px_-14px_rgba(0,0,0,0.95)] ring-1 ring-line-strong backdrop-blur-sm">
      {isText ? (
        <>
          <select
            aria-label={
              fontRole === 'display' ? 'Tipografia dos títulos' : 'Tipografia do texto'
            }
            title={
              fontRole === 'display'
                ? 'Tipografia dos títulos da marca'
                : 'Tipografia do texto da marca'
            }
            value={currentFont}
            onChange={(event) => onFontChange(fontRole, event.target.value as FontId)}
            className="h-7 w-[6.5rem] cursor-pointer rounded-[7px] bg-ink-700 px-2 text-[11.5px] text-fg outline-none ring-0 transition-colors hover:bg-ink-600"
          >
            {FONT_CATALOG.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
          </select>

          <div className="ml-0.5 flex h-7 items-center rounded-[7px] bg-ink-700">
            <input
              type="number"
              aria-label="Tamanho da tipografia"
              value={size}
              min={10}
              max={220}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) sizeTo(next);
              }}
              className="h-7 w-10 bg-transparent px-1.5 text-center text-[11.5px] tabular-nums text-fg outline-none"
            />
            <span className="flex flex-col">
              <button
                type="button"
                aria-label="Aumentar tamanho"
                onClick={() => sizeTo(size + 2)}
                className="grid h-3.5 w-5 place-items-center text-fg-faint hover:text-neon"
              >
                <Plus className="size-2.5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Diminuir tamanho"
                onClick={() => sizeTo(size - 2)}
                className="grid h-3.5 w-5 place-items-center text-fg-faint hover:text-neon"
              >
                <Minus className="size-2.5" aria-hidden />
              </button>
            </span>
          </div>

          <Divider />

          <Tool
            label="Negrito"
            active={bold}
            onClick={() => onWeightChange(bold ? 400 : 700)}
          >
            <Bold className="size-3.5" aria-hidden />
          </Tool>

          <Divider />

          <Tool
            label="Alinhar à esquerda"
            active={layer.align === 'left'}
            onClick={() => onAlign('left')}
          >
            <AlignLeft className="size-3.5" aria-hidden />
          </Tool>
          <Tool label="Centrar" active={layer.align === 'center'} onClick={() => onAlign('center')}>
            <AlignCenter className="size-3.5" aria-hidden />
          </Tool>
          <Tool
            label="Alinhar à direita"
            active={layer.align === 'right'}
            onClick={() => onAlign('right')}
          >
            <AlignRight className="size-3.5" aria-hidden />
          </Tool>

          <Divider />

          <Tool label="Editar texto" onClick={onEdit}>
            <Pencil className="size-3.5" aria-hidden />
          </Tool>

          <Tool
            label={
              layer.locked
                ? `Permitir que o ${APP.name} reescreva este texto`
                : 'Proteger este texto de novas reformulações'
            }
            active={layer.locked}
            onClick={onToggleLock}
          >
            {layer.locked ? (
              <Lock className="size-3.5" aria-hidden />
            ) : (
              <Unlock className="size-3.5" aria-hidden />
            )}
          </Tool>
        </>
      ) : null}

      {canReplace ? (
        <>
          <span className="px-1.5 text-[11.5px] font-medium text-fg-muted">
            {layer.kind === 'image' || layer.kind === 'placeholder' ? layer.label : 'Imagem'}
          </span>
          <Divider />
          <Tool label="Substituir imagem" onClick={() => inputRef.current?.click()}>
            <Replace className="size-3.5" aria-hidden />
          </Tool>
        </>
      ) : null}

      {hasOverride ? (
        <>
          <Divider />
          <Tool label="Repor posição e tamanho" onClick={onReset}>
            <RotateCcw className="size-3.5" aria-hidden />
          </Tool>
        </>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={APP.uploads.acceptedImageMimes.join(',')}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onReplaceImage(file);
          event.target.value = '';
        }}
      />
    </div>
  );
}

function Tool({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      onClick={onClick}
      className={cn(
        'grid size-7 place-items-center rounded-[7px] transition-colors',
        active ? 'bg-neon/15 text-neon' : 'text-fg-muted hover:bg-ink-700 hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px bg-line-strong" />;
}
