import { APP } from '@/config/app';
import { cn } from '@/lib/utils/cn';

/**
 * Logótipo.
 *
 * Dois usos: `wordmark` é a assinatura completa, `mark` é só o "K" para
 * espaços estreitos. Os ficheiros têm fundo transparente e o "riar" é claro,
 * desenhado para fundos escuros — não usar sobre superfícies claras.
 *
 * A altura é dada em píxeis e a largura sai da proporção do ficheiro, para a
 * imagem não provocar salto de layout enquanto carrega.
 */
export function Logo({
  variant = 'wordmark',
  height = 20,
  className,
}: {
  variant?: 'wordmark' | 'mark';
  height?: number;
  className?: string;
}) {
  const isWordmark = variant === 'wordmark';
  const width = isWordmark ? Math.round(height * APP.logo.wordmarkRatio) : height;

  return (
    <img
      src={isWordmark ? APP.logo.wordmark : APP.logo.mark}
      alt={APP.name}
      width={width}
      height={height}
      className={cn('block shrink-0 select-none object-contain', className)}
      style={{ height, width }}
      draggable={false}
    />
  );
}
