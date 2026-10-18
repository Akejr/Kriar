'use client';

import * as React from 'react';
import { ImagePlus, Plus, Star, X } from 'lucide-react';
import { APP } from '@/config/app';
import type { ResolvedAsset } from '@/lib/composition/resolve';
import type { CompositionItem } from '@/lib/domain/types';
import { checkImageFile } from '@/lib/utils/files';
import { cn } from '@/lib/utils/cn';

/**
 * Produtos em destaque.
 *
 * Os nomes escritos aqui são os nomes que o gerador recebe, palavra por
 * palavra. As fotografias seguem com o pedido como referência de imagem, e é
 * isso que mantém a embalagem e a cor fiéis ao produto real — sem elas, o
 * gerador inventa um frasco plausível que não é o do cliente.
 */
export function ReviewItems({
  items,
  highlightedIndex,
  capacity,
  assets,
  uploading,
  onAdd,
  onRemove,
  onRename,
  onHighlight,
  onPickImage,
  onClearImage,
}: {
  items: CompositionItem[];
  highlightedIndex: number;
  capacity: number;
  assets: Record<string, ResolvedAsset | undefined>;
  uploading: number;
  onAdd: () => void;
  onRemove: (itemId: string) => void;
  onRename: (itemId: string, name: string) => void;
  onHighlight: (index: number) => void;
  onPickImage: (itemId: string, file: File) => void;
  onClearImage: (itemId: string) => void;
}) {
  const pending = React.useRef<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const full = items.length >= capacity;

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 ? (
        <p className="rounded-[11px] border border-dashed border-line px-3 py-4 text-center text-[12px] leading-relaxed text-fg-faint">
          Ainda não há opções. Acrescenta-as aqui ou escreve-as no pedido,
          separadas por vírgulas.
        </p>
      ) : null}

      {items.map((item, index) => {
        const asset = item.assetId ? assets[item.assetId] : undefined;
        const highlighted = index === highlightedIndex;

        return (
          <div
            key={item.id}
            className={cn(
              'flex items-center gap-2.5 rounded-[11px] border bg-ink-950/60 p-2 transition-colors',
              highlighted ? 'border-neon/40' : 'border-line',
            )}
          >
            <button
              type="button"
              aria-label={
                asset?.url
                  ? `Trocar a fotografia de ${item.name || `opção ${index + 1}`}`
                  : `Juntar fotografia a ${item.name || `opção ${index + 1}`}`
              }
              title={asset?.url ? 'Trocar a fotografia' : 'Juntar fotografia'}
              onClick={() => {
                pending.current = item.id;
                fileRef.current?.click();
              }}
              className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-[8px] border border-line bg-ink-800 text-fg-faint transition-colors hover:border-neon/40 hover:text-neon"
            >
              {asset?.url ? (
                <img src={asset.url} alt="" className="size-full object-cover" />
              ) : (
                <ImagePlus className="size-4" aria-hidden />
              )}
            </button>

            <input
              value={item.name}
              maxLength={40}
              aria-label={`Nome da opção ${index + 1}`}
              placeholder={`Opção ${index + 1}`}
              onChange={(event) => onRename(item.id, event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-fg outline-none placeholder:font-normal placeholder:text-fg-faint"
            />

            {highlighted ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-neon/40 bg-neon/10 px-2.5 py-1 text-[11px] font-medium text-neon">
                <Star className="size-3" fill="currentColor" aria-hidden />
                Principal
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onHighlight(index)}
                className="shrink-0 whitespace-nowrap rounded-full border border-line px-2.5 py-1 text-[11px] text-fg-muted transition-colors hover:border-neon/40 hover:text-neon"
              >
                Definir como principal
              </button>
            )}

            {asset?.url ? (
              <button
                type="button"
                aria-label={`Retirar a fotografia de ${item.name || `opção ${index + 1}`}`}
                title="Retirar a fotografia"
                onClick={() => onClearImage(item.id)}
                className="grid size-6 shrink-0 place-items-center rounded-[6px] text-fg-faint transition-colors hover:bg-ink-800 hover:text-warn"
              >
                <ImagePlus className="size-3.5 rotate-45" aria-hidden />
              </button>
            ) : null}

            <button
              type="button"
              aria-label={`Remover a opção ${index + 1}`}
              title="Remover esta opção"
              onClick={() => onRemove(item.id)}
              className="grid size-6 shrink-0 place-items-center rounded-[6px] text-fg-faint transition-colors hover:bg-ink-800 hover:text-danger"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        );
      })}

      {uploading > 0
        ? Array.from({ length: uploading }).map((_, index) => (
            <div
              key={`a-carregar-${index}`}
              className="h-[3.5rem] animate-[kriar-pulse-soft_1.2s_ease-in-out_infinite] rounded-[11px] border border-line bg-ink-800"
            />
          ))
        : null}

      {!full ? (
        <button
          type="button"
          /*
            Embrulhado de propósito. Com `onClick={onAdd}`, o React chamava
            `addItem(evento)`, o evento do clique ficava como NOME do produto,
            e a revisão rebentava a seguir em `item.name.trim()` — o site
            inteiro desaparecia ao acrescentar um produto.
          */
          onClick={() => onAdd()}
          className="flex items-center justify-center gap-1.5 rounded-[11px] border border-dashed border-line-strong py-2 text-[12px] text-fg-faint transition-colors hover:border-neon/40 hover:text-neon"
        >
          <Plus className="size-3.5" aria-hidden />
          Acrescentar opção
        </button>
      ) : (
        <p className="text-[11px] text-fg-faint">Este conceito comporta {capacity} opções.</p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={APP.uploads.acceptedImageMimes.join(',')}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          const itemId = pending.current;
          pending.current = null;
          event.target.value = '';
          if (file && itemId && checkImageFile(file, 'product').ok) onPickImage(itemId, file);
        }}
      />
    </div>
  );
}
