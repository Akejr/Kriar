'use client';

import * as React from 'react';
import { Check, Image as ImageIcon, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/primitives';

/**
 * Nota de direcção visual, em barra.
 *
 * Descreve o acabamento pretendido e serve de base ao fundo. É uma nota
 * separada: NÃO faz parte da arte exportada. Pode ser editada, e nessa altura
 * deixa de ser reescrita quando a proposta é actualizada.
 */
export function VisualDirectionNote({
  value,
  onChange,
  backgroundMode,
  className,
}: {
  value: string;
  onChange: (text: string) => void;
  backgroundMode: 'ia' | 'local' | null;
  className?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);

  React.useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  if (editing) {
    return (
      <div className={cn('flex items-start gap-2', className)}>
        <textarea
          autoFocus
          rows={2}
          maxLength={320}
          value={draft}
          aria-label="Descrição do acabamento visual"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setEditing(false);
            }
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              onChange(draft);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 resize-none rounded-[9px] bg-ink-950/70 px-2.5 py-2 text-[11.5px] leading-relaxed text-fg outline-none ring-1 ring-neon/35"
        />
        <button
          type="button"
          aria-label="Guardar nota"
          onClick={() => {
            onChange(draft);
            setEditing(false);
          }}
          className="grid size-7 shrink-0 place-items-center rounded-[7px] bg-neon/15 text-neon hover:bg-neon/25"
        >
          <Check className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Cancelar"
          onClick={() => setEditing(false)}
          className="grid size-7 shrink-0 place-items-center rounded-[7px] text-fg-muted hover:bg-ink-800 hover:text-fg"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Editar a nota de acabamento"
      className={cn(
        'group flex min-w-0 items-center gap-2.5 rounded-[10px] px-1 py-1 text-left transition-colors hover:bg-ink-800/60',
        className,
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-ink-800 text-fg-muted">
        <ImageIcon className="size-4" aria-hidden />
      </span>

      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-[12px] font-medium text-fg">Direcção visual</span>
          {/*
            De onde veio o fundo, em etiqueta pequena.

            "Fundo local" era uma pílula âmbar: na barra de acções do editor,
            ao lado de "Gerar arte final", lia-se como erro. Não é — é o
            fundo desenhado pela aplicação, sem IA. Ficou neutra com o ponto
            âmbar, a mesma peça das outras etiquetas de estado; a do fundo
            por IA continua verde, porque diz que está feito.
          */}
          {backgroundMode === 'local' ? (
            <Badge tone="warn" size="sm">
              fundo local
            </Badge>
          ) : backgroundMode === 'ia' ? (
            <Badge tone="neon" size="sm">
              fundo por IA
            </Badge>
          ) : null}
          <Pencil
            className="size-2.5 text-fg-faint opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden
          />
        </span>
        <span className="mt-px block truncate text-[11.5px] text-fg-muted">
          {value || 'Sem nota. Prepara a composição para a obter.'}
        </span>
      </span>
    </button>
  );
}
