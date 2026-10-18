'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Texto que se acende à medida que a página rola.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * As palavras vêm do servidor, cada uma num `<span class="lp-lit-word">`
 * com o seu número (`--i`). Esta caixa só escreve o progresso (`--lp-p`, de
 * 0 a 1) e o CSS decide o resto (`landing.css`): uma palavra acende quando o
 * progresso passa por ela. O progresso vai de 0, com o topo do texto a 90%
 * da altura do ecrã, a 1, com o fim do texto a 58% — lê-se ao ritmo de quem
 * rola, e está todo aceso quando o texto chega ao meio do ecrã (com o fim a
 * 42%, quem parasse com a frase ao centro ficava com as últimas palavras
 * apagadas).
 *
 * Só escuta o deslocamento com o texto perto do ecrã, e no máximo uma vez
 * por fotograma. Com menos movimento pedido pelo sistema (e sem JavaScript)
 * não escreve nada, e está tudo aceso desde o início.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function ScrollLit({
  count,
  className,
  children,
}: {
  /** Quantas palavras há lá dentro. */
  count: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    let listening = false;

    const update = () => {
      raf = 0;
      if (motion.matches) {
        element.style.removeProperty('--lp-p');
        return;
      }
      const rect = element.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const start = viewport * 0.9;
      const end = viewport * 0.58;
      const progress = (start - rect.top) / Math.max(1, rect.height + start - end);
      element.style.setProperty('--lp-p', Math.min(1, Math.max(0, progress)).toFixed(4));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const listen = (on: boolean) => {
      if (on === listening) return;
      listening = on;
      if (on) {
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
      } else {
        window.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', schedule);
      }
    };

    // Uma margem à volta: começa a escutar um pouco antes de o texto entrar.
    const observer = new IntersectionObserver(
      ([entry]) => {
        listen(Boolean(entry?.isIntersecting));
        schedule();
      },
      { rootMargin: '25% 0px 25% 0px' },
    );
    observer.observe(element);
    update();
    motion.addEventListener?.('change', schedule);

    return () => {
      observer.disconnect();
      listen(false);
      cancelAnimationFrame(raf);
      motion.removeEventListener?.('change', schedule);
      element.style.removeProperty('--lp-p');
    };
  }, []);

  return (
    <div ref={ref} className={cn('lp-lit', className)} style={{ ['--lp-n' as string]: count }}>
      {children}
    </div>
  );
}
