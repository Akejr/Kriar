'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Largura ajustável do painel de criação.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O painel tinha 19 rem fixos. Num ecrã largo sobrava palco e faltava
 * espaço para escrever o pedido; num portátil pequeno era o contrário.
 *
 * O ajustador vive na fronteira entre o painel e o palco, invisível até o
 * rato lá chegar. Aí aparece uma linha verde com uma pega ao centro — o mesmo
 * verde da interface, que é a cor das coisas em que se pode mexer.
 *
 * Detalhes que fazem diferença no uso:
 *
 *  · aparece com um pequeno atraso, para não piscar quando o rato só passa
 *    pela fronteira a caminho de outro sítio;
 *  · arrastar captura o ponteiro, por isso não se perde quando o rato sai da
 *    faixa estreita ou passa por cima do palco;
 *  · duplo clique repõe a largura original;
 *  · funciona pelo teclado — setas para ajustar, Shift para passos maiores,
 *    Home e End para os limites —, porque um separador que só o rato move
 *    não existe para quem não usa rato;
 *  · a largura escolhida fica guardada neste browser.
 * ──────────────────────────────────────────────────────────────────────────
 */

export const PANEL_DEFAULT = 304;
export const PANEL_MIN = 272;
const PANEL_MAX = 560;
/** O palco nunca fica mais estreito do que isto, seja qual for o ecrã. */
const STAGE_MIN = 480;

const STORAGE_KEY = 'kriar.editor.painel';

// `useLayoutEffect` para ler a largura guardada antes da primeira pintura:
// com `useEffect` o painel abria com a largura por omissão e saltava.
const useIsoLayoutEffect = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

function maxWidth(): number {
  if (typeof window === 'undefined') return PANEL_MAX;
  // Desconta a barra de ícones da esquerda, que tem 68 px.
  return Math.max(PANEL_MIN, Math.min(PANEL_MAX, window.innerWidth - 68 - STAGE_MIN));
}

function clamp(value: number): number {
  return Math.round(Math.min(maxWidth(), Math.max(PANEL_MIN, value)));
}

/** Largura actual do painel, com leitura e gravação no browser. */
export function usePanelWidth() {
  const [width, setWidth] = React.useState(PANEL_DEFAULT);

  useIsoLayoutEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(STORAGE_KEY));
      if (Number.isFinite(saved) && saved > 0) setWidth(clamp(saved));
    } catch {
      // Sem acesso ao armazenamento, fica a largura por omissão.
    }
  }, []);

  // Uma janela que encolhe não pode deixar o painel a comer o palco.
  React.useEffect(() => {
    const onResize = () => setWidth((current) => clamp(current));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const change = React.useCallback((next: number) => setWidth(clamp(next)), []);

  const persist = React.useCallback((value: number) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(clamp(value)));
    } catch {
      // Não guardar não é grave: a largura vale até fechar o separador.
    }
  }, []);

  return { width, change, persist };
}

export function PanelResizer({
  width,
  onChange,
  onCommit,
}: {
  width: number;
  onChange: (width: number) => void;
  /** Chamado no fim de um ajuste, para guardar. */
  onCommit: (width: number) => void;
}) {
  const [dragging, setDragging] = React.useState(false);
  const origin = React.useRef<{ x: number; width: number } | null>(null);
  const latest = React.useRef(width);

  React.useEffect(() => {
    latest.current = width;
  }, [width]);

  /*
    Durante o arrasto, o cursor e a selecção de texto valem para a página
    toda. Sem isto, o cursor voltava a seta ao sair da faixa e o arrasto
    seleccionava o texto do painel pelo caminho.
  */
  React.useEffect(() => {
    if (!dragging) return;
    const body = document.body;
    const previous = { cursor: body.style.cursor, userSelect: body.style.userSelect };
    body.style.cursor = 'col-resize';
    body.style.userSelect = 'none';
    return () => {
      body.style.cursor = previous.cursor;
      body.style.userSelect = previous.userSelect;
    };
  }, [dragging]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    origin.current = { x: event.clientX, width };
    setDragging(true);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!origin.current) return;
    onChange(origin.current.width + (event.clientX - origin.current.x));
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (!origin.current) return;
    origin.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onCommit(latest.current);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 48 : 16;
    let next: number | null = null;
    if (event.key === 'ArrowLeft') next = width - step;
    else if (event.key === 'ArrowRight') next = width + step;
    else if (event.key === 'Home') next = PANEL_MIN;
    else if (event.key === 'End') next = Number.POSITIVE_INFINITY;
    else if (event.key === 'Enter') next = PANEL_DEFAULT;
    if (next === null) return;
    event.preventDefault();
    onChange(next);
    onCommit(next);
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Largura do painel de criação"
      aria-valuemin={PANEL_MIN}
      aria-valuemax={PANEL_MAX}
      aria-valuenow={Math.round(width)}
      tabIndex={0}
      title="Arrasta para ajustar · duplo clique repõe"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={() => {
        onChange(PANEL_DEFAULT);
        onCommit(PANEL_DEFAULT);
      }}
      onKeyDown={onKeyDown}
      className={cn(
        // Faixa de 16 px centrada na fronteira: fácil de apanhar sem
        // tapar nada de útil de nenhum dos lados.
        'group/resizer absolute inset-y-0 -right-2 z-30 hidden w-4 cursor-col-resize touch-none outline-none lg:block',
      )}
    >
      {/* A linha de sempre, discreta. Some quando a verde aparece. */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-line-strong to-transparent transition-opacity duration-150',
          'group-hover/resizer:opacity-0 group-hover/resizer:delay-100 group-focus-visible/resizer:opacity-0',
          dragging && 'opacity-0',
        )}
      />

      {/* A linha verde. */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 rounded-full opacity-0 transition-all duration-150',
          'bg-gradient-to-b from-neon/0 via-neon/80 to-neon/0',
          'group-hover/resizer:opacity-100 group-hover/resizer:delay-100 group-focus-visible/resizer:opacity-100',
          dragging && 'via-neon opacity-100 shadow-[0_0_14px_rgba(191,248,57,0.45)]',
        )}
      />

      {/* A pega, ao centro: diz "isto arrasta-se" sem palavras. */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-1/2 top-1/2 flex h-11 w-[11px] -translate-x-1/2 -translate-y-1/2 scale-75 items-center justify-center gap-[2.5px] rounded-full bg-neon opacity-0 transition-all duration-200 ease-out',
          'shadow-[0_0_18px_rgba(191,248,57,0.5),0_4px_12px_rgba(0,0,0,0.5)]',
          'group-hover/resizer:scale-100 group-hover/resizer:opacity-100 group-hover/resizer:delay-100',
          'group-focus-visible/resizer:scale-100 group-focus-visible/resizer:opacity-100',
          dragging && 'scale-100 opacity-100',
        )}
      >
        <span className="h-4 w-px rounded-full bg-ink-950/65" />
        <span className="h-4 w-px rounded-full bg-ink-950/65" />
      </span>
    </div>
  );
}
