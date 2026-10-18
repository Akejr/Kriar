'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Campo de pontos que responde a toques com anéis que se expandem.
 *
 * Decorativo. Desenhado em canvas, adormece quando não há anéis vivos, pára
 * fora do ecrã e em separadores escondidos, e fica estático quando o sistema
 * pede menos movimento.
 *
 * A cor vem da propriedade `color` do próprio canvas, resolvida pelo CSS: a
 * classe `text-neon` liga-o ao verde da interface sem o valor estar escrito
 * aqui. Isto é interface — nunca é usado dentro das artes.
 */
export interface SonarGridProps extends React.ComponentProps<'div'> {
  /** Distância entre pontos, em píxeis CSS. */
  spacing?: number;
  /** Raio do ponto em repouso. */
  dotRadius?: number;
  /** Opacidade em repouso. Os pontos na frente de onda vão a 1. */
  baseOpacity?: number;
  /** Qualquer cor CSS. Por omissão usa o verde da interface. */
  color?: string;
  /** Segundos entre pulsos automáticos. `0` desliga-os. */
  pingEvery?: number;
  /** Velocidade da frente de onda, em píxeis por segundo. */
  speed?: number;
  /** Espessura da frente de onda. */
  ringWidth?: number;
  /** Quanto o ponto cresce no pico da onda. `0` não cresce. */
  amplitude?: number;
  /** Emitir um pulso onde o utilizador toca. */
  interactive?: boolean;
  /** Máximo de anéis simultâneos. Os mais antigos saem primeiro. */
  maxRings?: number;
  /** Começar com um anel a meio da expansão, para o primeiro fotograma já mostrar a ideia. */
  seedPing?: boolean;
  /** Zona onde os pulsos nascem, em fracções da largura e altura. */
  pingArea?: [number, number, number, number];
}

type Ring = { x: number; y: number; born: number };

const MAX_DPR = 2;
const TAU = Math.PI * 2;

