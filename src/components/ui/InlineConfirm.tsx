'use client';

import * as React from 'react';
import { Button, type ButtonProps } from './primitives';
import { cn } from '@/lib/utils/cn';

/**
 * Confirmação no próprio sítio.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Substitui o diálogo de confirmação. O botão transforma-se, ali mesmo, numa
 * linha com a pergunta e as duas respostas — sem véu escuro, sem caixa a
 * saltar para o centro do ecrã, sem perder de vista o que se está a apagar.
 *
 * O foco vai para "Cancelar" quando a pergunta aparece. Numa acção que não se
 * desfaz, um Enter distraído tem de ser a resposta segura.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function InlineConfirm({
  label,
  icon,
  variant = 'outline',
  confirmLabel,
  message,
  danger = false,
  loading = false,
  onConfirm,
}: {
  label: string;
  icon?: React.ReactNode;
  variant?: ButtonProps['variant'];
  confirmLabel: string;
  message: React.ReactNode;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [asking, setAsking] = React.useState(false);
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (asking) cancelRef.current?.focus();
  }, [asking]);

  if (!asking) {
    return (
      <Button variant={variant} onClick={() => setAsking(true)} loading={loading}>
        {icon}
        {label}
      </Button>
    );
  }

  return (
    <div
      role="group"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !loading) setAsking(false);
      }}
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-[12px] border px-3.5 py-3',
        'animate-[kriar-rise_0.16s_var(--ease-out-soft)]',
        danger ? 'border-danger/40 bg-danger-900/40' : 'border-line-strong bg-ink-950/60',
      )}
    >
      <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-fg">{message}</p>
      <div className="flex shrink-0 gap-2">
        <Button ref={cancelRef} variant="ghost" onClick={() => setAsking(false)} disabled={loading}>
          Cancelar
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          loading={loading}
          onClick={() => void onConfirm()}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
