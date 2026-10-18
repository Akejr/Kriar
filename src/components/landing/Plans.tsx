import { Check, Sparkles } from 'lucide-react';
import { PLAN_RULES, PLANS, type Plan } from '@/config/plans';
import { FORMATS } from '@/lib/domain/catalog';
import type { FormatId } from '@/lib/domain/types';
import { cn } from '@/lib/utils/cn';
import { formatKz } from '@/lib/utils/money';
import { SectionField } from './SectionField';
import { StartLink } from './SessionLinks';
import { Container, Hint, IndexTag, Lead, SectionIntro, buttonClass, reveal } from './ui';

/**
 * Planos, a partir de `src/config/plans.ts`.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Com planos configurados: um cartão por plano, com o preço em kwanzas, o
 * que inclui e as regras gerais por baixo. O destaque, quando existe, diz
 * PARA QUEM é o plano — nunca "Mais popular".
 *
 * Sem planos (o estado actual): um bloco honesto. Diz que os planos em
 * kwanzas são anunciados em breve e mostra apenas o que já é verdade sobre
 * uma geração hoje — quatro factos numerados e os seis formatos, desenhados
 * na proporção verdadeira, como na planta da revisão. Não há preços,
 * quantidades nem formas de pagamento inventados para encher o espaço.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function Plans() {
  return (
    <section id="planos" aria-labelledby="planos-titulo" className="relative isolate py-24 sm:py-32">
      {/* O campo de pontos da primeira dobra, secção sim, secção não. */}
      <SectionField pingArea={[0.5, 0.06, 0.95, 0.4]} />
      <Container>
        <SectionIntro
          id="planos-titulo"
          stacked
          title={['Uma presença profissional.', 'Um custo que consegues planear.']}
        >
          <Lead>Cria as publicações do dia a dia sem contratar uma equipa inteira para começar.</Lead>
        </SectionIntro>

        <div {...reveal(120)} className="mt-14 sm:mt-16">
          {PLANS.length > 0 ? <PlanCards plans={PLANS} /> : <PlansPending />}
        </div>
      </Container>
    </section>
  );
}

// --- Com planos ---------------------------------------------------------------

