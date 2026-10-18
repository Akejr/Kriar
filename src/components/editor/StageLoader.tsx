'use client';

import * as React from 'react';
import { Check, Sparkles } from 'lucide-react';
import type { WorkPhase } from '@/store/editor';
import { SonarGrid } from '@/components/ui/SonarGrid';
import { cn } from '@/lib/utils/cn';

/**
 * Indicador das operações longas.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Não há percentagem inventada. Os passos que a aplicação controla são
 * marcados à medida que acontecem; o passo da geração é opaco — não sabemos
 * o que o fornecedor está a fazer — e nesse mostramos o tempo decorrido com
 * uma barra indeterminada.
 *
 * Uma barra a avançar sozinha até 90% e a parar é mentira, e quando o pedido
 * falhasse o utilizador tinha visto progresso que nunca existiu.
 * ──────────────────────────────────────────────────────────────────────────
 */

/*
  Os passos da arte incluem a VERIFICAÇÃO.

  Não é um passo para encher a lista: é onde a aplicação olha para o
  resultado antes de o mostrar, e quando o logótipo sai errado é aqui que se
  decide gerar outra vez. Escondê-lo deixava o cliente a ver um tempo de
  espera maior sem saber porquê.
*/
const STEPS: Record<WorkPhase['kind'], string[]> = {
  /*
    Os passos do plano vêm, em regra, do store (`phase.steps`): a primeira
    ideia, outra ideia e melhorar a ideia dizem coisas diferentes. Estes são
    os da primeira — dizia "A procurar outra ideia" quando ainda não havia
    ideia nenhuma.
  */
  plano: ['A ler o teu pedido', 'A formular a ideia'],
  arte: [
    'A preparar os produtos e a marca',
    'A gerar a publicação',
    'A verificar o logótipo e as margens',
    'A guardar a arte',
  ],
  /*
    A edição por zonas. "A aplicar" inclui a composição no servidor: é aí
    que a imagem nova entra só dentro das zonas marcadas.
  */
  edicao: [
    'A preparar as zonas',
    'A aplicar as alterações',
    'A verificar as alterações',
    'A guardar a nova versão',
  ],
};

/** Os passos quando a primeira tentativa foi reprovada. */
const RETRY_STEPS: Partial<Record<WorkPhase['kind'], string[]>> = {
  arte: [
    'A preparar os produtos e a marca',
    'A gerar a publicação',
    'A verificar o logótipo e as margens',
    'A corrigir e gerar outra vez',
    'A verificar a correcção',
    'A guardar a arte',
  ],
  edicao: [
    'A preparar as zonas',
    'A aplicar as alterações',
    'A verificar as alterações',
    'A corrigir e aplicar outra vez',
    'A verificar a correcção',
    'A guardar a nova versão',
  ],
};

/**
 * Tempo típico, medido com o modelo actual: perto de 90 segundos de geração
 * e uns 10 de verificação. Com correcção, o dobro.
 */
const EXPECTED_SECONDS: Record<WorkPhase['kind'], number> = {
  // A ideia passou a vir do modelo criativo, que vê as imagens anexadas.
  plano: 35,
  arte: 105,
  edicao: 110,
};

const TITLES: Record<WorkPhase['kind'], string> = {
  plano: 'A preparar a proposta',
  arte: 'A gerar a tua arte',
  edicao: 'A editar a tua arte',
};

