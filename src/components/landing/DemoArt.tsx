import Image from 'next/image';
import type { LogoPlacement } from '@/lib/domain/types';
import type { DemoEntry, DemoMode } from '@/lib/landing/demos';
import { cn } from '@/lib/utils/cn';
import { Blueprint } from './Blueprint';

/**
 * O lugar de uma arte de demonstração.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Com ficheiro, é a arte, pelo `next/image`: com as medidas reais o espaço
 * fica reservado antes de a imagem chegar (nada salta), e o browser recebe
 * a largura que precisa em vez dos 1080 px do PNG. Abaixo da dobra carrega
 * quando se aproxima do ecrã.
 *
 * Sem ficheiro, é o esboço técnico. Em desenvolvimento leva o carimbo "Arte
 * por gerar" e o identificador, para o dono saber que ficheiro falta; em
 * produção só chega aqui quem pode mostrar um esboço (a demonstração do
 * topo e o exemplo completo), com o carimbo "Demonstração". Nunca se
 * desenha uma arte falsa no lugar de uma verdadeira.
 * ──────────────────────────────────────────────────────────────────────────
 */

/** Variações do esboço, para os lugares vazios não parecerem todos iguais. */
const VARIANTS: Array<{
  titleLines: 1 | 2 | 3;
  imageShape: 'alto' | 'largo';
  placement: LogoPlacement;
  contacts: number;
}> = [
  { titleLines: 2, imageShape: 'alto', placement: 'superior-esquerdo', contacts: 1 },
  { titleLines: 1, imageShape: 'largo', placement: 'superior-centro', contacts: 2 },
  { titleLines: 3, imageShape: 'alto', placement: 'superior-direito', contacts: 1 },
  { titleLines: 2, imageShape: 'largo', placement: 'inferior-centro', contacts: 1 },
];

function variantFor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return VARIANTS[hash % VARIANTS.length];
}

export function DemoArt({
  entry,
  mode,
  sizes,
  priority = false,
  className,
}: {
  entry: DemoEntry;
  mode: DemoMode;
  /** O `sizes` do `next/image`: a largura com que a arte aparece. */
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (entry.image) {
    return (
      <Image
        src={entry.image}
        alt={entry.alt}
        width={entry.width}
        height={entry.height}
        sizes={sizes}
        priority={priority}
        className={cn('block h-auto w-full', className)}
      />
    );
  }

  const variant = variantFor(entry.id);
  const dev = mode === 'development';

  return (
    <Blueprint
      ratio={entry.width / entry.height}
      titleLines={variant.titleLines}
      imageShape={variant.imageShape}
      logo={{ show: true, placement: variant.placement }}
      contacts={variant.contacts}
      stamp={dev ? { title: 'Arte por gerar', detail: entry.id } : { title: 'Demonstração' }}
      formatLabel={`${entry.width} × ${entry.height}`}
      label={
        dev
          ? `Arte por gerar: ${entry.id}. Esboço técnico no lugar da arte.`
          : 'Esboço técnico de demonstração, no lugar da arte.'
      }
      className={className}
    />
  );
}
