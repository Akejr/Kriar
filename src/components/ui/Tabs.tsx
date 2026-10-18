'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Separadores.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O padrão de separadores do WAI-ARIA, sem dependências: uma lista com
 * `role="tablist"`, cada separador com `role="tab"`, e o conteúdo de cada um
 * num `role="tabpanel"` que aponta de volta para o separador que o abre.
 *
 * TABINDEX ITINERANTE, porque não é óbvio para quem nunca o implementou: a
 * lista conta como UMA paragem da tecla Tab, não quatro. Só o separador
 * activo tem `tabIndex=0`; os outros têm `-1` e alcançam-se com as setas,
 * Home e End. Quem navega por teclado salta a barra inteira com uma Tab e
 * cai logo no conteúdo — com quatro paragens, chegar ao primeiro campo
 * custava quatro toques.
 *
 * A SELECÇÃO SEGUE O FOCO: a seta muda logo de separador. O WAI-ARIA só
 * recomenda o contrário (mover o foco e esperar por Enter) quando abrir um
 * separador é lento; aqui o conteúdo já está no browser.
 *
 * O aspecto é o de um sublinhado e não o do `Segmented`: o `Segmented` é
 * uma escolha (um valor de um formulário); isto é navegação entre partes da
 * mesma página, e lê-se melhor encostado à linha de baixo do cabeçalho.
 * ──────────────────────────────────────────────────────────────────────────
 */

export type TabItem<T extends string> = {
  value: T;
  label: string;
  /** Número pequeno ao lado do rótulo — as artes da biblioteca, as regras da memória. Zero não aparece. */
  count?: number | null;
  /** O que o número conta, por extenso, para leitores de ecrã: "3 artes". */
  countLabel?: string;
  /** Ponto verde: há alterações por guardar neste separador. */
  dot?: boolean;
  /** Dito pelo leitor de ecrã quando há ponto. */
  dotLabel?: string;
  disabled?: boolean;
};

/** Identificador do separador. O painel usa-o em `aria-labelledby`. */
export function tabId(base: string, value: string): string {
  return `${base}-separador-${value}`;
}

/** Identificador do painel. O separador usa-o em `aria-controls`. */
export function tabPanelId(base: string, value: string): string {
  return `${base}-painel-${value}`;
}

