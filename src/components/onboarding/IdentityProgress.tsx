'use client';

import * as React from 'react';
import { Check, Layers, Palette, ScanSearch, Sparkles, UploadCloud } from 'lucide-react';
import { SonarGrid } from '@/components/ui/SonarGrid';
import { cn } from '@/lib/utils/cn';

/**
 * Progresso da preparação da identidade.
 *
 * Os passos correspondem a operações reais e mudam quando elas mudam. O
 * passo da análise é opaco — não sabemos o que o modelo está a fazer — e
 * nesse mostramos o tempo decorrido em vez de uma percentagem inventada.
 */
export type IdentityStepId = 'guardar' | 'cores' | 'analise' | 'sistema' | 'visuais';

export type IdentityPhase = {
  step: IdentityStepId;
  startedAt: number;
  /** Detalhe do passo em curso: "2 de 4". */
  detail?: string;
};

const STEPS: Array<{
  id: IdentityStepId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'guardar', label: 'A guardar o logótipo', icon: UploadCloud },
  { id: 'cores', label: 'A ler as cores do ficheiro', icon: Palette },
  { id: 'analise', label: 'A analisar a tua marca', icon: ScanSearch },
  { id: 'sistema', label: 'A montar o design system', icon: Layers },
  { id: 'visuais', label: 'A gerar os visuais', icon: Sparkles },
];

/** Tempo típico do conjunto. A geração de imagens é o que domina. */
const EXPECTED_SECONDS = 90;

export function IdentityProgress({
  phase,
  hidden = [],
}: {
  phase: IdentityPhase;
  /**
   * Passos que esta geração não corre.
   *
   * O logótipo deixou de ser guardado dentro da geração — fica guardado no
   * momento em que é carregado — e sem logótipo não há cores a ler. Mostrar
   * esses passos com um visto era dizer que se fez o que não se fez.
   */
  hidden?: IdentityStepId[];
}) {
  const steps = STEPS.filter((step) => !hidden.includes(step.id));
  const current = Math.max(0, steps.findIndex((step) => step.id === phase.step));
  const elapsed = useElapsedSeconds(phase.startedAt);

  return (
    <div className="absolute inset-0 z-20 rounded-[16px] bg-ink-950/80 backdrop-blur-[3px]">
      <SonarGrid
        className="flex size-full items-center justify-center"
        pingArea={[0.1, 0.12, 0.9, 0.88]}
        baseOpacity={0.24}
        dotRadius={1.5}
        pingEvery={2}
      >
        <span aria-hidden className="sonar-wash pointer-events-none absolute inset-0 -z-10" />

        <div
          role="status"
          aria-live="polite"
          className="edge-top relative w-[21rem] max-w-[calc(100%-2rem)] rounded-[16px] bg-ink-900/90 px-6 py-6 shadow-[0_28px_70px_-28px_rgba(0,0,0,0.95)] ring-1 ring-line animate-[kriar-rise_0.2s_var(--ease-out-soft)]"
        >
          <span className="mx-auto mb-4 grid size-11 place-items-center rounded-[13px] bg-neon/12 text-neon ring-1 ring-neon/30">
            <Sparkles
              className="size-[1.1rem] animate-[kriar-pulse-soft_1.4s_ease-in-out_infinite]"
              aria-hidden
            />
          </span>

          <p className="text-center text-[14px] font-semibold text-fg">
            A preparar a tua identidade
          </p>
          <p className="mt-1 text-center text-[11.5px] leading-relaxed text-fg-muted">
            Analisamos o que nos deste, montamos o sistema visual e geramos as peças.
          </p>

          <span
            aria-hidden
            className="mt-4 block h-[3px] overflow-hidden rounded-full bg-ink-700"
          >
            <span className="kriar-progress block h-full w-1/3 rounded-full bg-neon animate-[kriar-slide_1.1s_ease-in-out_infinite]" />
          </span>

          <ol className="mt-4 flex flex-col gap-2">
            {steps.map((step, index) => {
              const done = index < current;
              const active = index === current;
              const Icon = step.icon;
              return (
                <li
                  key={step.id}
                  className={cn(
                    'flex items-center gap-2 text-[12px] leading-snug transition-colors',
                    done ? 'text-fg-muted' : active ? 'text-fg' : 'text-fg-faint',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-5 shrink-0 place-items-center rounded-full',
                      done
                        ? 'bg-neon/15 text-neon'
                        : active
                          ? 'bg-neon/15 text-neon ring-1 ring-neon/40'
                          : 'bg-ink-800 text-fg-faint',
                    )}
                  >
                    {done ? <Check className="size-3" /> : <Icon className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{step.label}</span>
                  {active && phase.detail ? (
                    <span className="shrink-0 tabular-nums text-[10.5px] text-neon">
                      {phase.detail}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>

          <p className="mt-4 text-center text-[11px] tabular-nums text-fg-faint">
            {elapsed}s decorridos
            {elapsed <= EXPECTED_SECONDS
              ? ` · costuma levar cerca de ${EXPECTED_SECONDS}s`
              : ' · quase lá'}
          </p>
        </div>
      </SonarGrid>
    </div>
  );
}

function useElapsedSeconds(startedAt: number): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  return Math.max(0, Math.round((now - startedAt) / 1000));
}
