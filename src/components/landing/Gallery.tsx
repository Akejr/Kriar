import { ArrowDown, MessageSquareText } from 'lucide-react';
import { getFormat, getStyle } from '@/lib/domain/catalog';
import { keepTogether, type DemoEntry, type DemoMode } from '@/lib/landing/demos';
import { DemoArt } from './DemoArt';
import { ScrollRegion } from './ScrollRegion';
import { Container, SectionHeading, reveal } from './ui';

/**
 * Galeria "pedido → resultado".
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Cada cartão mostra as duas metades da promessa: o que a empresa escreveu,
 * palavra por palavra, e a arte que a Kriar devolveu. Sem virar cartões nem
 * esconder nada atrás de um passar de rato — no telemóvel não há rato, e o
 * pedido é precisamente a parte que convence ("eu também sei escrever
 * isto").
 *
 * Em ecrãs estreitos os cartões deslizam para o lado; seis cartões com uma
 * arte 4:5 em coluna davam quase quatro ecrãs de rolagem.
 *
 * Quem decide que cartões existem é `resolveDemos` (`src/lib/landing/demos.ts`):
 * em produção, só os que têm arte, e a secção inteira só com três ou mais.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function Gallery({ entries, mode }: { entries: DemoEntry[]; mode: DemoMode }) {
  if (entries.length === 0) return null;

  const allFictitious = entries.every((entry) => entry.fictitious);
  const allGenerated = entries.every((entry) => entry.image !== null);

  return (
    <section id="exemplos" aria-labelledby="exemplos-titulo" className="relative py-24 sm:py-32">
      <Container>
        <SectionHeading
          id="exemplos-titulo"
          eyebrow="Exemplos"
          title="O teu próximo anúncio pode começar assim."
          lead="Produtos, promoções, novidades ou serviços. Uma direcção visual para cada mensagem."
        />

        <ScrollRegion
          label="Exemplos de pedidos e das artes que deram"
          className="no-scrollbar -mx-5 mt-14 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 lg:gap-6"
        >
          {entries.map((entry, index) => (
            <li
              key={entry.id}
              {...reveal((index % 3) * 80)}
              className="w-[84%] shrink-0 snap-start scroll-ml-5 sm:w-auto"
            >
              <GalleryCard entry={entry} mode={mode} />
            </li>
          ))}
        </ScrollRegion>

        {/* Cada frase só aparece quando é verdade para TODOS os cartões à vista. */}
        {allFictitious || allGenerated ? (
          <p {...reveal()} className="mt-6 text-[12.5px] leading-relaxed text-fg-faint">
            {allFictitious ? 'Marcas fictícias, criadas para demonstração. ' : ''}
            {allGenerated
              ? 'Cada arte foi gerada pela Kriar a partir do pedido que está por cima dela.'
              : ''}
          </p>
        ) : null}
      </Container>
    </section>
  );
}

function GalleryCard({ entry, mode }: { entry: DemoEntry; mode: DemoMode }) {
  const style = getStyle(entry.style);
  const format = getFormat(entry.format);

  return (
    <article className="group flex h-full flex-col rounded-[22px] bg-ink-900/70 p-3 ring-1 ring-line transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:ring-line-strong">
      <header className="flex items-center justify-between gap-3 px-1.5 pb-3 pt-1.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
          {entry.sector}
        </h3>
        {entry.fictitious ? (
          <span className="text-[10.5px] text-fg-faint">Marca fictícia</span>
        ) : null}
      </header>

      {/*
        1 · O pedido, com o aspecto do campo do editor.

        Estica para ocupar a sobra do cartão: os pedidos têm comprimentos
        diferentes, e assim o marcador "Resultado" e as artes ficam à mesma
        altura em toda a linha da grelha.
      */}
      <div className="flex flex-1 flex-col rounded-[14px] bg-ink-950/70 p-3.5 ring-1 ring-line">
        <p className="flex items-center gap-1.5 text-[10.5px] font-medium text-fg-faint">
          <MessageSquareText className="size-3.5" aria-hidden />
          <span>
            Pedido de <span className="text-fg-muted">{entry.brand}</span>
          </span>
        </p>
        <p className="mt-2 text-pretty text-[14px] leading-relaxed text-fg">«{keepTogether(entry.request)}»</p>
        <p className="mt-auto flex flex-wrap gap-1.5 pt-3 text-[10.5px] text-fg-muted">
          <span className="rounded-full bg-ink-800 px-2 py-0.5 ring-1 ring-line">{style.label}</span>
          <span className="rounded-full bg-ink-800 px-2 py-0.5 ring-1 ring-line">
            {format.platform} · {format.hint}
          </span>
        </p>
      </div>

      {/* A passagem: o marcador de passo, como os números da revisão */}
      <div aria-hidden className="flex items-center gap-2 px-2 py-2.5">
        <span className="grid size-5 place-items-center rounded-full bg-neon/12 text-neon ring-1 ring-neon/35">
          <ArrowDown className="size-3" />
        </span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
          Resultado
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-line-strong to-transparent" />
      </div>

      {/* 2 · A arte */}
      <div className="overflow-hidden rounded-[14px] ring-1 ring-line">
        <DemoArt
          entry={entry}
          mode={mode}
          sizes="(min-width: 1216px) 360px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 84vw"
          className="transition-transform duration-500 group-hover:scale-[1.015]"
        />
      </div>
    </article>
  );
}
