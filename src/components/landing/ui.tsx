import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Peças partilhadas pelas secções da página pública.
 *
 * Os botões aqui são LIGAÇÕES com o aspecto dos botões da aplicação
 * (`Button` em `src/components/ui/primitives.tsx`). O primitivo é um
 * `<button>`, e numa página de apresentação quase todas as acções levam a
 * outra página — um botão dentro de uma ligação não é HTML válido. As
 * classes repetem as do primitivo para as duas coisas se lerem iguais.
 */

type Variant = 'primary' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg' | 'pill' | 'xl';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-neon font-semibold text-ink-950 hover:bg-neon-700 active:scale-[0.985]',
  outline:
    'border border-line-strong bg-ink-950/40 font-medium text-fg hover:border-neon/50 hover:bg-neon/6 hover:text-neon',
  ghost: 'font-medium text-fg-muted hover:bg-ink-800 hover:text-fg',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 gap-1.5 rounded-[10px] px-3.5 text-[13px]',
  md: 'h-10 gap-2 rounded-[10px] px-4 text-sm',
  /** As duas chamadas da primeira dobra. */
  lg: 'h-[3.25rem] gap-2 rounded-[12px] px-6 text-[15.5px]',
  /** A chamada da primeira dobra, em pílula. */
  pill: 'h-[3.25rem] gap-2 rounded-full px-8 text-[15.5px]',
  /** A última chamada, a maior da página. */
  xl: 'h-14 gap-2 rounded-[12px] px-7 text-[16px]',
};

/**
 * As classes de um botão-ligação.
 *
 * `className` só ACRESCENTA. O `cn` do projecto junta classes sem resolver
 * conflitos (não há `tailwind-merge`), e quando duas classes simples
 * disputam a mesma propriedade quem ganha não é a última escrita: é a que
 * vem depois no CSS gerado, e o Tailwind 4 desempata por ordem alfabética.
 * Foi assim que um `hidden` passado aqui perdeu para o `inline-flex` de
 * baixo — `.inline-flex` vem depois de `.hidden` — e o botão da barra nunca
 * se escondeu nos telemóveis, empurrando a barra para fora do ecrã. Pela
 * mesma razão, um `text-[15.5px]` perdia para o `text-[15px]` do tamanho.
 *
 * Por isso: outro tamanho é um tamanho novo em `SIZES`, e o que só vale
 * nalgumas larguras vai com variante (`max-sm:hidden`, `max-sm:w-full`). As
 * classes com variante vêm sempre depois das simples, e ganham.
 */
export function buttonClass(variant: Variant, size: Size = 'md', className?: string): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all duration-200',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

/** Largura máxima e margens laterais, iguais em todas as secções. */
export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[76rem] px-5 sm:px-8', className)}>{children}</div>;
}

/**
 * Atributos de entrada suave ao rolar.
 *
 * O `LandingMotion` só esconde os elementos marcados quando o JavaScript
 * corre e o sistema não pede menos movimento; sem isso, tudo aparece logo.
 */
export function reveal(delayMs = 0): { 'data-reveal': ''; style?: React.CSSProperties } {
  return delayMs > 0
    ? { 'data-reveal': '', style: { ['--lp-delay' as string]: `${delayMs}ms` } }
    : { 'data-reveal': '' };
}

/** A etiqueta pequena por cima dos títulos, com o mesmo traço do painel da aplicação. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-muted',
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-neon shadow-[0_0_10px_rgba(191,248,57,0.6)]" />
      {children}
    </p>
  );
}

/** Título de secção: etiqueta, h2 e texto de abertura. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
  align = 'left',
  className,
  titleClassName,
}: {
  id: string;
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-5', align === 'center' && 'items-center text-center', className)}>
      {eyebrow ? (
        <div {...reveal()}>
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
      ) : null}
      <h2
        id={id}
        {...reveal(60)}
        className={cn(
          'max-w-[46rem] text-balance text-[2rem] font-semibold leading-[1.06] tracking-[-0.035em] text-fg sm:text-[2.5rem] lg:text-[3rem]',
          titleClassName,
        )}
      >
        {title}
      </h2>
      {lead ? (
        <p
          {...reveal(120)}
          className={cn(
            'max-w-[40rem] text-pretty text-[1.0625rem] leading-relaxed text-fg-muted sm:text-[1.125rem]',
            align === 'center' && 'mx-auto',
          )}
        >
          {lead}
        </p>
      ) : null}
    </div>
  );
}

/** Etiqueta "Demonstração · marca fictícia" e semelhantes. */
export function DemoTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-ink-900/90 px-2.5 py-1 text-[10.5px] font-medium tracking-wide text-fg-muted backdrop-blur-sm',
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-neon" />
      {children}
    </span>
  );
}