export function Tabs<T extends string>({
  id,
  label,
  value,
  onChange,
  items,
  className,
}: {
  /** Base dos identificadores. O `TabPanel` de cada separador recebe a mesma. */
  id: string;
  /** Nome da lista, para leitores de ecrã. */
  label: string;
  value: T;
  onChange: (next: T) => void;
  items: Array<TabItem<T>>;
  className?: string;
}) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const buttons = React.useRef(new Map<T, HTMLButtonElement>());
  const [overflowing, setOverflowing] = React.useState(false);
  const enabled = items.filter((item) => !item.disabled);
  // A lista tem de ser alcançável com Tab mesmo que o valor não corresponda
  // a nenhum separador: nesse caso a paragem fica no primeiro.
  const focusable = enabled.some((item) => item.value === value) ? value : enabled[0]?.value;

  /*
    Num telemóvel os separadores não cabem todos e a lista rola na
    horizontal. Sem nada a dizê-lo, o último aparecia cortado a meio, como
    um erro de desenho: quando não cabem, a ponta direita esbate-se (e ganha
    folga para o último poder sair do esbatido).
  */
  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => setOverflowing(list.scrollWidth > list.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    // Cada separador também: um ponto ou uma contagem que aparece alarga a
    // lista sem mudar o tamanho da caixa dela.
    for (const button of buttons.current.values()) observer.observe(button);
    return () => observer.disconnect();
  }, [items.length]);

  /*
    O activo fica sempre à vista dentro da lista — também quando muda pelo
    endereço, e não por um clique. Só se mexe na rolagem da própria lista:
    `scrollIntoView` podia rolar também a página por trás.
  */
  React.useEffect(() => {
    const list = listRef.current;
    const button = buttons.current.get(value);
    if (!list || !button) return;
    const margin = 32;
    const start = button.offsetLeft;
    const end = start + button.offsetWidth;
    if (start - margin < list.scrollLeft) list.scrollLeft = Math.max(0, start - margin);
    else if (end + margin > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = end + margin - list.clientWidth;
    }
  }, [value, overflowing]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, current: T) {
    const index = enabled.findIndex((item) => item.value === current);
    if (index < 0) return;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = (index + 1) % enabled.length;
        break;
      case 'ArrowLeft':
        next = (index - 1 + enabled.length) % enabled.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = enabled.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = enabled[next];
    buttons.current.get(target.value)?.focus();
    if (target.value !== value) onChange(target.value);
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={cn(
        // `relative`: a posição de cada separador (`offsetLeft`) mede-se a
        // partir da lista, para o manter à vista.
        'no-scrollbar relative flex items-stretch gap-0.5 overflow-x-auto',
        overflowing &&
          'pr-8 [mask-image:linear-gradient(to_right,#000_calc(100%_-_2.5rem),transparent)]',
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(node) => {
              if (node) buttons.current.set(item.value, node);
              else buttons.current.delete(item.value);
            }}
            type="button"
            role="tab"
            id={tabId(id, item.value)}
            aria-selected={selected}
            aria-controls={tabPanelId(id, item.value)}
            tabIndex={item.value === focusable ? 0 : -1}
            disabled={item.disabled}
            onClick={() => {
              if (!selected) onChange(item.value);
            }}
            onKeyDown={(event) => handleKeyDown(event, item.value)}
            className={cn(
              'group relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium',
              // O contorno de foco fica por dentro: a lista rola na horizontal
              // em ecrãs estreitos, e um contorno por fora era cortado.
              'transition-colors duration-150 focus-visible:-outline-offset-2',
              selected ? 'text-fg' : 'text-fg-muted hover:text-fg',
              'disabled:cursor-not-allowed disabled:opacity-45',
            )}
          >
            {item.label}

            {item.count ? (
              <>
                <span
                  aria-hidden
                  className={cn(
                    'min-w-[1.25rem] rounded-full px-1.5 text-center text-[10.5px] font-semibold leading-[1.125rem] tabular-nums transition-colors duration-150',
                    selected ? 'bg-ink-600 text-fg' : 'bg-ink-800 text-fg-muted',
                  )}
                >
                  {item.count}
                </span>
                {item.countLabel ? <span className="sr-only">, {item.countLabel}</span> : null}
              </>
            ) : null}

            {item.dot ? (
              <>
                <span
                  aria-hidden
                  data-dot=""
                  title={item.dotLabel ?? 'Alterações por guardar'}
                  className="size-1.5 shrink-0 rounded-full bg-neon shadow-[0_0_8px_0_var(--color-neon)]"
                />
                <span className="sr-only">, {item.dotLabel ?? 'alterações por guardar'}</span>
              </>
            ) : null}

            {/* O sublinhado do activo, encostado à linha de baixo da barra. */}
            <span
              aria-hidden
              className={cn(
                'pointer-events-none absolute inset-x-3 bottom-0 h-0.5 rounded-full transition-colors duration-150',
                selected ? 'bg-neon' : 'bg-transparent group-hover:bg-line-strong',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

/**
 * O conteúdo de um separador.
 *
 * Fica no DOM escondido (`hidden`) quando não está activo, para quem o usa
 * poder manter montado o que não pode perder estado. Quem prefere só montar
 * o activo deixa os outros vazios — os identificadores existem na mesma, e o
 * `aria-controls` de cada separador aponta sempre para um elemento real.
 */
export function TabPanel({
  id,
  value,
  active,
  children,
  className,
}: {
  /** A mesma base de identificadores dada aos `Tabs`. */
  id: string;
  value: string;
  active: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tabpanel"
      id={tabPanelId(id, value)}
      aria-labelledby={tabId(id, value)}
      hidden={!active}
      // O WAI-ARIA pede o painel focável quando o primeiro conteúdo não é um
      // controlo — aqui começa sempre por uma linha de texto.
      tabIndex={0}
      className={cn('rounded-[16px] focus-visible:outline-offset-4', className)}
    >
      {children}
    </div>
  );
}