function PlanCards({ plans }: { plans: Plan[] }) {
  const rules = [
    PLAN_RULES.retries ? { title: 'Repetições e correcções', text: PLAN_RULES.retries } : null,
    PLAN_RULES.limitReached ? { title: 'Quando chegas ao limite', text: PLAN_RULES.limitReached } : null,
  ].filter((rule): rule is { title: string; text: string } => rule !== null);

  return (
    <>
      <ul
        className={cn(
          'grid gap-5',
          plans.length === 2 ? 'md:grid-cols-2' : plans.length >= 3 ? 'md:grid-cols-2 lg:grid-cols-3' : '',
        )}
      >
        {plans.map((plan, index) => (
          <li
            key={plan.id}
            className={cn(
              'lp-edge relative flex flex-col rounded-[24px] bg-ink-900/60 p-6 ring-1 sm:p-7',
              plan.recommended ? 'ring-neon/45' : 'ring-line',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <IndexTag index={index + 1}>{plan.name}</IndexTag>
              {plan.recommended && plan.recommendedReason ? (
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-neon">
                  <Sparkles className="size-3" aria-hidden />
                  {plan.recommendedReason}
                </span>
              ) : null}
            </div>
            <h3 className="sr-only">{plan.name}</h3>
            <p className="mt-5 text-[14.5px] leading-relaxed text-fg-muted">{plan.audience}</p>

            <p className="mt-7 flex items-baseline gap-1.5">
              {plan.priceKz === null ? (
                <span className="text-[1.5rem] font-semibold tracking-[-0.02em] text-fg">Preço por anunciar</span>
              ) : (
                <>
                  <span className="text-[2.75rem] font-semibold leading-none tracking-[-0.04em] text-fg tabular-nums">
                    {formatKz(plan.priceKz)}
                  </span>
                  <span className="text-[14px] text-fg-muted">/ {plan.period}</span>
                </>
              )}
            </p>

            <ul className="mt-7 flex flex-col gap-3 border-t border-line pt-6 text-[14px] text-fg-muted">
              {[
                plan.generations === null
                  ? null
                  : `${plan.generations} ${plan.generations === 1 ? 'geração' : 'gerações'} por ${plan.period}`,
                plan.brands === null
                  ? null
                  : `${plan.brands} ${plan.brands === 1 ? 'empresa' : 'empresas'} na conta`,
                plan.formats,
                plan.exportQuality,
              ]
                .filter((line): line is string => Boolean(line))
                .map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-neon" aria-hidden />
                    {line}
                  </li>
                ))}
            </ul>

            <div className="mt-auto pt-8">
              <StartLink
                className={buttonClass(plan.recommended ? 'primary' : 'outline', 'md', 'w-full')}
              >
                Criar a minha primeira arte
              </StartLink>
            </div>
          </li>
        ))}
      </ul>

      {rules.length > 0 || PLAN_RULES.contact ? (
        <div className="mt-6 grid gap-x-10 gap-y-6 border-t border-line pt-6 md:grid-cols-2">
          {rules.map((rule) => (
            <div key={rule.title}>
              <h3 className="text-[14px] font-semibold text-fg">{rule.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-fg-muted">{rule.text}</p>
            </div>
          ))}
          {PLAN_RULES.contact ? (
            <p className="text-[14px] leading-relaxed text-fg-muted md:col-span-2">{PLAN_RULES.contact}</p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

// --- Sem planos ---------------------------------------------------------------

/** O que é verdade hoje sobre uma geração, independentemente do plano. */
const FACTS = [
  {
    title: 'Uma arte por geração',
    text: 'Cada geração produz uma arte, no formato que escolheres.',
  },
  {
    title: 'Verificada antes de a veres',
    text: 'A Kriar verifica o logótipo, os textos e as margens. Se alguma coisa estiver mal, corrige uma vez antes de ta mostrar.',
  },
  {
    title: 'Descarregas em PNG',
    text: 'O ficheiro sai nas medidas exactas do formato.',
  },
  {
    title: 'Várias empresas na mesma conta',
    text: 'Cada empresa com o logótipo, as cores e as publicações dela.',
  },
] as const;

/*
  As linhas entre os factos: uma coluna nos telemóveis, duas a partir de 640
  px e quatro a partir de 1024. Cada facto sabe que linhas leva em cada uma.
*/
const FACT_BORDERS = [
  '',
  'border-t sm:border-t-0 sm:border-l',
  'border-t lg:border-t-0 lg:border-l',
  'border-t sm:border-l lg:border-t-0',
];

/** A proporção de cada formato, escrita como as redes a escrevem. */
const RATIO: Record<FormatId, string> = {
  vertical: '4:5',
  quadrado: '1:1',
  story: '9:16',
  reels: '9:16',
  linkedin: '1,91:1',
  horizontal: '16:9',
};

function PlansPending() {
  return (
    // Quase opaco: os pulsos do campo de pontos da secção não atravessam o bloco.
    <div className="lp-edge relative overflow-hidden rounded-[28px] bg-ink-900/85 ring-1 ring-line">
      <span aria-hidden className="lp-soft-glow pointer-events-none absolute -right-32 -top-32 size-[30rem] opacity-80" />

      <div className="relative flex flex-col gap-5 px-6 py-7 sm:px-8 sm:py-9 lg:flex-row lg:items-end lg:justify-between lg:px-10">
        <div className="min-w-0">
          <Hint>Em breve</Hint>
          <h3 className="mt-4 max-w-[32rem] text-balance text-[1.625rem] font-semibold leading-[1.1] tracking-[-0.03em] text-fg sm:text-[2rem]">
            Os planos em kwanzas são anunciados em breve.
          </h3>
        </div>
        <p className="max-w-[22rem] text-[14.5px] leading-relaxed text-fg-muted">
          Enquanto os fechamos, isto é o que cada geração já inclui hoje.
        </p>
      </div>

      <ul className="relative grid grid-cols-1 border-t border-line sm:grid-cols-2 lg:grid-cols-4">
        {FACTS.map((fact, index) => (
          <li key={fact.title} className={cn('min-w-0 border-line px-6 py-7 sm:px-8 lg:px-7', FACT_BORDERS[index])}>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-neon">{String(index + 1).padStart(2, '0')}</p>
            <h4 className="mt-3 text-[15.5px] font-semibold tracking-[-0.01em] text-fg">{fact.title}</h4>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-muted">{fact.text}</p>
          </li>
        ))}
      </ul>

      <div className="relative border-t border-line px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
            Formatos disponíveis
          </h4>
          <p className="text-[12.5px] text-fg-faint">Desenhados na proporção verdadeira.</p>
        </div>
        {/*
          A escala dos desenhos (`--lp-fs`, px por píxel do formato): menor
          até 1024 px, para as linhas de duas e três colunas não ficarem com
          um vazio por cima do LinkedIn e das capas.
        */}
        <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-9 [--lp-fs:0.047px] sm:grid-cols-3 lg:grid-cols-6 lg:[--lp-fs:0.0583px]">
          {FORMATS.map((format) => (
            <li key={format.id} className="flex min-w-0 flex-col">
              <span className="flex h-[5.75rem] items-end lg:h-[7.25rem]">
                <FormatFrame
                  width={format.width}
                  height={format.height}
                  ratio={RATIO[format.id]}
                  standard={format.id === 'vertical'}
                />
              </span>
              <p className="mt-4 text-[13.5px] font-medium text-fg">{format.platform}</p>
              <p className="mt-0.5 font-mono text-[11.5px] tabular-nums text-fg-muted">{format.hint}</p>
              <p className="mt-1.5 text-[12px] leading-snug text-fg-faint">{format.label}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Um formato desenhado à escala: todos se medem pela mesma (`--lp-fs`, na
 * lista) — o lado de 1920 px dá 112 px nos ecrãs largos e 90 nos outros —,
 * e lado a lado vê-se logo que o story é o mais alto e o do LinkedIn o mais
 * baixo. O formato por omissão leva o contorno a néon.
 */
function FormatFrame({
  width,
  height,
  ratio,
  standard,
}: {
  width: number;
  height: number;
  ratio: string;
  standard: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative grid place-items-center rounded-[5px] border bg-ink-950/80',
        standard ? 'border-neon/60 shadow-[0_0_18px_-6px_rgba(191,248,57,0.5)]' : 'border-dashed border-fg-faint/50',
      )}
      style={{ width: `calc(${width} * var(--lp-fs))`, height: `calc(${height} * var(--lp-fs))` }}
    >
      <span className={cn('font-mono text-[10px] tabular-nums', standard ? 'text-neon' : 'text-fg-muted')}>{ratio}</span>
    </span>
  );
}
