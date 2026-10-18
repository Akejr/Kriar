import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Uma fila que anda sozinha, em ciclo.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Duas cópias do mesmo conteúdo, lado a lado, a deslizar juntas: quando a
 * primeira sai, a segunda está exactamente onde ela começou, e o ciclo
 * recomeça sem salto. A segunda é só visual (`aria-hidden`): um leitor de
 * ecrã lê cada arte uma vez.
 *
 * Só CSS (`landing.css`, `.lp-marquee`): nenhum JavaScript a correr por
 * fotograma. Com menos movimento pedido pelo sistema, a fila fica parada.
 *
 * `children` recebe o número da cópia, para o que só deve acontecer uma vez
 * — carregar uma imagem com prioridade, por exemplo — ficar na primeira.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function Marquee({
  children,
  pauseOnHover = false,
  reverse = false,
  className,
  speed = 40,
}: {
  children: (copy: 0 | 1) => React.ReactNode;
  pauseOnHover?: boolean;
  reverse?: boolean;
  className?: string;
  /** Segundos que uma cópia leva a passar. */
  speed?: number;
}) {
  const track = cn('lp-marquee-track', reverse && 'lp-marquee-reverse');
  return (
    <div
      className={cn('lp-marquee', pauseOnHover && 'lp-marquee-pausable', className)}
      style={{ ['--lp-duration' as string]: `${speed}s` }}
    >
      <div className={track}>{children(0)}</div>
      <div className={track} aria-hidden="true">
        {children(1)}
      </div>
    </div>
  );
}
