import Image from 'next/image';
import type { LogoPlacement } from '@/lib/domain/types';
import type { HeroArt } from '@/lib/landing/heroArts';
import { cn } from '@/lib/utils/cn';
import { Blueprint } from './Blueprint';
import { Marquee } from './Marquee';

/**
 * As duas faixas de artes da primeira dobra, em sentidos opostos.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * As artes repartem-se pelas duas faixas (pares em cima, ímpares em baixo).
 * Cada uma fica com a proporção que tem — uma publicação de Instagram é mais
 * alta do que larga, e cortá-la num quadrado tirava-lhe o título.
 *
 * Enquanto houver poucas artes, cada faixa completa-se com PLANTAS — a
 * mesma linguagem técnica do resto da página — até ter `PER_ROW` peças.
 * Nunca se repete uma arte para encher: a mesma imagem duas vezes na mesma
 * faixa lia-se como engano.
 * ──────────────────────────────────────────────────────────────────────────
 */

/**
 * Peças por faixa, no mínimo. Quatro peças já passam a largura da coluna
 * (cerca de 740 px contra 580), que é o que a fila precisa para não mostrar
 * um buraco antes de a segunda cópia entrar.
 */
const PER_ROW = 4;

/** A proporção das plantas: a das artes que o gerador devolve (3:4). */
const PLAN_RATIO = 3 / 4;

type PlanVariant = {
  titleLines: 1 | 2 | 3;
  supportLines: 0 | 1;
  imageShape: 'alto' | 'largo';
  placement: LogoPlacement;
  contacts: number;
  button: boolean;
};

// Variadas de propósito: plantas iguais lado a lado liam-se como padrão de papel de parede.
const PLAN_VARIANTS: PlanVariant[] = [
  { titleLines: 2, supportLines: 1, imageShape: 'alto', placement: 'superior-esquerdo', contacts: 2, button: true },
  { titleLines: 1, supportLines: 1, imageShape: 'largo', placement: 'superior-centro', contacts: 1, button: false },
  { titleLines: 3, supportLines: 0, imageShape: 'alto', placement: 'superior-direito', contacts: 3, button: true },
  { titleLines: 2, supportLines: 0, imageShape: 'largo', placement: 'inferior-direito', contacts: 2, button: true },
  { titleLines: 1, supportLines: 1, imageShape: 'alto', placement: 'superior-esquerdo', contacts: 1, button: true },
  { titleLines: 2, supportLines: 1, imageShape: 'largo', placement: 'superior-centro', contacts: 3, button: false },
];

type Tile = { kind: 'arte'; art: HeroArt } | { kind: 'planta'; variant: PlanVariant };

function rowsFor(arts: HeroArt[]): [Tile[], Tile[]] {
  const rows: [Tile[], Tile[]] = [[], []];
  arts.forEach((art, index) => rows[index % 2].push({ kind: 'arte', art }));
  let plan = 0;
  for (const row of rows) {
    while (row.length < PER_ROW) {
      row.push({ kind: 'planta', variant: PLAN_VARIANTS[plan % PLAN_VARIANTS.length] });
      plan += 1;
    }
  }
  return rows;
}

// A altura da faixa; a largura de cada peça sai da proporção dela.
const TILE = 'relative h-[10.5rem] shrink-0 overflow-hidden rounded-2xl sm:h-[12rem] lg:h-[13.5rem]';

function TileView({ tile, copy, eager }: { tile: Tile; copy: 0 | 1; eager: boolean }) {
  if (tile.kind === 'planta') {
    const { variant } = tile;
    return (
      <div className={cn(TILE, 'ring-1 ring-line')} style={{ aspectRatio: `${PLAN_RATIO}` }}>
        <Blueprint
          ratio={PLAN_RATIO}
          titleLines={variant.titleLines}
          supportLines={variant.supportLines}
          imageShape={variant.imageShape}
          logo={{ show: true, placement: variant.placement }}
          contacts={variant.contacts}
          button={variant.button}
          annotations={false}
          className="h-full"
        />
      </div>
    );
  }

  const { art } = tile;
  return (
    <div
      className={cn(TILE, 'bg-ink-900 ring-1 ring-white/[0.06]')}
      style={{ aspectRatio: `${art.src.width} / ${art.src.height}` }}
    >
      <Image
        src={art.src}
        // A segunda cópia é só visual; o texto alternativo fica na primeira.
        alt={copy === 0 ? art.alt : ''}
        fill
        sizes="(min-width: 1024px) 170px, (min-width: 640px) 150px, 130px"
        placeholder="blur"
        priority={eager && copy === 0}
        className="object-cover"
      />
    </div>
  );
}

export function HeroMarquee({ arts }: { arts: HeroArt[] }) {
  const [top, bottom] = rowsFor(arts);
  return (
    <div className="lp-marquee-fade flex flex-col gap-4">
      <Marquee speed={34} reverse>
        {(copy) =>
          top.map((tile, index) => (
            <TileView key={`c${copy}-${index}`} tile={tile} copy={copy} eager={index < 3} />
          ))
        }
      </Marquee>
      <Marquee speed={34}>
        {(copy) =>
          bottom.map((tile, index) => (
            <TileView key={`b${copy}-${index}`} tile={tile} copy={copy} eager={index < 3} />
          ))
        }
      </Marquee>
    </div>
  );
}
