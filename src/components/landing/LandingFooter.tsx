import Link from 'next/link';
import { APP } from '@/config/app';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/utils/cn';
import type { AnchorLink } from './LandingHeader';
import { StartLink } from './SessionLinks';
import { Container, Hairline, LinkArrow, textLinkClass } from './ui';

/**
 * Rodapé: a assinatura, as secções, o acesso à conta e a marca em grande.
 *
 * Sem redes sociais, moradas nem selos — nada disso existe ainda, e um
 * rodapé com ligações inventadas é pior do que um rodapé curto.
 *
 * Por baixo, o logótipo da largura da página, quase apagado, a desvanecer
 * para o fundo: fecha a página com a marca, sem gritar (o néon cheio é só
 * para botões e indicações pequenas — aqui vai a cinzento).
 *
 * O ano é calculado quando a página é gerada (a página é estática): fica
 * certo a cada publicação do site, sem ninguém se lembrar de o mudar.
 */
export function LandingFooter({ links }: { links: AnchorLink[] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden pt-16 sm:pt-20">
      <Hairline className="absolute inset-x-0 top-0" />
      <Container>
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[minmax(0,1fr)_auto] md:gap-16">
          <div className="max-w-[24rem]">
            <Logo variant="wordmark" height={26} />
            <p className="mt-5 text-[14.5px] leading-relaxed text-fg-muted">{APP.description}</p>
            <StartLink className={cn(textLinkClass, 'mt-7')}>
              Criar a minha primeira arte
              <LinkArrow />
            </StartLink>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:gap-20">
            <nav aria-label="Secções da página (rodapé)">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-faint">Página</p>
              <ul className="mt-4 flex flex-col gap-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="text-[14px] text-fg-muted transition-colors hover:text-fg">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Conta">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-faint">Conta</p>
              <ul className="mt-4 flex flex-col gap-2.5">
                <li>
                  <Link href="/entrar" className="text-[14px] text-fg-muted transition-colors hover:text-fg">
                    Entrar
                  </Link>
                </li>
                <li>
                  <Link href="/criar-conta" className="text-[14px] text-fg-muted transition-colors hover:text-fg">
                    Criar conta
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </Container>

      {/* A marca em grande. Decorativa: o nome já está no logótipo de cima e na linha de baixo. */}
      <Container className="mt-16 sm:mt-20">
        <div aria-hidden className="lp-footer-mark">
          <img
            src={APP.logo.wordmark}
            alt=""
            width={1300}
            height={473}
            draggable={false}
            className="block h-auto w-full select-none opacity-[0.09] grayscale"
          />
        </div>
      </Container>

      <Container>
        <div className="flex flex-col gap-2 border-t border-line py-6 text-[12.5px] text-fg-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {APP.name}
          </p>
          <p>Artes à altura da tua marca.</p>
        </div>
      </Container>
    </footer>
  );
}
