'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { IconButton } from './primitives';

/**
 * Caixa de diálogo modal.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Usa o elemento <dialog> nativo, o que dá de graça o foco preso dentro da
 * caixa, a tecla Escape e a camada superior. Aplicamos só o aspecto.
 *
 * PORQUE APARECIA NO CANTO. O <dialog> modal fica centrado graças a uma
 * regra do próprio browser: `margin: auto`. O Tailwind v4 repõe
 * `margin: 0` em todos os elementos, e com isso a caixa colava-se ao canto
 * superior do ecrã. Daí `m-auto` e `h-fit` — sem o segundo, a caixa
 * esticava até à altura do ecrã para cumprir `inset: 0`.
 *
 * Menos diálogos é melhor do que diálogos bonitos: renomear e eliminar
 * projectos passaram a fazer-se no próprio cartão. Ficam aqui só os que têm
 * formulários que não cabem no sítio de onde são abertos.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'sm' | 'md' | 'lg';
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={cn(
        'fixed inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-hidden p-0',
        'rounded-[20px] border border-line-strong bg-ink-900 text-fg',
        'shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.02)]',
        'backdrop:bg-ink-950/75 backdrop:backdrop-blur-md',
        'open:animate-[kriar-dialog_0.2s_var(--ease-out-soft)]',
        widths[width],
      )}
      onClick={(event) => {
        // Clique no véu, fora da caixa, fecha.
        if (event.target === ref.current) onClose();
      }}
    >
      {/* Coluna com cabeçalho e rodapé fixos: só o conteúdo rola. */}
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <div className="flex shrink-0 items-start justify-between gap-4 px-6 pb-1 pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[15.5px] font-semibold tracking-tight">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{description}</p>
            ) : null}
          </div>
          <IconButton label="Fechar" size="sm" onClick={onClose}>
            <X className="size-4" aria-hidden />
          </IconButton>
        </div>

        {children ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
        ) : (
          <div className="h-3" />
        )}

        {footer ? (
          <div className="flex shrink-0 justify-end gap-2 border-t border-line bg-ink-950/30 px-6 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
