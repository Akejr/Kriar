'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { isBrandReady } from '@/lib/domain/factories';
import { useSession } from '@/store/session';
import { buttonClass } from './ui';

/**
 * As ligações da página pública que dependem da sessão.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * A página é estática e servida igual a toda a gente; só estas ilhas leem a
 * sessão, no browser (o modo de demonstração guarda-a no IndexedDB, e o
 * servidor não a vê). Enquanto a sessão carrega, mostram o caminho de quem
 * ainda não tem conta — é o que o servidor renderiza, e é o caso da grande
 * maioria das visitas.
 *
 * Com sessão, o destino é a tela de criação quando a marca está pronta.
 *
 * Sem marca pronta, o destino é a ARTE INSTANTÂNEA e não o cadastro.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * A chamada diz "criar a minha primeira arte", e durante muito tempo o que
 * ela abria era um cadastro de quatro etapas que acaba num design system
 * aprovado. É o caminho certo para quem vai publicar todas as semanas, e é
 * o caminho errado para quem acabou de chegar: ninguém decide uma
 * identidade visual antes de ver o produto funcionar uma vez.
 *
 * O botão passa a cumprir o que promete. A identidade completa continua a
 * existir, com uma ligação própria no ecrã instantâneo e na área Marca — e
 * é ela que mantém as publicações coerentes entre si, o que só importa a
 * partir da segunda.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function useStartTarget(): { href: string; authed: boolean } {
  const { status, brand } = useSession();
  if (status !== 'authed') return { href: '/criar-conta', authed: false };
  return { href: isBrandReady(brand) ? '/inicio' : '/instantanea', authed: true };
}

/** "Criar a minha primeira arte": cria conta, ou abre a aplicação a quem já a tem. */
export function StartLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { href } = useStartTarget();
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/** Os botões à direita da barra do topo. */
export function HeaderActions() {
  const { href, authed } = useStartTarget();

  if (authed) {
    return (
      <Link href={href} className={buttonClass('primary', 'sm')}>
        Abrir a Kriar
      </Link>
    );
  }

  return (
    <>
      <Link href="/entrar" className={buttonClass('ghost', 'sm')}>
        Entrar
      </Link>
      {/*
        Abaixo de 640 px a chamada principal sai da barra: está logo no topo
        da página e no menu, e na barra não cabe ao lado do "Entrar".

        `max-sm:hidden`, e não `hidden sm:inline-flex`: o `buttonClass` já
        traz `inline-flex`, e entre duas classes simples para a mesma
        propriedade o Tailwind desempata por ordem alfabética — o
        `inline-flex` ganhava, o botão ficava à vista e a barra passava a
        largura do ecrã (ver `buttonClass`).
      */}
      <Link href="/criar-conta" className={buttonClass('primary', 'sm', 'max-sm:hidden')}>
        Criar a minha primeira arte
      </Link>
    </>
  );
}

/**
 * Menu das secções abaixo de 1024 px.
 *
 * Um botão com `aria-expanded` e um painel por baixo da barra. Fecha ao
 * escolher uma secção, com Escape e com um toque fora — e devolve o foco ao
 * botão quando fecha pelo teclado.
 *
 * Vai até ao `lg`, e não só aos telemóveis: num tablet ao alto (768 px) as
 * quatro secções, o "Entrar" e a chamada principal não cabem numa linha, e
 * as ligações partiam-se em duas ("Como / funciona").
 */
export function MobileMenu({ links }: { links: Array<{ href: string; label: string }> }) {
  const [open, setOpen] = React.useState(false);
  const { authed } = useStartTarget();
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const panelId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Fechar o menu' : 'Abrir o menu'}
        onClick={() => setOpen((value) => !value)}
        className="grid size-9 place-items-center rounded-[10px] text-fg-muted transition-colors hover:bg-ink-800 hover:text-fg"
      >
        {open ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
      </button>

      {/*
        Fundo opaco e sem `backdrop-blur`. O painel vive dentro da barra, que
        já tem desfoque — e um elemento com `backdrop-filter` só "vê" o que
        está dentro do antepassado com o mesmo filtro, não a página. O
        desfoque daqui não desfocava nada, e no Chrome o título da primeira
        dobra chegava a aparecer nítido por trás das ligações.
      */}
      {/*
        As margens acompanham as da barra: o texto das ligações alinha com o
        logótipo (`px-3` + `px-2` = os 20 px da barra; 32 px a partir de 640).
      */}
      <div
        ref={panelRef}
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-line bg-ink-950 px-3 pb-5 pt-2 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)] sm:px-6"
      >
        <nav aria-label="Secções da página">
          <ul className="flex flex-col">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex h-11 items-center rounded-[10px] px-2 text-[15px] text-fg-muted transition-colors hover:bg-ink-800 hover:text-fg"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {/*
          Só o que a barra não mostra. "Entrar" e "Abrir a Kriar" estão
          sempre na barra, logo por cima; a chamada principal sai dela abaixo
          de 640 px, e é só aí que entra aqui. Repetidos, eram dois botões da
          largura do ecrã a dizer o mesmo que a barra.
        */}
        {authed ? null : (
          <div className="mt-3 px-2 sm:hidden">
            <Link href="/criar-conta" className={buttonClass('primary', 'md', 'w-full')}>
              Criar a minha primeira arte
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
