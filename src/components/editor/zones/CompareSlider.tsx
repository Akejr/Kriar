'use client';

import * as React from 'react';
import { ChevronsLeftRight } from 'lucide-react';

/**
 * Antes e depois, com uma divisória que se arrasta.
 *
 * As duas imagens chegam já pintadas na moldura do formato — o mesmo
 * recorte, a mesma escala —, por isso o que muda entre elas é só o que a
 * edição mudou. Com recortes diferentes, a comparação mostrava diferenças
 * que não existem.
 */
export function CompareSlider({
  before,
  after,
  beforeLabel = 'Antes',
  afterLabel = 'Depois',
}: {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const host = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState(50);
  const dragging = React.useRef(false);

  function moveTo(clientX: number) {
    const rect = host.current?.getBoundingClientRect();
    if (!rect) return;
    const value = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, value)));
  }

  return (
    <div
      ref={host}
      className="absolute inset-0 cursor-ew-resize touch-none select-none"
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        moveTo(event.clientX);
      }}
      onPointerMove={(event) => {
        if (dragging.current) moveTo(event.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      <img src={after} alt={afterLabel} className="absolute inset-0 size-full" draggable={false} />
      <img
        src={before}
        alt={beforeLabel}
        draggable={false}
        className="absolute inset-0 size-full"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      />

      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink-950/75 px-2.5 py-1 text-[11px] font-semibold text-fg ring-1 ring-line backdrop-blur-sm">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-neon px-2.5 py-1 text-[11px] font-semibold text-ink-950 shadow-[0_0_14px_rgba(191,248,57,0.45)]">
        {afterLabel}
      </span>

      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-[2px] -translate-x-1/2 bg-neon shadow-[0_0_12px_rgba(191,248,57,0.6)]"
        style={{ left: `${position}%` }}
      />
      <span
        role="slider"
        tabIndex={0}
        aria-label="Comparar antes e depois"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        aria-valuetext={`${Math.round(position)}% do antes à vista`}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 10 : 4;
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            setPosition((value) => Math.max(0, value - step));
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            setPosition((value) => Math.min(100, value + step));
          } else if (event.key === 'Home') {
            event.preventDefault();
            setPosition(0);
          } else if (event.key === 'End') {
            event.preventDefault();
            setPosition(100);
          }
        }}
        className="absolute top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-ink-950/85 text-neon ring-2 ring-neon shadow-[0_6px_18px_rgba(0,0,0,0.6)] outline-none backdrop-blur-sm focus-visible:ring-4"
        style={{ left: `${position}%` }}
      >
        <ChevronsLeftRight className="size-4" aria-hidden />
      </span>
    </div>
  );
}