export function StageLoader({
  phase,
  expectedSeconds,
}: {
  phase: WorkPhase;
  /**
   * Tempo típico desta operação, quando não é o do tipo.
   *
   * A edição de fotografias reaproveita este indicador com passos próprios
   * (`phase.steps`) e não tem verificação, pelo que leva perto de metade do
   * tempo de uma edição por zonas. O número que aparece no ecrã é uma
   * medição, não um enfeite: dizer 110 s a quem espera 60 é tão enganador
   * como uma barra que avança sozinha.
   */
  expectedSeconds?: number;
}) {
  const steps =
    phase.steps ??
    (phase.retrying ? RETRY_STEPS[phase.kind] : undefined) ??
    STEPS[phase.kind];
  const current = Math.max(0, steps.indexOf(phase.label));
  const elapsed = useElapsedSeconds(phase.startedAt);
  const expected =
    (expectedSeconds ?? EXPECTED_SECONDS[phase.kind]) * (phase.retrying ? 2 : 1);

  return (
    /*
      Opaco. Era transparente, por cima do ecrã anterior, e o cliente via
      os textos e a ideia da proposta antiga através da animação — "fica
      feio com os dados da tela anterior". O ecrã de baixo continua montado
      (o editor esconde-o e tira-o do foco), para nada se perder se a
      operação falhar.
    */
    <div className="absolute inset-0 z-20 bg-ink-950">
      <SonarGrid
        className="flex size-full items-center justify-center"
        pingArea={[0.1, 0.12, 0.9, 0.88]}
        baseOpacity={0.26}
        dotRadius={1.5}
        pingEvery={2.2}
      >
        <span aria-hidden className="sonar-wash pointer-events-none absolute inset-0 -z-10" />

        <div
          role="status"
          aria-live="polite"
          className="edge-top relative w-[20rem] max-w-[calc(100vw-3rem)] rounded-[16px] bg-ink-900/85 px-6 py-6 shadow-[0_28px_70px_-28px_rgba(0,0,0,0.95)] ring-1 ring-line backdrop-blur-sm animate-[kriar-rise_0.2s_var(--ease-out-soft)]"
        >
          <span className="mx-auto mb-4 grid size-11 place-items-center rounded-[13px] bg-neon/12 text-neon ring-1 ring-neon/30">
            <Sparkles
              className="size-[1.1rem] animate-[kriar-pulse-soft_1.4s_ease-in-out_infinite]"
              aria-hidden
            />
          </span>

          <p className="text-center text-[14px] font-semibold text-fg">
            {phase.title ?? TITLES[phase.kind]}
          </p>

          {/* Barra indeterminada: o tempo real depende do fornecedor. */}
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
              return (
                <li
                  key={step}
                  className={cn(
                    'flex items-center gap-2 text-[12px] leading-snug transition-colors',
                    done ? 'text-fg-muted' : active ? 'text-fg' : 'text-fg-faint',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-4 shrink-0 place-items-center rounded-full',
                      done
                        ? 'bg-neon/15 text-neon'
                        : active
                          ? 'bg-neon/15 ring-1 ring-neon/40'
                          : 'bg-ink-800',
                    )}
                  >
                    {done ? (
                      <Check className="size-2.5" aria-hidden />
                    ) : active ? (
                      <span className="size-1.5 rounded-full bg-neon animate-[kriar-pulse-soft_1s_ease-in-out_infinite]" />
                    ) : (
                      <span className="size-1 rounded-full bg-fg-faint" />
                    )}
                  </span>
                  {step}
                </li>
              );
            })}
          </ol>

          {/*
            O que está a ser corrigido, dito em frase.

            Sem isto, a segunda geração era só uma espera mais longa. Com
            isto, o cliente percebe que a aplicação encontrou um defeito e o
            está a resolver antes de lhe mostrar a arte.
          */}
          {phase.retrying && phase.detail ? (
            <p className="mt-3 flex gap-2 rounded-[9px] bg-ink-800 px-2.5 py-2 text-[11px] leading-relaxed text-fg-muted ring-1 ring-line">
              <span
                aria-hidden
                className="mt-[5px] size-1.5 shrink-0 rounded-full bg-neon/80"
              />
              <span>A afinar a primeira versão antes de ta mostrar: {phase.detail}</span>
            </p>
          ) : null}

          <p className="mt-4 text-center text-[11px] tabular-nums text-fg-faint">
            {elapsed}s decorridos
            {elapsed <= expected ? ` · costuma levar cerca de ${expected}s` : ' · quase lá'}
          </p>
        </div>
      </SonarGrid>
    </div>
  );
}

/** Segundos desde o início da operação. Actualiza uma vez por segundo. */
function useElapsedSeconds(startedAt: number): number {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  return Math.max(0, Math.round((now - startedAt) / 1000));
}
