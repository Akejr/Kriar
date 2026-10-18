'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { newId } from '@/lib/utils/id';
import { NoticeBar, NoticeMark, type NoticeTone } from './primitives';

export type ToastTone = 'sucesso' | 'erro' | 'aviso' | 'info';

export type Toast = {
  id: string;
  tone: ToastTone;
  message: string;
  /** Acção opcional, por exemplo "Tentar de novo". */
  action?: { label: string; onClick: () => void };
  /** Milissegundos. `0` mantém até o utilizador fechar. */
  duration?: number;
};

type ToastContextValue = {
  show: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error('useToast tem de ser usado dentro de <ToastProvider>.');
  return context;
}

/**
 * Cada tom de notificação no tom equivalente dos avisos.
 *
 * As notificações tinham a borda inteira tingida — vermelha, âmbar, verde —
 * e um ícone solto. Passaram a usar o mesmo chip e o mesmo traço do
 * `Callout`: a superfície é sempre a dos painéis e a cor fica no ícone.
 * Uma notificação de erro continua a ler-se como erro sem parecer um alarme.
 */
const TONE: Record<ToastTone, NoticeTone> = {
  sucesso: 'neon',
  erro: 'danger',
  aviso: 'warn',
  info: 'info',
};

/*
  O tom, dito por palavras a quem não vê o chip.

  O chip é decorativo (`aria-hidden`) e a região só anuncia o texto. Sem
  isto, "Não foi possível guardar" e "Guardado" chegavam ao leitor de ecrã
  com a mesma voz — a cor era a única diferença, e a cor não se ouve.
*/
const TONE_LABEL: Record<ToastTone, string> = {
  sucesso: 'Feito',
  erro: 'Erro',
  aviso: 'Atenção',
  info: 'Nota',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = React.useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = newId('tst');
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      const duration = toast.duration ?? (toast.tone === 'erro' ? 8000 : 4200);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  React.useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    },
    [],
  );

  const value = React.useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/*
        Em cima, à direita, por baixo do cabeçalho.

        Estavam em baixo, ao centro: exactamente onde fica a barra de acções
        do editor. Durante quatro segundos tapavam "Repor esta versão" e o
        botão da biblioteca da marca — que é onde o cliente está a olhar
        logo a seguir ao clique.
      */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-4 top-16 z-[70] flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => (
          /*
            Duas camadas: a de fora leva a sombra, a de dentro a superfície.

            A linha de luz `edge-top` é uma `box-shadow` interior e vem
            depois das utilidades do Tailwind na folha de estilos. No mesmo
            elemento, apagava a sombra de elevação — e uma notificação sem
            sombra perde-se em cima do conteúdo.
          */
          <div
            key={toast.id}
            className="pointer-events-auto rounded-[12px] shadow-[0_22px_48px_-22px_rgba(0,0,0,0.95)] animate-[kriar-rise_0.18s_var(--ease-out-soft)]"
          >
            <div className="edge-top relative flex items-start gap-3 rounded-[12px] border border-line-strong bg-ink-800/95 py-3 pl-3 pr-2.5 backdrop-blur">
              <NoticeBar tone={TONE[toast.tone]} className="inset-y-3" />
              <NoticeMark tone={TONE[toast.tone]} />
              <p className="min-w-0 flex-1 pt-px text-[13px] leading-relaxed text-fg">
                <span className="sr-only">{TONE_LABEL[toast.tone]}: </span>
                {toast.message}
              </p>
              {toast.action ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    dismiss(toast.id);
                  }}
                  className="h-[22px] shrink-0 rounded-[6px] px-1.5 text-[12px] font-semibold text-neon transition-colors hover:bg-neon/10"
                >
                  {toast.action.label}
                </button>
              ) : null}
              <button
                type="button"
                aria-label="Fechar aviso"
                onClick={() => dismiss(toast.id)}
                className="grid size-[22px] shrink-0 place-items-center rounded-[6px] text-fg-faint transition-colors hover:bg-ink-700 hover:text-fg"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
