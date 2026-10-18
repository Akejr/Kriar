'use client';

import * as React from 'react';

/**
 * Movimento da página pública: entradas ao rolar e vinhetas que só correm à
 * vista.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Um componente sem marcação, com dois observadores para a página inteira,
 * em vez de um componente cliente à volta de cada bloco. As secções ficam
 * componentes de servidor e marcam-se com atributos:
 *
 *  · `data-reveal` — entra uma vez, quando chega ao ecrã;
 *  · `data-reveal-group` — faixa que desliza para o lado: quando desliza
 *                    mesmo, os `data-reveal` dela entram todos juntos;
 *  · `data-play`   — vinheta animada; corre só enquanto está à vista
 *                    ("on"), fica parada onde ia quando sai ("paused").
 *
 * A ORDEM importa, e é o que evita o piscar: primeiro marcam-se como já
 * vistos os blocos que estão no ecrã neste instante, e só depois se liga
 * `data-motion` na raiz — que é o que esconde os restantes. Sem JavaScript,
 * ou com menos movimento pedido pelo sistema, nada chega a ser escondido.
 *
 * O separador escondido pára as vinhetas (`data-tab="escondido"`).
 * ──────────────────────────────────────────────────────────────────────────
 */
export function LandingMotion({ rootId }: { rootId: string }) {
  React.useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root || typeof IntersectionObserver === 'undefined') return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cleanups: Array<() => void> = [];

    // Entradas
    if (!reduce.matches) {
      const pending = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
      const revealer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) show(entry.target as HTMLElement);
          }
        },
        { rootMargin: '0px 0px -6% 0px', threshold: 0.08 },
      );

      /*
        Numa faixa que desliza para o lado (`data-reveal-group`: a galeria
        nos telemóveis), os cartões que estão fora do ecrã NA HORIZONTAL
        nunca cruzam a janela enquanto se rola a página. Ficavam invisíveis
        até alguém os arrastar, e entravam a meio do gesto. Ali, o primeiro
        cartão que entra traz a faixa inteira. Quando a faixa é uma grelha
        que cabe no ecrã, cada cartão entra por si, como o resto.
      */
      function show(element: HTMLElement) {
        const strip = element.closest<HTMLElement>('[data-reveal-group]');
        const group =
          strip && strip.scrollWidth > strip.clientWidth + 1
            ? Array.from(strip.querySelectorAll<HTMLElement>('[data-reveal]'))
            : [element];
        for (const member of group) {
          member.dataset.shown = '';
          revealer.unobserve(member);
        }
      }

      const viewport = window.innerHeight;
      for (const element of pending) {
        const rect = element.getBoundingClientRect();
        if (rect.top < viewport && rect.bottom > 0) show(element);
      }

      for (const element of pending) {
        if (!('shown' in element.dataset)) revealer.observe(element);
      }
      root.dataset.motion = 'on';
      cleanups.push(() => revealer.disconnect());
    }

    // Vinhetas
    const players = Array.from(root.querySelectorAll<HTMLElement>('[data-play]'));
    const player = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          if (entry.isIntersecting) element.dataset.play = 'on';
          else if (element.dataset.play === 'on') element.dataset.play = 'paused';
        }
      },
      { threshold: 0.2 },
    );
    players.forEach((element) => player.observe(element));
    cleanups.push(() => player.disconnect());

    const onVisibility = () => {
      if (document.hidden) root.dataset.tab = 'escondido';
      else delete root.dataset.tab;
    };
    document.addEventListener('visibilitychange', onVisibility);
    cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility));

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      delete root.dataset.motion;
    };
  }, [rootId]);

  return null;
}
