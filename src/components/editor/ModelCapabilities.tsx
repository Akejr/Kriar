'use client';

import * as React from 'react';
import { AlertTriangle, Layers, Sparkles, X } from 'lucide-react';
import type { Template } from '@/lib/templates/types';
import { cn } from '@/lib/utils/cn';
import { NoticeBar, NoticeMark } from '@/components/ui/primitives';

/**
 * O que o modelo monta, o que é gerado e o que ainda não existe.
 *
 * Esta janela existe para não haver promessas em silêncio. O modelo declara
 * em `assembly.missing` as capacidades que a referência pediria mas que não
 * estão implementadas, e `assembly.limitations` explica cada uma em
 * linguagem comum. Mostramos isso ANTES de gerar, não depois.
 *
 * A distinção entre "montado pela aplicação" e "gerado" também não é
 * decoração: a primeira lista é exactamente o que continua editável depois
 * de a arte final existir.
 */
export function ModelCapabilities({
  template,
  className,
}: {
  template: Template;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const hasLimits = template.assembly.limitations.length > 0;

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-[8px] bg-ink-900 px-2.5 py-1 text-[11.5px] transition-colors',
          open ? 'text-fg ring-1 ring-line-strong' : 'text-fg-muted hover:text-fg',
        )}
      >
        <Layers className="size-3" aria-hidden />
        Composição editável
        {hasLimits ? (
          <AlertTriangle className="size-3 text-warn/90" aria-label="Com limitações declaradas" />
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={`O que o modelo ${template.name} monta`}
          className="absolute right-0 top-9 z-40 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[13px] bg-ink-800 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.95)] ring-1 ring-line-strong animate-[kriar-rise_0.14s_var(--ease-out-soft)]"
        >
          <div className="flex items-start gap-2 px-3.5 pb-2 pt-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-fg">{template.name}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-fg-faint">
                {template.concept}
              </p>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => setOpen(false)}
              className="grid size-5 shrink-0 place-items-center rounded-full text-fg-faint transition-colors hover:text-fg"
            >
              <X className="size-3" aria-hidden />
            </button>
          </div>

          <div className="max-h-[22rem] overflow-y-auto px-3.5 pb-3.5">
            <Section
              icon={<Layers className="size-3 text-neon" aria-hidden />}
              title="Montado pela aplicação"
              note="Fica editável ao píxel, antes e depois de gerar."
              entries={template.assembly.appLayers}
            />

            <Section
              icon={<Sparkles className="size-3 text-fg-muted" aria-hidden />}
              title="Gerado"
              note="Produzido na geração da arte final."
              entries={template.assembly.generated}
            />

            {/*
              As limitações, como um aviso da casa.

              Era uma caixa âmbar com o texto todo em âmbar: dentro de uma
              janela pequena, era o que se lia primeiro e com mais esforço.
              O tom fica no chip; as linhas têm o mesmo ponto e o mesmo
              cinzento das listas de cima, para se lerem como parte da
              mesma explicação e não como um alarme.

              Superfície mais funda do que a janela (`bg-ink-900`): a janela
              já é `ink-800`, e o aviso na mesma superfície ficava só com a
              borda a separá-lo.
            */}
            {hasLimits ? (
              <div className="edge-top relative mt-3 rounded-[10px] border border-line bg-ink-900/80 py-2.5 pl-10 pr-3">
                <NoticeBar tone="warn" className="inset-y-2.5" />
                <NoticeMark tone="warn" size="sm" className="absolute left-2.5 top-[9px]" />
                <p className="text-[11.5px] font-semibold leading-relaxed text-fg">
                  O que este modelo ainda não faz
                </p>
                <ul className="mt-1 flex flex-col gap-1">
                  {template.assembly.limitations.map((limitation) => (
                    <li
                      key={limitation}
                      className="flex gap-1.5 text-[11px] leading-relaxed text-fg-muted"
                    >
                      <span
                        aria-hidden
                        className="mt-[0.62em] size-1 shrink-0 rounded-full bg-line-strong"
                      />
                      {limitation}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Section({
  icon,
  title,
  note,
  entries,
}: {
  icon: React.ReactNode;
  title: string;
  note: string;
  entries: string[];
}) {
  if (entries.length === 0) return null;
  return (
    <div className="mt-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
        {icon}
        {title}
      </p>
      <p className="mt-0.5 text-[10.5px] text-fg-faint">{note}</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {entries.map((entry) => (
          <li key={entry} className="flex gap-1.5 text-[11.5px] leading-relaxed text-fg-muted">
            <span aria-hidden className="mt-[0.45em] size-1 shrink-0 rounded-full bg-line-strong" />
            {entry}
          </li>
        ))}
      </ul>
    </div>
  );
}
