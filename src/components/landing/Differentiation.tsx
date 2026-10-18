import type { ReactNode } from 'react';
import { MessageSquareText, Package, Palette, Shapes } from 'lucide-react';
import { DEMO_BRAND } from '@/lib/landing/content';
import { keepTogether, type DemoEntry, type DemoMode } from '@/lib/landing/demos';
import { cn } from '@/lib/utils/cn';
import { DemoArt } from './DemoArt';
import { KIANDA_SWATCHES, KiandaLogo, Swatch } from './KiandaArt';
import { Container, DemoTag, SectionHeading, reveal } from './ui';

/**
 * Diferenciação: a identidade da empresa em todas as artes.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * A prova é visual: três publicações da MESMA empresa, com assuntos
 * diferentes (um lançamento, uma promoção, um serviço) e a mesma marca. Por
 * baixo, a ficha da identidade que as três partilham — o logótipo, as três
 * cores e as duas fontes que a conta de demonstração guarda.
 *
 * Sem as três artes (em produção, antes de o dono as gerar), fica só a
 * ficha, na versão inteira (`BrandSheet`): é material verdadeiro da marca,
 * não um resultado.
 * ──────────────────────────────────────────────────────────────────────────
 */
const BENEFITS = [
  { icon: Palette, title: 'As tuas cores', text: 'Uma comunicação visual consistente.' },
  { icon: Package, title: 'Os teus produtos', text: 'Protagonismo para aquilo que vendes.' },
  { icon: MessageSquareText, title: 'A tua mensagem', text: 'Textos que podes rever e ajustar.' },
  { icon: Shapes, title: 'A tua escolha', text: 'Diferentes estilos para diferentes momentos.' },
] as const;

/** O que cada uma das três artes anuncia, em duas palavras. */
const SUBJECTS: Record<string, string> = {
  'beleza-kianda-lancamento': 'Lançamento',
  'beleza-kianda-fim-de-semana': 'Promoção',
  'beleza-kianda-entrega': 'Serviço',
};

export function Differentiation({ trio, mode }: { trio: DemoEntry[]; mode: DemoMode }) {
  return (
    <section aria-labelledby="identidade-titulo" className="relative overflow-hidden py-24 sm:py-32">
      <Container>
        <SectionHeading
          id="identidade-titulo"
          eyebrow="Identidade"
          title={
            // Uma frase por linha: corrida, a 1440 px deixava o "As" sozinho no fim da primeira.
            <>
              <span className="block">A tua marca tem identidade.</span>{' '}
              <span className="block">As tuas artes também devem ter.</span>
            </>
          }
          lead="A Kriar combina o teu pedido, a identidade da empresa e referências de direcção artística para propor uma publicação adequada à tua mensagem."
        />

        <div className="mt-14 grid items-center gap-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-16">
          <ul className="grid gap-x-6 gap-y-7 sm:grid-cols-2 lg:grid-cols-1 lg:gap-y-0 lg:divide-y lg:divide-line">
            {BENEFITS.map((benefit, index) => (
              <li key={benefit.title} {...reveal(index * 70)} className="flex gap-4 lg:py-6 lg:first:pt-0 lg:last:pb-0">
                <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-ink-800 text-fg-muted ring-1 ring-line">
                  <benefit.icon className="size-[1.1rem]" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[16px] font-semibold text-fg">{benefit.title}</h3>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-fg-muted">{benefit.text}</p>
                </div>
              </li>
            ))}
          </ul>

          <div {...reveal(80)} className="relative">
            <span aria-hidden className="lp-soft-glow pointer-events-none absolute -inset-10 -z-10" />

            {trio.length === 3 ? (
              <figure>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <figcaption className="text-[13px] text-fg-muted">
                    Três publicações da <span className="text-fg">{DEMO_BRAND.name}</span>, a mesma
                    identidade.
                  </figcaption>
                  <DemoTag>Demonstração · marca fictícia</DemoTag>
                </div>
                {/* A do meio sobe um pouco: o desnível lê-se como "série", não como grelha. */}
                <ul className="grid grid-cols-3 items-start gap-2.5 sm:gap-4 sm:pt-6">
                  {trio.map((entry, index) => (
                    <li key={entry.id} className={cn('min-w-0', index === 1 && 'sm:-translate-y-6')}>
                      <div className="overflow-hidden rounded-[12px] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.95)] ring-1 ring-line-strong">
                        <DemoArt
                          entry={entry}
                          mode={mode}
                          sizes="(min-width: 1024px) 230px, 30vw"
                        />
                      </div>
                      {/* Mais pequena nos telemóveis: a 320 px "LANÇAMENTO" não cabia nos 87 px da coluna. */}
                      <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted max-sm:text-[10px] max-sm:tracking-[0.1em]">
                        {SUBJECTS[entry.id] ?? entry.sector}
                      </p>
                      <p className="mt-1 line-clamp-3 text-[12px] leading-snug text-fg-faint">
                        «{keepTogether(entry.request)}»
                      </p>
                    </li>
                  ))}
                </ul>
              </figure>
            ) : null}

            {trio.length === 3 ? <IdentityCard className="mt-6" /> : <BrandSheet />}
          </div>
        </div>
      </Container>
    </section>
  );
}

