import Image from 'next/image';
import { heroArt } from '@/lib/landing/heroArts';
import { cn } from '@/lib/utils/cn';
import { StartLink } from './SessionLinks';
import { Container, IndexTag, Lead, LinkArrow, Node, SectionIntro, reveal, textLinkClass } from './ui';

/**
 * Exemplos: uma arte desmontada e mais quatro do mesmo sistema.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * A secção da marca promete um design system feito dos dados da empresa,
 * com cinco elementos: logótipo, cores, tipografia, componentes e
 * publicações. Esta mostra-o numa marca verdadeira — a da própria Kriar,
 * nas artes que a Kriar fez para ela (as da primeira dobra,
 * `src/lib/landing/heroArts.ts`).
 *
 * Uma arte grande, com os quatro primeiros elementos assinalados como na
 * escultura (o ponto, a linha, o nome numerado); por baixo, o quinto — as
 * publicações —, quatro artes de assuntos diferentes, todas com a mesma
 * marca. Nos ecrãs estreitos não há sítio para os nomes ao lado da arte: os
 * pontos levam o número, e os nomes vão por baixo.
 *
 * Só se afirma o que se vê nas artes: as oito têm o logótipo e o verde da
 * Kriar, mas nem todas usam a mesma letra (duas têm títulos com serifa) —
 * por isso o texto fala da marca, não das "mesmas letras".
 *
 * Substituiu a identidade da Perfumaria Kianda (`Differentiation`) e o
 * exemplo do pedido à arte (`SocialProof`, sem testemunhos): as duas
 * mostravam esboços no lugar das artes, que ainda não foram geradas, e
 * repetiam o que a secção da marca e "Como funciona" já contam.
 * ──────────────────────────────────────────────────────────────────────────
 */

const FEATURED = heroArt('arte7');
/** Assuntos diferentes de propósito: um jogo, um lançamento, uma ilustração, uma data. */
const MORE = ['arte1', 'arte3', 'arte6', 'arte8'].map(heroArt);

/*
  A arte grande nos ecrãs largos: 416 × 520 px (4:5, a proporção dela). As
  linhas medem-se nesta escala; abaixo de 1024 px a composição é outra.
*/
const W = 416;
const H = 520;
/** Distância da arte ao nome. */
const GAP = 64;

type Callout = {
  label: string;
  /** O ponto, em fracções da arte (conferido a olho sobre a imagem). */
  u: number;
  v: number;
  /** De que lado fica o nome, e a que altura (fracção da arte). */
  side: 'esquerda' | 'direita';
  y: number;
};

/*
  Os pontos ficam ENCOSTADOS ao que assinalam, sem lhe tapar as letras: em
  cima do "K" ou do "r" de "lugar", escondiam metade da palavra que apontam.
*/
const CALLOUTS: Callout[] = [
  // Logo à esquerda do "K" do logótipo.
  { label: 'Logótipo', u: 0.045, v: 0.092, side: 'esquerda', y: 0.05 },
  // Logo depois do ponto final de "Um só lugar.", a néon.
  { label: 'Cores', u: 0.567, v: 0.255, side: 'direita', y: 0.255 },
  // Logo à esquerda do "T" de "Todas as tuas ideias."
  { label: 'Tipografia', u: 0.045, v: 0.188, side: 'esquerda', y: 0.4 },
  // Na aresta direita do cartão do café.
  { label: 'Componentes', u: 0.945, v: 0.62, side: 'direita', y: 0.72 },
];

/** A linha do ponto ao nome: onde começa, o comprimento e o ângulo. */
function lineFor(callout: Callout) {
  const ax = callout.u * W;
  const ay = callout.v * H;
  const lx = callout.side === 'esquerda' ? -GAP : W + GAP;
  const ly = callout.y * H;
  return {
    ax,
    ay,
    length: Math.hypot(lx - ax, ly - ay),
    angle: Math.atan2(ly - ay, lx - ax),
  };
}

