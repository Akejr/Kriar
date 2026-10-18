import * as React from 'react';
import { DEMO_BRAND } from '@/lib/landing/content';
import { cn } from '@/lib/utils/cn';

/**
 * Os desenhos de antes da Perfumaria Kianda, em SVG, e as amostras de cor.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Os frascos e o monograma eram o material da marca nas demonstrações. A
 * marca passou a ter identidade própria — logótipo e fotografias em
 * `src/kianda/`, em `src/lib/landing/kianda.ts` —, e as secções à vista e a
 * conta de demonstração usam-na. `KiandaBottle` e `KiandaLogo` ficam só
 * para as secções que estão no projecto sem uso (`HeroDemo`,
 * `Differentiation`), com a mesma geometria do desenho de recurso da
 * sementeira (`src/lib/data/seed.ts`).
 *
 * `Swatch` e `KIANDA_SWATCHES` continuam em uso: as cores da marca são as
 * mesmas.
 * ──────────────────────────────────────────────────────────────────────────
 */

const { primary, secondary, accent } = DEMO_BRAND.colors;

type Variant = 'alto' | 'largo';

/** Os dois frascos da sementeira: vidro e tampa de cada um. */
const BOTTLES: Record<Variant, { glass: string; cap: string }> = {
  alto: { glass: '#DCE6F2', cap: accent },
  largo: { glass: '#EFE6D6', cap: primary },
};

function geometry(variant: Variant) {
  const width = 900;
  const height = 1200;
  const bodyW = variant === 'alto' ? 420 : 560;
  const bodyH = variant === 'alto' ? 720 : 560;
  const bodyX = (width - bodyW) / 2;
  const bodyY = height - bodyH - 120;
  const neckW = bodyW * 0.3;
  const neckX = (width - neckW) / 2;
  return { width, height, bodyW, bodyH, bodyX, bodyY, neckW, neckX };
}

export function KiandaBottle({
  variant = 'alto',
  /** Prefixo único do gradiente: dois frascos na mesma página não partilham `id`. */
  uid,
  className,
}: {
  variant?: Variant;
  uid: string;
  className?: string;
}) {
  const g = geometry(variant);
  const { glass, cap } = BOTTLES[variant];
  const gradientId = `kianda-vidro-${uid}`;

  return (
    <svg
      viewBox={`0 0 ${g.width} ${g.height}`}
      className={cn('block', className)}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={g.bodyX}
          y1={g.bodyY}
          x2={g.bodyX + g.bodyW}
          y2={g.bodyY + g.bodyH}
        >
          <stop offset="0" stopColor={glass} />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.92} />
          <stop offset="1" stopColor={glass} />
        </linearGradient>
      </defs>
      {/* Gargalo e tampa */}
      <rect x={g.neckX} y={g.bodyY - 110} width={g.neckW} height={130} rx={14} fill={glass} />
      <rect x={g.neckX - 26} y={g.bodyY - 230} width={g.neckW + 52} height={140} rx={20} fill={cap} />
      {/* Corpo */}
      <rect
        x={g.bodyX}
        y={g.bodyY}
        width={g.bodyW}
        height={g.bodyH}
        rx={variant === 'alto' ? 42 : 70}
        fill={`url(#${gradientId})`}
      />
      {/* Reflexo */}
      <rect
        x={g.bodyX + g.bodyW * 0.14}
        y={g.bodyY + g.bodyH * 0.1}
        width={g.bodyW * 0.12}
        height={g.bodyH * 0.62}
        rx={30}
        fill="#FFFFFF"
        fillOpacity={0.5}
      />
      {/* Rótulo */}
      <rect
        x={g.bodyX + g.bodyW * 0.18}
        y={g.bodyY + g.bodyH * 0.42}
        width={g.bodyW * 0.64}
        height={g.bodyH * 0.3}
        rx={12}
        fill="#FFFFFF"
        fillOpacity={0.88}
      />
      <rect x={g.bodyX + g.bodyW * 0.28} y={g.bodyY + g.bodyH * 0.52} width={g.bodyW * 0.44} height={10} fill={cap} />
      <rect x={g.bodyX + g.bodyW * 0.34} y={g.bodyY + g.bodyH * 0.58} width={g.bodyW * 0.32} height={6} fill={cap} />
    </svg>
  );
}

/**
 * O monograma da Kianda: quadrado azul-marinho com o "K" creme e o nome ao
 * lado, como na sementeira (640 × 200).
 *
 * O nome é azul-marinho sobre transparente — num fundo escuro desaparece. Por
 * isso aparece sempre sobre a superfície clara que a revisão da aplicação usa
 * para logótipos escuros.
 */
export function KiandaLogo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <svg
      viewBox={compact ? '0 0 156 200' : '0 0 640 200'}
      className={cn('block', className)}
      aria-hidden
      focusable="false"
    >
      <rect x={8} y={30} width={140} height={140} rx={34} fill={primary} />
      <text
        x={78}
        y={104}
        fill={secondary}
        fontSize={86}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontFamily: 'var(--font-ui-sans), ui-sans-serif, system-ui, sans-serif' }}
      >
        K
      </text>
      {compact ? null : (
        <text
          x={176}
          y={104}
          fill={primary}
          fontSize={58}
          fontWeight={600}
          dominantBaseline="middle"
          style={{ fontFamily: 'var(--font-ui-sans), ui-sans-serif, system-ui, sans-serif' }}
        >
          KIANDA
        </text>
      )}
    </svg>
  );
}

/** Uma amostra de cor, como os círculos do painel do editor. */
export function Swatch({ color, className, style }: { color: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden
      className={cn('block rounded-full ring-1 ring-inset ring-white/12', className)}
      style={{ backgroundColor: color, ...style }}
    />
  );
}

export const KIANDA_SWATCHES = [primary, secondary, accent] as const;
