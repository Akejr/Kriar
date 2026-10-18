'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Faixa que desliza para o lado em ecrãs estreitos e vira grelha nos largos.
 *
 * Só entra na ordem do teclado quando há mesmo para onde deslizar: numa
 * grelha que cabe no ecrã, uma paragem de tabulação que não faz nada é
 * ruído. Quando desliza, as setas do teclado movem-na — o mesmo que o dedo
 * faz no telemóvel.
 */
export function ScrollRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLUListElement>(null);
  const [scrollable, setScrollable] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const measure = () => setScrollable(node.scrollWidth > node.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    // `data-reveal-group`: quando desliza, os cartões entram todos juntos
    // (ver `LandingMotion`).
    <ul
      ref={ref}
      aria-label={label}
      tabIndex={scrollable ? 0 : undefined}
      data-reveal-group=""
      className={cn(scrollable && 'focus-visible:outline-offset-4', className)}
    >
      {children}
    </ul>
  );
}
