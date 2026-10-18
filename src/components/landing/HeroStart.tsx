'use client';

import * as React from 'react';
import Link from 'next/link';
import { useStartTarget } from './SessionLinks';
import { buttonClass } from './ui';

const LABEL = 'Criar a minha primeira arte';
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';

/**
 * A chamada da primeira dobra (e da última secção, que acaba como a página
 * começa), com as letras a baralhar ao passar por cima.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * As letras trocam por caracteres ao acaso e voltam ao lugar da esquerda
 * para a direita, meia letra a cada 30 ms (cerca de 1,6 s ao todo). Três
 * cuidados que o efeito pede:
 *
 *  · a largura não mexe: o texto verdadeiro fica por baixo, invisível, a
 *    segurar o tamanho do botão, e o baralhado desenha-se por cima;
 *  · um leitor de ecrã ouve sempre "Criar a minha primeira arte"
 *    (`aria-label`), nunca os caracteres ao acaso;
 *  · com menos movimento pedido pelo sistema, não baralha.
 *
 * Também baralha ao receber o foco pelo teclado: quem não usa rato vê o
 * mesmo gesto. Os espaços ficam no sítio, para as palavras não perderem a
 * forma enquanto as letras correm.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function HeroStart() {
  const { href } = useStartTarget();
  const [text, setText] = React.useState(LABEL);
  const timer = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    },
    [],
  );

  function scramble() {
    if (timer.current !== null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let iteration = 0;
    timer.current = window.setInterval(() => {
      setText(
        LABEL.split('')
          .map((letter, index) =>
            letter === ' ' || index < iteration
              ? letter
              : CHARS[Math.floor(Math.random() * CHARS.length)],
          )
          .join(''),
      );
      if (iteration >= LABEL.length) {
        if (timer.current !== null) window.clearInterval(timer.current);
        timer.current = null;
        setText(LABEL);
      }
      // Meia letra por passo, e não um terço: com as 27 letras desta
      // chamada, um terço deixava-a ilegível quase dois segundos e meio.
      iteration += 1 / 2;
    }, 30);
  }

  return (
    <Link
      href={href}
      aria-label={LABEL}
      onMouseEnter={scramble}
      onFocus={scramble}
      className={buttonClass('primary', 'pill', 'glow-neon')}
    >
      {/*
        O texto verdadeiro, invisível, dá a largura; o baralhado fica por
        cima, posicionado, e não conta para o tamanho. Na mesma célula de
        grelha contava: um "W" no lugar de um "i" alargava o botão 30 px.
      */}
      <span aria-hidden className="relative inline-block">
        <span className="invisible">{LABEL}</span>
        <span className="absolute inset-0 overflow-hidden text-center">{text}</span>
      </span>
    </Link>
  );
}
