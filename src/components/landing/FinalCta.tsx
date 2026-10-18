import { SonarGrid } from '@/components/ui/SonarGrid';
import { HeroStart } from './HeroStart';
import { Container, Lead, reveal } from './ui';

/**
 * Última chamada: a página acaba como começou.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O campo de pontos verdes da primeira dobra, com os pulsos, a encher a
 * secção; o título grande ao centro, em duas frases, a segunda a néon; e a
 * mesma chamada em pílula, com as letras a baralhar (`HeroStart`). Aqui o
 * campo também responde ao toque: um clique em qualquer sítio solta um anel.
 *
 * Saiu a arte ao lado do botão. Era um esboço com "Arte por gerar" até o
 * dono a gerar, e em produção a secção ficava sem ela — a última imagem da
 * página era um lugar vazio. As artes verdadeiras estão em cima, na
 * primeira dobra e nos exemplos.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function FinalCta() {
  return (
    <section aria-labelledby="ultima-titulo" className="relative">
      <SonarGrid
        className="min-h-[clamp(34rem,88svh,50rem)]"
        spacing={28}
        dotRadius={1.3}
        baseOpacity={0.12}
        amplitude={1.6}
        pingEvery={3.8}
        pingArea={[0.12, 0.15, 0.88, 0.85]}
      >
        <span aria-hidden className="lp-final-wash pointer-events-none absolute inset-0" />
        <Container className="relative flex min-h-[clamp(34rem,88svh,50rem)] flex-col items-center justify-center py-24 text-center">
          <h2
            id="ultima-titulo"
            {...reveal()}
            className="text-balance text-[clamp(2.5rem,6.4vw,5.75rem)] font-semibold leading-[0.98] tracking-[-0.05em] text-fg"
          >
            <span className="block">A próxima publicação</span>
            <span className="block text-neon">começa com uma ideia.</span>
          </h2>
          <div {...reveal(80)}>
            <Lead className="mx-auto mt-7 max-w-[30rem]">
              Adiciona a tua marca, conta o que queres comunicar e começa a criar.
            </Lead>
          </div>
          <div {...reveal(160)} className="mt-10">
            <HeroStart />
          </div>
        </Container>
      </SonarGrid>
    </section>
  );
}
