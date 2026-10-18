'use client';

import * as React from 'react';
import { Pencil } from 'lucide-react';
import {
  strokePath,
  zoneBounds,
  type ZonePoint,
  type ZoneShape,
  type ZoneStroke,
} from '@/lib/composition/zones';
import { cn } from '@/lib/utils/cn';

/** Largura da caixa SVG. A altura segue a proporção da arte. */
const VIEW_WIDTH = 1000;

/**
 * A camada onde o cliente pinta as zonas, por cima da arte.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Um marcador, não um pincel de pintura: o traço é translúcido, para a
 * arte continuar a ver-se por baixo, e cada zona ganha um contorno
 * tracejado em movimento — a linguagem de "selecção" que qualquer editor
 * de imagem ensinou. O número da zona aparece no canto, com o mesmo
 * número do cartão onde se escreve o pedido.
 *
 * O cursor é o próprio pincel: um círculo do tamanho do traço, com um
 * lápis ao lado. Ver o tamanho antes de pintar poupa traços desfeitos.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function ZoneCanvas({
  zones,
  activeId,
  brush,
  aspect,
  disabled,
  onStroke,
  onSelectZone,
}: {
  zones: ZoneShape[];
  activeId: string | null;
  /** Diâmetro do pincel, em fracção da largura da arte. */
  brush: number;
  /** Altura ÷ largura da arte. */
  aspect: number;
  disabled?: boolean;
  onStroke: (stroke: ZoneStroke) => void;
  onSelectZone: (id: string) => void;
}) {
  const uid = React.useId().replace(/:/g, '');
  const host = React.useRef<HTMLDivElement>(null);
  const draft = React.useRef<ZoneStroke | null>(null);
  const frame = React.useRef<number | null>(null);
  /** Cópia do traço em curso para desenhar; a referência é a que acumula. */
  const [drawing, setDrawing] = React.useState<ZoneStroke | null>(null);
  const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(null);
  const [hostWidth, setHostWidth] = React.useState(0);
  const reducedMotion = usePrefersReducedMotion();

  const viewHeight = VIEW_WIDTH * aspect;

  React.useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setHostWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  React.useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  // Um desenho por fotograma: o ponteiro dispara mais eventos do que o
  // ecrã consegue mostrar.
  function schedule() {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const stroke = draft.current;
      setDrawing(stroke ? { points: stroke.points.slice(), size: stroke.size } : null);
    });
  }

  function pointOf(event: React.PointerEvent): ZonePoint {
    const rect = host.current!.getBoundingClientRect();
    const u = (event.clientX - rect.left) / rect.width;
    const v = (event.clientY - rect.top) / rect.height;
    return [Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, v))];
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    draft.current = { points: [pointOf(event)], size: brush };
    schedule();
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const rect = host.current?.getBoundingClientRect();
    if (rect) setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    const stroke = draft.current;
    if (!stroke) return;
    const point = pointOf(event);
    const last = stroke.points[stroke.points.length - 1];
    // Pontos a menos de 0,25% da largura não acrescentam forma, só peso.
    const dx = point[0] - last[0];
    const dy = (point[1] - last[1]) * aspect;
    if (dx * dx + dy * dy < 0.0025 * 0.0025) return;
    stroke.points.push(point);
    schedule();
  }

  function finish(event: React.PointerEvent<HTMLDivElement>) {
    const stroke = draft.current;
    draft.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (stroke) onStroke(stroke);
    schedule();
  }

  const cursorSize = Math.max(8, brush * hostWidth);

  return (
    <div
      ref={host}
      aria-label="Área de marcação. Pinta por cima do que queres mudar."
      role="application"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onPointerLeave={() => setCursor(null)}
      className={cn(
        'absolute inset-0 touch-none select-none',
        disabled ? 'cursor-not-allowed' : 'cursor-none',
      )}
    >
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
        aria-hidden
      >
        <defs>
          {/*
            O contorno de cada zona: a forma dilatada menos a forma. Sobra um
            anel com a silhueta exacta da união dos traços, por mais que se
            sobreponham.
          */}
          <filter
            id={`${uid}-anel`}
            filterUnits="userSpaceOnUse"
            x={-20}
            y={-20}
            width={VIEW_WIDTH + 40}
            height={viewHeight + 40}
          >
            <feMorphology in="SourceAlpha" operator="dilate" radius={3.5} result="largo" />
            <feComposite in="largo" in2="SourceAlpha" operator="out" result="anel" />
            <feFlood floodColor="#ffffff" />
            <feComposite in2="anel" operator="in" />
          </filter>

          {/* Tracejado em movimento: a "selecção" de qualquer editor de imagem. */}
          <pattern
            id={`${uid}-formigas`}
            patternUnits="userSpaceOnUse"
            width={14}
            height={14}
            patternTransform="rotate(45)"
          >
            <rect width={7} height={14} fill="#BFF839" />
            <rect x={7} width={7} height={14} fill="#080A09" />
            {reducedMotion ? null : (
              <animateTransform
                attributeName="patternTransform"
                type="translate"
                from="0 0"
                to="14 0"
                dur="0.9s"
                repeatCount="indefinite"
                additive="sum"
              />
            )}
          </pattern>

          {zones.map((zone) => (
            <mask
              key={zone.id}
              id={`${uid}-m-${zone.id}`}
              maskUnits="userSpaceOnUse"
              x={-20}
              y={-20}
              width={VIEW_WIDTH + 40}
              height={viewHeight + 40}
            >
              <g filter={`url(#${uid}-anel)`}>
                {zone.strokes.map((stroke, index) => (
                  <path
                    key={index}
                    d={strokePath(stroke, VIEW_WIDTH, viewHeight)}
                    stroke="#ffffff"
                    strokeWidth={stroke.size * VIEW_WIDTH}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ))}
              </g>
            </mask>
          ))}
        </defs>

        {zones.map((zone) => {
          const active = zone.id === activeId;
          return (
            <g key={zone.id}>
              {/*
                O corpo do marcador. A opacidade vai no grupo e não em cada
                traço: dois traços sobrepostos não escurecem a dobrar.
              */}
              <g
                opacity={active ? 0.42 : 0.28}
                className={cn(
                  'transition-opacity duration-200',
                  active && !reducedMotion && 'animate-[kriar-zone-breathe_2.4s_ease-in-out_infinite]',
                )}
                style={{ mixBlendMode: 'screen' }}
              >
                {zone.strokes.map((stroke, index) => (
                  <path
                    key={index}
                    d={strokePath(stroke, VIEW_WIDTH, viewHeight)}
                    stroke="#BFF839"
                    strokeWidth={stroke.size * VIEW_WIDTH}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ))}
              </g>
              <rect
                x={-20}
                y={-20}
                width={VIEW_WIDTH + 40}
                height={viewHeight + 40}
                fill={`url(#${uid}-formigas)`}
                mask={`url(#${uid}-m-${zone.id})`}
                opacity={active ? 1 : 0.75}
              />
            </g>
          );
        })}

        {/* O traço a ser desenhado agora. */}
        {drawing ? (
          <path
            d={strokePath(drawing, VIEW_WIDTH, viewHeight)}
            stroke="#BFF839"
            strokeOpacity={0.5}
            strokeWidth={drawing.size * VIEW_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            style={{ mixBlendMode: 'screen' }}
          />
        ) : null}
      </svg>

      {/* Números das zonas, no canto superior esquerdo de cada uma. */}
      {zones.map((zone, index) => {
        const bounds = zoneBounds(zone, aspect);
        if (!bounds) return null;
        const active = zone.id === activeId;
        return (
          <button
            key={zone.id}
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onSelectZone(zone.id)}
            aria-label={`Zona ${index + 1}`}
            title={`Zona ${index + 1}`}
            className={cn(
              'absolute grid size-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-[11px] font-bold tabular-nums',
              'ring-2 ring-ink-950 transition-transform duration-150 hover:scale-110',
              'animate-[kriar-pop_0.38s_cubic-bezier(0.2,1.5,0.4,1)]',
              active
                ? 'bg-neon text-ink-950 shadow-[0_0_16px_rgba(191,248,57,0.6)]'
                : 'bg-ink-900 text-neon shadow-[0_4px_12px_rgba(0,0,0,0.6)]',
            )}
            // Preso dentro da moldura: uma zona encostada à aresta deixava o
            // número meio cortado pelo recorte da arte.
            style={{
              left: `clamp(14px, ${bounds.x * 100}%, calc(100% - 14px))`,
              top: `clamp(14px, ${bounds.y * 100}%, calc(100% - 14px))`,
            }}
          >
            {index + 1}
          </button>
        );
      })}

      {/* O cursor é o pincel: o tamanho do traço, com um lápis ao lado. */}
      {cursor && !disabled ? (
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-0"
          style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
        >
          <span
            className={cn(
              'absolute rounded-full border-[1.5px] border-neon bg-neon/10 shadow-[0_0_0_1px_rgba(8,10,9,0.55),0_0_14px_rgba(191,248,57,0.35)] transition-[width,height] duration-100',
              drawing && 'bg-neon/20',
            )}
            style={{
              width: cursorSize,
              height: cursorSize,
              left: -cursorSize / 2,
              top: -cursorSize / 2,
            }}
          />
          <Pencil
            className={cn(
              'absolute size-4 text-neon drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]',
              drawing && !reducedMotion && 'animate-[kriar-pencil_0.5s_ease-in-out_infinite]',
            )}
            style={{ left: cursorSize / 2 - 2, top: -cursorSize / 2 - 14 }}
          />
        </span>
      ) : null}
    </div>
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
