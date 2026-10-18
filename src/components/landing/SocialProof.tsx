import type { ReactNode } from 'react';
import Image from 'next/image';
import { ArrowRight, MessageSquareText, Pencil, Sparkles } from 'lucide-react';
import { getFormat, getStyle } from '@/lib/domain/catalog';
import { TESTIMONIALS, type Testimonial } from '@/lib/landing/content';
import { keepTogether, type DemoEntry, type DemoMode } from '@/lib/landing/demos';
import { cn } from '@/lib/utils/cn';
import { DemoArt } from './DemoArt';
import { Container, DemoTag, IndexTag, SectionHeading, SectionIntro, reveal } from './ui';

/**
 * Prova social.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Com testemunhos reais (`TESTIMONIALS`, em `src/lib/landing/content.ts`):
 * as empresas, as palavras delas e as artes que fizeram.
 *
 * Sem eles — o estado actual —, a secção NÃO finge. Antes era substituída
 * por um exemplo completo de uma marca fictícia, do pedido à arte
 * (`Walkthrough`, que fica aqui); a página deixou de o mostrar (§62 do
 * DECISOES.md): a arte desse exemplo ainda é um esboço, e o caminho do
 * pedido à arte já está em "Como funciona" e em "A IA propõe. Tu decides.".
 * Hoje, sem testemunhos, a página nem desenha esta secção. Nada de
 * avaliações, números de clientes ou logótipos de empresas que não o
 * autorizaram.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function SocialProof({ walkthrough, mode }: { walkthrough: DemoEntry; mode: DemoMode }) {
  return TESTIMONIALS.length > 0 ? (
    <Testimonials items={TESTIMONIALS} />
  ) : (
    <Walkthrough entry={walkthrough} mode={mode} />
  );
}

/**
 * Com testemunhos: a abertura das outras secções e um cartão por empresa,
 * numerado como os nomes da secção da marca. A página só mostra esta secção
 * quando há testemunhos (`src/app/page.tsx`); sem eles, os exemplos ficam com
 * as artes da própria Kriar (`Showcase`).
 */