const SWATCH_NAMES = ['Principal', 'Secundária', 'Terceira'];

/**
 * A ficha inteira, para quando o trio não aparece (em produção, antes de o
 * dono gerar as três artes).
 *
 * O cartão compacto, sozinho ao lado das quatro vantagens, deixava a coluna
 * vazia: 120 px de cartão ao meio de 360 px de lista. Aqui a coluna enche-se
 * com o mesmo material verdadeiro, mais à larga — o logótipo, as três cores
 * com o nome e o código, as duas fontes a mostrarem-se. Nada que a Kriar não
 * guarde da empresa; os produtos ficam de fora porque entram em cada pedido,
 * não na marca.
 */
function BrandSheet() {
  return (
    <figure className="lp-edge relative overflow-hidden rounded-[22px] bg-ink-900/75 ring-1 ring-line">
      <figcaption className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5 sm:px-6">
        <span className="min-w-0">
          <span className="block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
            Ficha da marca
          </span>
          <span className="mt-1.5 block text-[1.125rem] font-semibold tracking-tight text-fg">{DEMO_BRAND.name}</span>
        </span>
        <DemoTag>Demonstração · marca fictícia</DemoTag>
      </figcaption>

      <div className="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="border-b border-line p-5 sm:border-b-0 sm:border-r sm:px-6">
          <SheetLabel>Logótipo</SheetLabel>
          <span className="mt-3 grid h-24 w-48 max-w-full place-items-center rounded-[14px] bg-[#F4F2EE] px-5 ring-1 ring-line">
            <KiandaLogo className="h-11 w-auto" />
          </span>
        </div>
        <div className="p-5 sm:px-6">
          <SheetLabel>Cores</SheetLabel>
          <ul className="mt-3 flex flex-col gap-2.5">
            {KIANDA_SWATCHES.map((color, index) => (
              <li key={color} className="flex items-center gap-3">
                <Swatch color={color} className="size-7 shrink-0" />
                <span className="text-[13.5px] text-fg">{SWATCH_NAMES[index]}</span>
                <span className="ml-auto font-mono text-[11.5px] uppercase tracking-wide text-fg-faint">{color}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 border-t border-line sm:grid-cols-2">
        <FontSpecimen
          family="var(--font-brand-playfair), serif"
          name={DEMO_BRAND.fonts.display}
          role="Títulos"
          className="border-b border-line sm:border-b-0 sm:border-r"
        />
        <FontSpecimen family="var(--font-brand-inter), sans-serif" name={DEMO_BRAND.fonts.body} role="Textos" />
      </div>
    </figure>
  );
}

function SheetLabel({ children }: { children: ReactNode }) {
  return <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-fg-faint">{children}</p>;
}

function FontSpecimen({
  family,
  name,
  role,
  className,
}: {
  family: string;
  name: string;
  role: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-4 p-5 sm:px-6', className)}>
      <span aria-hidden className="text-[2.25rem] leading-none text-fg" style={{ fontFamily: family }}>
        Aa
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-fg">{name}</span>
        <span className="mt-0.5 block text-[12px] text-fg-muted">{role}</span>
      </span>
    </div>
  );
}

/** A ficha da identidade: o que a Kriar guarda da empresa e aplica em cada arte. */
function IdentityCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'lp-edge grid gap-5 rounded-[20px] bg-ink-900/75 p-5 ring-1 ring-line sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-6',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-14 w-[5.5rem] shrink-0 place-items-center rounded-[12px] bg-[#F4F2EE] px-2 ring-1 ring-line">
          <KiandaLogo className="h-7 w-auto" />
        </span>
        <div className="sm:hidden">
          <p className="text-[13px] font-medium text-fg">{DEMO_BRAND.name}</p>
          <p className="text-[11.5px] text-fg-faint">Marca fictícia de demonstração</p>
        </div>
      </div>

      <div className="min-w-0">
        <p className="hidden text-[13px] font-medium text-fg sm:block">{DEMO_BRAND.name}</p>
        <ul className="mt-0 flex flex-wrap gap-x-4 gap-y-2 sm:mt-2">
          {KIANDA_SWATCHES.map((color, index) => (
            <li key={color} className="flex items-center gap-2">
              <Swatch color={color} className="size-5" />
              <span className="text-[11.5px] text-fg-muted">
                {SWATCH_NAMES[index]}{' '}
                <span className="font-mono text-[10.5px] uppercase text-fg-faint">{color}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
        <span
          className="text-[1.75rem] leading-none text-fg"
          style={{ fontFamily: 'var(--font-brand-playfair), serif' }}
        >
          Aa
        </span>
        <span className="text-[11.5px] text-fg-muted">
          {DEMO_BRAND.fonts.display} · {DEMO_BRAND.fonts.body}
        </span>
      </div>
    </div>
  );
}
