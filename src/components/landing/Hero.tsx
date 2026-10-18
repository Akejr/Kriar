import { SonarGrid } from '@/components/ui/SonarGrid';
import { HERO_ARTS } from '@/lib/landing/heroArts';
import { HeroMarquee } from './HeroMarquee';
import { HeroStart } from './HeroStart';
import { Container } from './ui';

/**
 * Primeira dobra.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O título, duas linhas curtas e uma chamada à esquerda; à direita (por
 * baixo, em ecrãs estreitos), duas faixas de artes feitas com a Kriar a
 * deslizar em sentidos opostos. Ocupa o ecrã inteiro abaixo da barra.
 *
 * Substituiu a demonstração animada em cinco passos (`HeroDemo`, que
 * continua no projecto, sem uso): o que se vê primeiro passou a ser o
 * resultado — artes —, e o processo fica para "Como funciona".
 *
 * O fundo é o de sempre: o campo de pontos verdes da plataforma, com
 * pulsos automáticos, e o véu escuro por trás do texto.
 *
 * A entrada é CSS (`lp-in`), escalonada; com menos movimento pedido, os
 * elementos aparecem logo no sítio e as faixas ficam paradas.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-titulo" className="relative isolate overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <SonarGrid
          className="size-full"
          interactive={false}
          baseOpacity={0.13}
          dotRadius={1.3}
          spacing={28}
          // Contido: as faixas já se mexem por cima, e o fundo não pode competir.
          amplitude={1.5}
          pingEvery={4.6}
          pingArea={[0.45, 0.08, 0.98, 0.9]}
        />
        <span className="lp-hero-wash absolute inset-0" />
      </div>

      <Container className="grid min-h-[calc(100dvh-4rem)] items-center gap-12 py-14 sm:py-16 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-10 lg:py-20">
        <div className="max-w-[34rem]">
          <h1
            id="hero-titulo"
            className="lp-in text-balance text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.045em] text-fg sm:text-[3.5rem] lg:text-[4rem] xl:text-[4.5rem]"
            style={{ ['--lp-delay' as string]: '60ms' }}
          >
            Artes à altura da tua marca.
          </h1>
          <div
            className="lp-in mt-6 space-y-1 text-[1.0625rem] leading-relaxed text-fg-muted sm:text-[1.125rem]"
            style={{ ['--lp-delay' as string]: '140ms' }}
          >
            <p>Uma ideia. Uma arte profissional.</p>
            <p>Com as cores, os produtos e a marca da tua empresa.</p>
          </div>
          <div className="lp-in mt-9" style={{ ['--lp-delay' as string]: '220ms' }}>
            <HeroStart />
          </div>
        </div>

        {/*
          Em ecrãs estreitos as faixas vão de aresta a aresta (`-mx-*`, as
          margens do `Container`); no largo ficam na sua coluna.
        */}
        <div
          className="lp-in relative -mx-5 min-w-0 sm:-mx-8 lg:mx-0"
          style={{ ['--lp-delay' as string]: '200ms' }}
        >
          <HeroMarquee arts={HERO_ARTS} />
        </div>
      </Container>
    </section>
  );
}