function Testimonials({ items }: { items: Testimonial[] }) {
  return (
    <section id="clientes" aria-labelledby="clientes-titulo" className="relative py-24 sm:py-32">
      <Container>
        <SectionIntro id="clientes-titulo" title={['Já faz parte da rotina', 'destas empresas.']} />
        <ul className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <li
              key={`${item.company}-${item.name}`}
              {...reveal(index * 80)}
              className="lp-edge flex flex-col rounded-[24px] bg-ink-900/60 p-6 ring-1 ring-line sm:p-7"
            >
              <IndexTag index={index + 1} className="w-fit">
                {item.company}
              </IndexTag>
              <blockquote className="mt-6 text-pretty text-[16.5px] leading-relaxed text-fg">«{item.quote}»</blockquote>
              <p className="mt-5 text-[14px] font-medium text-fg">{item.name}</p>
              <p className="text-[13px] text-fg-muted">
                {item.role ? `${item.role} · ` : ''}
                {item.company}
              </p>
              {item.arts.length > 0 ? (
                <ul className="mt-6 grid grid-cols-3 gap-2">
                  {item.arts.slice(0, 3).map((art) => (
                    <li key={art.image} className="overflow-hidden rounded-[8px] ring-1 ring-line">
                      <Image
                        src={art.image}
                        alt={art.alt}
                        width={art.width}
                        height={art.height}
                        sizes="120px"
                        className="block h-auto w-full"
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/** Do pedido à arte, numa marca fictícia, em três quadros. */
function Walkthrough({ entry, mode }: { entry: DemoEntry; mode: DemoMode }) {
  const style = getStyle(entry.style);
  const format = getFormat(entry.format);
  const review = entry.review;

  const fields = [
    review.badge ? { label: 'Etiqueta', value: review.badge } : null,
    { label: 'Título', value: review.headline },
    review.subheadline ? { label: 'Texto de apoio', value: review.subheadline } : null,
    review.price ? { label: 'Preço', value: review.price } : null,
    review.cta ? { label: 'Chamada para acção', value: review.cta } : null,
  ].filter((field): field is { label: string; value: string } => field !== null);

  return (
    <section id="demonstracao" aria-labelledby="demonstracao-titulo" className="relative py-24 sm:py-32">
      <Container>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            id="demonstracao-titulo"
            eyebrow="Na prática"
            title="Uma publicação, do pedido à arte."
            lead="Uma empresa fictícia, um pedido escrito como se fala, a revisão e a arte. É este o caminho, tal como acontece na Kriar."
          />
          <div {...reveal(160)} className="shrink-0">
            <DemoTag>Demonstração · marca fictícia</DemoTag>
          </div>
        </div>

        <ol className="mt-14 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-5">
          {/* 1 · Pedido */}
          <Panel step={1} title="O pedido" delay={0}>
            <div className="rounded-[14px] bg-ink-950/70 p-4 ring-1 ring-line">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-fg-faint">
                <MessageSquareText className="size-3.5" aria-hidden />
                {entry.brand}
              </p>
              <p className="mt-2.5 text-pretty text-[15px] leading-relaxed text-fg">«{keepTogether(entry.request)}»</p>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-[12.5px]">
              <div className="rounded-[12px] bg-ink-950/50 px-3 py-2.5 ring-1 ring-line">
                <dt className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-faint">Estilo</dt>
                <dd className="mt-1 text-fg">{style.label}</dd>
              </div>
              <div className="rounded-[12px] bg-ink-950/50 px-3 py-2.5 ring-1 ring-line">
                <dt className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-faint">Formato</dt>
                <dd className="mt-1 text-fg">{format.hint}</dd>
              </div>
            </dl>
            <p className="mt-4 text-[13px] leading-relaxed text-fg-muted">
              {review.price
                ? 'Escrito como se fala. O preço é lido do pedido e vai para o campo dele.'
                : 'Escrito como se fala, sem formulários.'}
            </p>
          </Panel>

          {/* 2 · Revisão */}
          <Panel step={2} title="A revisão" delay={90}>
            <div className="flex flex-col gap-2.5">
              {fields.map((field) => (
                <div key={field.label}>
                  <p className="mb-1 text-[11px] font-medium text-fg-muted">{field.label}</p>
                  <p className="relative flex min-h-10 items-center rounded-[10px] border border-line bg-ink-950/70 py-2 pl-3 pr-9 text-[13px] leading-snug text-fg">
                    {field.value}
                    <Pencil className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-faint" aria-hidden />
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-fg-muted">
              Os textos que vão para a arte, prontos a corrigir. Nada é gerado até confirmares.
            </p>
          </Panel>

          {/* 3 · Arte */}
          <Panel step={3} title="A arte" delay={180} accent>
            <div className="mx-auto w-full max-w-[22rem] overflow-hidden rounded-[12px] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.95)] ring-1 ring-line-strong">
              <DemoArt entry={entry} mode={mode} sizes="(min-width: 1024px) 352px, 90vw" />
            </div>
            {/* A legenda só afirma o que aconteceu: sem ficheiro, não houve geração. */}
            {entry.image ? (
              <p className="mt-4 flex items-center justify-center gap-2 text-[12.5px] text-fg-muted">
                <Sparkles className="size-3.5 text-neon" aria-hidden />
                Gerada pela Kriar a partir deste pedido e desta revisão.
              </p>
            ) : null}
          </Panel>
        </ol>
      </Container>
    </section>
  );
}

function Panel({
  step,
  title,
  delay,
  accent = false,
  children,
}: {
  step: number;
  title: string;
  delay: number;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <li
      {...reveal(delay)}
      className={cn(
        'lp-edge relative flex flex-col rounded-[22px] bg-ink-900/65 p-4 ring-1 sm:p-5',
        accent ? 'ring-neon/25' : 'ring-line',
      )}
    >
      <h3 className="mb-4 flex items-center gap-2.5 text-[14px] font-semibold text-fg">
        <span className="grid size-6 place-items-center rounded-full bg-neon/12 text-[11px] font-semibold text-neon ring-1 ring-neon/35">
          {step}
        </span>
        {title}
        {step < 3 ? (
          <ArrowRight className="ml-auto hidden size-4 text-fg-faint lg:block" aria-hidden />
        ) : null}
      </h3>
      {children}
    </li>
  );
}
