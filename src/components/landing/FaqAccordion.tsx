'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import type { FaqItem } from '@/lib/landing/content';
import { cn } from '@/lib/utils/cn';

/**
 * Perguntas frequentes, em acordeão.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Cada pergunta é um `<button>` dentro do título, com `aria-expanded` e
 * `aria-controls` a apontar para a resposta — o padrão de acordeão da WAI.
 * Enter e Espaço abrem e fecham sem código à mão; uma pergunta aberta fecha
 * a anterior, para a lista não virar um muro de texto.
 *
 * As respostas estão sempre no HTML (o servidor renderiza-as): fechadas,
 * ficam com altura zero e `inert`, fora do alcance do teclado e dos
 * leitores de ecrã até abrirem — mas lá, para os motores de pesquisa.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = React.useState<string | null>(items[0]?.id ?? null);
  const baseId = React.useId().replace(/:/g, '');

  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((item, index) => {
        const expanded = open === item.id;
        const buttonId = `${baseId}-${item.id}-pergunta`;
        const panelId = `${baseId}-${item.id}-resposta`;
        return (
          <div key={item.id}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen(expanded ? null : item.id)}
                className="group flex w-full items-center justify-between gap-6 rounded-[6px] py-6 text-left text-[16.5px] font-medium tracking-[-0.01em] text-fg transition-colors sm:text-[18px]"
              >
                {/* O número, como os da secção da marca; o leitor de ecrã ouve só a pergunta. */}
                <span className="flex min-w-0 items-baseline gap-4 sm:gap-5">
                  <span
                    aria-hidden
                    className={cn(
                      'w-6 shrink-0 text-[11px] font-semibold tracking-[0.14em] tabular-nums transition-colors',
                      expanded ? 'text-neon' : 'text-fg-faint group-hover:text-neon',
                    )}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-pretty">{item.question}</span>
                </span>
                {/*
                  Roda o sinal, não o círculo. Visto, é igual; medido, não: a
                  caixa de um quadrado rodado a 45° fica 41% mais larga, e a
                  do círculo de 32 px passava 7 px para fora da coluna — nos
                  telemóveis, para dentro da margem do ecrã.
                */}
                <span
                  aria-hidden
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-full border transition-colors duration-300',
                    expanded
                      ? 'border-neon/50 bg-neon/10 text-neon'
                      : 'border-line-strong text-fg-muted group-hover:border-neon/40 group-hover:text-neon',
                  )}
                >
                  <Plus className={cn('size-4 transition-transform duration-300', expanded && 'rotate-45')} />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              inert={!expanded}
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="overflow-hidden">
                {/* Alinhada com a pergunta, depois do número. */}
                <div className="max-w-[44rem] pb-7 pl-10 text-[15px] leading-relaxed text-fg-muted sm:pl-11 sm:pr-12">
                  {item.answer.map((paragraph, index) => (
                    <p key={index} className={index > 0 ? 'mt-3' : undefined}>
                      {paragraph}
                    </p>
                  ))}
                  {item.list ? (
                    <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                      {item.list.map((line) => (
                        <li key={line} className="flex items-center gap-2.5">
                          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-neon/80" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