export function SonarGrid({
  spacing = 26,
  dotRadius = 1.4,
  baseOpacity = 0.22,
  color,
  pingEvery = 3.2,
  speed = 240,
  ringWidth = 96,
  amplitude = 2.2,
  interactive = true,
  maxRings = 5,
  seedPing = true,
  pingArea = [0.15, 0.2, 0.85, 0.8],
  className,
  children,
  ref,
  ...rest
}: SonarGridProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const ringsRef = React.useRef<Ring[]>([]);
  const refreshRef = React.useRef<() => void>(() => {});

  // O ciclo de desenho lê as opções por referência, para mudanças de
  // propriedades surtirem efeito sem reiniciar o ciclo.
  const opts = React.useRef({
    spacing,
    dotRadius,
    baseOpacity,
    pingEvery,
    speed,
    ringWidth,
    amplitude,
    interactive,
    maxRings,
    seedPing,
    pingArea,
  });
  opts.current = {
    spacing,
    dotRadius,
    baseOpacity,
    pingEvery,
    speed,
    ringWidth,
    amplitude,
    interactive,
    maxRings,
    seedPing,
    pingArea,
  };

  const setHost = React.useCallback(
    (node: HTMLDivElement | null) => {
      hostRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  React.useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let width = 0;
    let height = 0;
    let raf = 0;
    let timer = 0;
    let visible = true;
    let seeded = false;
    let stroke = '';
    let nextPing = performance.now() + opts.current.pingEvery * 1000;

    const readColor = () => {
      stroke = getComputedStyle(canvas).color;
    };

    const addRing = (x: number, y: number, born: number) => {
      readColor();
      const rings = ringsRef.current;
      rings.push({ x, y, born });
      while (rings.length > opts.current.maxRings) rings.shift();
    };

    const draw = (now: number) => {
      const o = opts.current;
      // Tempo até o anel sair do ecrã.
      const lifetime = (Math.hypot(width, height) + o.ringWidth) / o.speed;
      ringsRef.current = ringsRef.current.filter((r) => (now - r.born) / 1000 < lifetime);

      const live = ringsRef.current.map((r) => {
        const age = (now - r.born) / 1000;
        const radius = age * o.speed;
        return { x: r.x, y: r.y, radius, reach: radius + o.ringWidth, fade: 1 - age / lifetime };
      });

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = stroke;

      const cols = Math.ceil(width / o.spacing) + 1;
      const rows = Math.ceil(height / o.spacing) + 1;
      const offsetX = (width - (cols - 1) * o.spacing) / 2;
      const offsetY = (height - (rows - 1) * o.spacing) / 2;

      // Passagem 1: todos os pontos em repouso num só caminho e um só preenchimento.
      const hot: number[] = [];
      ctx.globalAlpha = o.baseOpacity;
      ctx.beginPath();
      for (let i = 0; i < cols; i += 1) {
        const cx = offsetX + i * o.spacing;
        for (let j = 0; j < rows; j += 1) {
          const cy = offsetY + j * o.spacing;
          let energy = 0;
          for (const r of live) {
            if (Math.abs(cx - r.x) > r.reach || Math.abs(cy - r.y) > r.reach) continue;
            const dist = Math.abs(Math.hypot(cx - r.x, cy - r.y) - r.radius);
            if (dist >= o.ringWidth) continue;
            const t = 1 - dist / o.ringWidth;
            // Suavização, a desvanecer com a idade do anel.
            const k = t * t * (3 - 2 * t) * r.fade;
            if (k > energy) energy = k;
          }
          if (energy < 0.01) {
            ctx.moveTo(cx + o.dotRadius, cy);
            ctx.arc(cx, cy, o.dotRadius, 0, TAU);
          } else {
            hot.push(cx, cy, energy);
          }
        }
      }
      ctx.fill();

      // Passagem 2: só os pontos na frente de onda recebem alfa e raio próprios.
      for (let k = 0; k < hot.length; k += 3) {
        const energy = hot[k + 2] ?? 0;
        ctx.globalAlpha = o.baseOpacity + (1 - o.baseOpacity) * energy;
        ctx.beginPath();
        ctx.arc(hot[k] ?? 0, hot[k + 1] ?? 0, o.dotRadius * (1 + o.amplitude * energy), 0, TAU);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!seeded) {
        seeded = true;
        const [x0, y0, x1, y1] = opts.current.pingArea;
        if (opts.current.seedPing && !reduceMotion.matches) {
          addRing(
            width * (x0 + (x1 - x0) * 0.68),
            height * (y0 + (y1 - y0) * 0.34),
            performance.now() - 500,
          );
        }
      }
      draw(performance.now());
    };

    const scheduleIdle = (delay: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => tick(performance.now()), Math.max(16, delay));
    };

    const tick = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;

      if (reduceMotion.matches) {
        ringsRef.current = [];
        draw(now);
        return;
      }

      const o = opts.current;
      if (o.pingEvery > 0 && now >= nextPing) {
        const [x0, y0, x1, y1] = o.pingArea;
        addRing(
          width * (x0 + Math.random() * (x1 - x0)),
          height * (y0 + Math.random() * (y1 - y0)),
          now,
        );
        nextPing = now + o.pingEvery * 1000;
      }

      draw(now);

      if (ringsRef.current.length > 0) raf = requestAnimationFrame(tick);
      else if (o.pingEvery > 0) scheduleIdle(nextPing - now);
    };

    const wake = () => {
      if (!raf) {
        window.clearTimeout(timer);
        raf = requestAnimationFrame(tick);
      }
    };

    refreshRef.current = () => {
      readColor();
      nextPing = Math.min(nextPing, performance.now() + opts.current.pingEvery * 1000);
      wake();
    };

    const onDown = (event: PointerEvent) => {
      if (!opts.current.interactive || reduceMotion.matches) return;
      const rect = host.getBoundingClientRect();
      addRing(event.clientX - rect.left, event.clientY - rect.top, performance.now());
      wake();
    };

    const onVisibility = () => {
      if (!document.hidden) wake();
    };

    const ro = new ResizeObserver(resize);
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true;
        if (visible) wake();
      },
      { threshold: 0 },
    );

    readColor();
    resize();
    ro.observe(host);
    io.observe(host);
    host.addEventListener('pointerdown', onDown);
    document.addEventListener('visibilitychange', onVisibility);
    reduceMotion.addEventListener('change', wake);
    wake();

    return () => {
      ro.disconnect();
      io.disconnect();
      host.removeEventListener('pointerdown', onDown);
      document.removeEventListener('visibilitychange', onVisibility);
      reduceMotion.removeEventListener('change', wake);
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      refreshRef.current = () => {};
    };
  }, []);

  // Mudanças de propriedades com o ciclo adormecido redesenham logo.
  React.useEffect(() => {
    refreshRef.current();
  }, [
    spacing,
    dotRadius,
    baseOpacity,
    color,
    pingEvery,
    speed,
    ringWidth,
    amplitude,
    interactive,
    maxRings,
    pingArea,
  ]);

  return (
    <div
      ref={setHost}
      data-slot="sonar-grid"
      className={cn('relative isolate overflow-hidden', className)}
      {...rest}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 size-full text-neon"
        style={color ? { color } : undefined}
      />
      {children}
    </div>
  );
}

export default SonarGrid;
