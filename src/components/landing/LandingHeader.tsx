import Link from 'next/link';
import { APP } from '@/config/app';
import { Logo } from '@/components/ui/Logo';
import { HeaderActions, MobileMenu } from './SessionLinks';

export type AnchorLink = { href: string; label: string };

/**
 * Barra do topo da página pública.
 *
 * Fixa ao rolar, translúcida, com a linha de luz por baixo que a barra da
 * aplicação também usa. As ligações às secções são âncoras simples (`<a>`):
 * não há mudança de rota, e o deslizar suave vem do CSS.
 */
export function LandingHeader({ links }: { links: AnchorLink[] }) {
  return (
    <header className="sticky top-0 z-50">
      <div className="relative bg-ink-950/75 backdrop-blur-md backdrop-saturate-150">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-line-strong to-transparent"
        />
        <div className="relative mx-auto flex h-16 w-full max-w-[76rem] items-center gap-6 px-5 sm:px-8">
          <Link href="/" aria-label={`${APP.name} — página inicial`} className="flex shrink-0 items-center rounded-md py-1">
            <Logo variant="wordmark" height={22} />
          </Link>

          {/* Só a partir de 1024 px; abaixo disso as secções estão no menu (`MobileMenu`). */}
          <nav aria-label="Secções da página" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="whitespace-nowrap rounded-[8px] px-3 py-2 text-[13.5px] text-fg-muted transition-colors hover:bg-ink-800/70 hover:text-fg"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <HeaderActions />
            <MobileMenu links={links} />
          </div>
        </div>
      </div>
    </header>
  );
}