export function Showcase() {
  return (
    <section id="exemplos" aria-labelledby="exemplos-titulo" className="relative overflow-hidden py-24 sm:py-32">
      <Container>
        <SectionIntro id="exemplos-titulo" stacked title={['Todas diferentes.', 'Todas da mesma marca.']}>
          <Lead>
            Estas artes foram feitas com a Kriar, para a própria Kriar. Na de cima, os elementos do
            sistema da marca; nas de baixo, o mesmo sistema, com assuntos diferentes.
          </Lead>
          <StartLink className={cn(textLinkClass, 'mt-6')}>
            Criar a minha primeira arte
            <LinkArrow />
          </StartLink>
        </SectionIntro>

        <figure {...reveal(80)} className="relative mx-auto mt-16 w-full max-w-[26rem] sm:mt-20 lg:w-[416px] lg:max-w-none">
          <span aria-hidden className="lp-soft-glow pointer-events-none absolute -inset-24 -z-10" />
          <div className="overflow-hidden rounded-[16px] shadow-[0_60px_120px_-50px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.08]">
            <Image
              src={FEATURED.src}
              alt={FEATURED.alt}
              sizes="(min-width: 480px) 416px, 92vw"
              placeholder="blur"
              className="block h-auto w-full"
            />
          </div>

          {/* Ecrãs largos: o ponto, a linha e o nome ao lado, como na escultura. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 max-lg:hidden">
            {CALLOUTS.map((callout, index) => {
              const line = lineFor(callout);
              return (
                <div
                  key={callout.label}
                  className="lp-sc-callout"
                  style={{ ['--lp-sc-delay' as string]: `${500 + index * 160}ms` }}
                >
                  <span
                    className="lp-sc-line"
                    style={{
                      left: line.ax,
                      top: line.ay,
                      width: line.length,
                      transform: `rotate(${line.angle.toFixed(4)}rad)`,
                    }}
                  />
                  <span className="absolute" style={{ left: line.ax - 7, top: line.ay - 7 }}>
                    <Node delay={index * 0.45} />
                  </span>
                  {/* À esquerda, o nome acaba onde a linha começa; à direita, começa aí. */}
                  <span
                    className="absolute -translate-y-1/2"
                    style={
                      callout.side === 'esquerda'
                        ? { right: W + GAP, top: callout.y * H }
                        : { left: W + GAP, top: callout.y * H }
                    }
                  >
                    <IndexTag index={index + 1}>{callout.label}</IndexTag>
                  </span>
                </div>
              );
            })}
          </div>

          {/* Ecrãs estreitos: o número no ponto, por cima da arte. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 lg:hidden">
            {CALLOUTS.map((callout, index) => (
              <span
                key={callout.label}
                className="lp-marker absolute"
                style={{ left: `${callout.u * 100}%`, top: `${callout.v * 100}%` }}
              >
                {index + 1}
              </span>
            ))}
          </div>

          <figcaption className="sr-only">
            Os pontos assinalam, nesta arte, os elementos do sistema da marca Kriar: o logótipo, as
            cores, a tipografia e os componentes.
          </figcaption>
        </figure>

        {/* Os nomes dos pontos, por baixo da arte, nos ecrãs estreitos. */}
        <ul aria-hidden className="mx-auto mt-6 flex max-w-[26rem] flex-wrap gap-2 lg:hidden">
          {CALLOUTS.map((callout, index) => (
            <li key={callout.label}>
              <IndexTag index={index + 1}>{callout.label}</IndexTag>
            </li>
          ))}
        </ul>

        <div {...reveal()} className="mt-20 flex items-center gap-4 sm:mt-24">
          <IndexTag index={5}>Publicações</IndexTag>
          <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-line-strong to-transparent" />
        </div>

        {/* A segunda e a quarta descem um pouco: lê-se como uma série, não como uma grelha. */}
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5 lg:pb-8">
          {MORE.map((art, index) => (
            <li key={art.id} {...reveal(index * 80)} className={cn('min-w-0', index % 2 === 1 && 'lg:translate-y-8')}>
              <div className="lp-work relative aspect-[4/5] overflow-hidden rounded-[14px] bg-ink-900 ring-1 ring-white/[0.06]">
                <Image
                  src={art.src}
                  alt={art.alt}
                  fill
                  sizes="(min-width: 1280px) 290px, (min-width: 1024px) 23vw, 46vw"
                  placeholder="blur"
                  className="object-cover"
                />
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
