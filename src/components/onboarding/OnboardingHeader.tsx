'use client';

import * as React from 'react';
import { Check, LogOut } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/primitives';
import { cn } from '@/lib/utils/cn';

/**
 * Cabeçalho do cadastro.
 *
 * Sem a barra de navegação do painel: isto é cadastro, não trabalho. O
 * indicador mostra as etapas e o que já ficou feito, e "Guardar e sair"
 * existe porque uma identidade de marca não se decide em cinco minutos.
 */
export const ONBOARDING_STEPS = [
  { id: 1, label: 'Dados da empresa' },
  // Opcional: quem ainda não tem artes salta-o.
  { id: 2, label: 'Artes da marca' },
  { id: 3, label: 'Identidade da marca' },
  { id: 4, label: 'Concluir' },
] as const;

/** As etapas pelo nome, para o código não depender de números soltos. */
export const STEP = { empresa: 1, artes: 2, identidade: 3, concluir: 4 } as const;

export function OnboardingHeader({
  step,
  saving,
  onSaveAndExit,
}: {
  step: number;
  saving: boolean;
  onSaveAndExit: () => void;
}) {
  return (
    <header className="relative flex h-14 shrink-0 items-center gap-4 px-4 sm:px-6">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-line to-transparent"
      />

      <Logo variant="wordmark" height={20} />

      <ol
        aria-label="Etapas do cadastro"
        className="mx-auto hidden items-center gap-2.5 md:flex"
      >
        {ONBOARDING_STEPS.map((item, index) => {
          const state = item.id === step ? 'actual' : item.id < step ? 'feita' : 'futura';
          return (
            <React.Fragment key={item.id}>
              <li className="flex items-center gap-2">
                <span
                  aria-current={state === 'actual' ? 'step' : undefined}
                  className={cn(
                    'grid size-5 shrink-0 place-items-center rounded-full border text-[10.5px] font-semibold',
                    state === 'actual'
                      ? 'border-neon bg-neon text-ink-950'
                      : state === 'feita'
                        ? 'border-neon/50 bg-neon/15 text-neon'
                        : 'border-line text-fg-faint',
                  )}
                >
                  {state === 'feita' ? <Check className="size-3" aria-hidden /> : item.id}
                </span>
                <span
                  className={cn(
                    'whitespace-nowrap text-[12.5px]',
                    state === 'actual'
                      ? 'font-medium text-fg'
                      : state === 'feita'
                        ? 'text-fg-muted'
                        : 'text-fg-faint',
                  )}
                >
                  {item.label}
                </span>
              </li>
              {index < ONBOARDING_STEPS.length - 1 ? (
                <span aria-hidden className="h-px w-6 bg-line" />
              ) : null}
            </React.Fragment>
          );
        })}
      </ol>

      {/* Em ecrãs pequenos o indicador completo não cabe. */}
      <span className="mx-auto text-[12px] text-fg-muted md:hidden">
        Etapa {step} de {ONBOARDING_STEPS.length}
      </span>

      <Button variant="secondary" size="sm" loading={saving} onClick={onSaveAndExit}>
        <LogOut className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">Guardar e sair</span>
        <span className="sm:hidden">Guardar</span>
      </Button>
    </header>
  );
}