// --- A linguagem das duas primeiras secções ---------------------------------------
//
// A primeira dobra e a secção da marca acertaram o tom da página: títulos
// grandes em duas frases, a segunda a néon; o texto curto à direita, alinhado
// pelo fundo do título; nomes numerados em pílula ("01 LOGÓTIPO"); pontos
// assinalados a pulsar; e nenhuma etiqueta por cima dos títulos. As peças
// abaixo levam essa linguagem às outras secções, para a página se ler como
// uma só.

/**
 * O título de uma secção: duas frases, uma por linha, a segunda a néon.
 *
 * O tamanho é o da secção da marca, medido pela largura do ecrã em vez da
 * secção (lá a secção tem altura fixa e o título mede-se por ela).
 */
export function SectionTitle({
  id,
  lines,
  className,
}: {
  id: string;
  lines: readonly [React.ReactNode, React.ReactNode];
  className?: string;
}) {
  return (
    <h2
      id={id}
      className={cn(
        'text-balance text-[clamp(2.25rem,5.2vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.045em] text-fg',
        className,
      )}
    >
      <span className="block">{lines[0]}</span>
      <span className="block text-neon">{lines[1]}</span>
    </h2>
  );
}

/**
 * A abertura de uma secção, como a da secção da marca: o título à esquerda
 * e o texto à direita, alinhados pelo fundo. Nos ecrãs estreitos, o texto
 * vai por baixo.
 *
 * `stacked`, para os títulos compridos: o título ocupa a linha inteira e o
 * texto fica por baixo, à direita. Na coluna da esquerda, "Uma presença
 * profissional. / Um custo que consegues planear." partia-se em quatro
 * linhas; assim fica nas duas frases que é.
 */
export function SectionIntro({
  id,
  title,
  children,
  stacked = false,
  className,
}: {
  id: string;
  title: readonly [React.ReactNode, React.ReactNode];
  children?: React.ReactNode;
  stacked?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 items-end gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]',
        stacked ? 'lg:gap-x-14 lg:gap-y-9' : 'lg:gap-14',
        className,
      )}
    >
      <div {...reveal()} className={cn('min-w-0', stacked && 'lg:col-span-2')}>
        <SectionTitle id={id} lines={title} />
      </div>
      {children ? (
        <div
          {...reveal(100)}
          className={cn('max-w-[28rem] lg:justify-self-end lg:pb-1', stacked && 'lg:col-start-2')}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** O texto corrido de uma abertura. */
export function Lead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-pretty text-[1rem] leading-relaxed text-fg-muted sm:text-[1.0625rem]', className)}>
      {children}
    </p>
  );
}

/** A ligação sublinhada com seta, a de "Ver como funciona". */
export const textLinkClass =
  'group inline-flex items-center gap-2 border-b border-line-strong pb-1 text-[14.5px] font-medium text-fg transition-colors hover:border-neon/60 hover:text-neon';

/** A seta das ligações sublinhadas; anda um pouco ao passar por cima. */
export function LinkArrow() {
  return (
    <ArrowRight
      className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
      aria-hidden
    />
  );
}

/** Uma ligação sublinhada para uma secção da página. */
export function TextLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} className={cn(textLinkClass, className)}>
      {children}
      <LinkArrow />
    </a>
  );
}

/** O nome numerado da secção da marca: "01 LOGÓTIPO", com o número a néon. */
export function IndexTag({
  index,
  children,
  className,
}: {
  index: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('lp-tag', className)}>
      <b>{String(index).padStart(2, '0')}</b>
      {children}
    </span>
  );
}

/** A indicação pequena com o ponto a pulsar ("Passa o cursor pelos dados"). */
export function Hint({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('lp-hint', className)}>{children}</p>;
}

/** O ponto assinalado: o anel a néon, com a onda a sair dele. */
export function Node({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <span
      aria-hidden
      className={cn('lp-node', className)}
      style={delay ? { ['--lp-node-delay' as string]: `${delay}s` } : undefined}
    />
  );
}

/** Linha fina entre secções, a mesma da barra do topo da aplicação. */
export function Hairline({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none block h-px w-full bg-gradient-to-r from-transparent via-line-strong to-transparent',
        className,
      )}
    />
  );
}
