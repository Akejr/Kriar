'use client';

import * as React from 'react';
import { RefreshCw, Wand2 } from 'lucide-react';
import type { CreativeDirection } from '@/lib/domain/direction';
import { Button } from '@/components/ui/primitives';
import { cn } from '@/lib/utils/cn';

/**
 * A ideia proposta, e as duas maneiras de a mudar.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Só a ideia e a razão, em duas frases curtas. Saíram daqui "O que se vê",
 * "Protagonista" e "Luz" — a cena para o director de fotografia, que o
 * cliente lia sem precisar: "tem muito texto na ideia, o cliente pode ficar
 * confuso; tem coisas que o cliente nem precisa de saber". Seguem para o
 * gerador na mesma.
 *
 *  · "Outra ideia" troca de ideia (e é instantâneo quando há uma guardada);
 *  · "Melhorar a ideia" mantém a que o cliente gostou e aplica o que ele
 *    pedir — "mais luz natural", "o produto maior", "sem pessoas".
 *
 * Substituiu o campo "Ajustar a ideia a dedo", onde o texto do cliente
 * mandava no gerador por cima da ideia toda: uma frase solta, sem cena nem
 * design, a substituir uma direcção inteira.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function ReviewIdea({
  direction,
  planning,
  onReshuffle,
  onRefine,
}: {
  direction: CreativeDirection | null;
  planning: boolean;
  onReshuffle: () => void;
  /** Devolve `true` quando a ideia foi melhorada: a caixa fecha-se. */
  onRefine: (request: string) => Promise<boolean>;
}) {
  const [open, setOpen] = React.useState(false);
  const [request, setRequest] = React.useState('');
  const fieldId = React.useId();

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    const text = request.trim();
    if (!text || planning) return;
    const ok = await onRefine(text);
    if (ok) {
      setRequest('');
      setOpen(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[16px] bg-ink-900/70 p-4 ring-1 ring-neon/20 backdrop-blur-sm">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon/40 to-transparent"
      />
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neon/80">A ideia</p>

      {direction ? (
        <>
          <p className="mt-1.5 line-clamp-3 text-[15px] font-medium leading-snug text-fg">
            {direction.idea}
          </p>
          {direction.rationale ? (
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-fg-muted">
              {direction.rationale}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-muted">
          Ainda não há uma ideia proposta para esta publicação.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <IdeaButton onClick={onReshuffle} disabled={planning}>
          <RefreshCw
            className={cn('size-3', planning && 'animate-[kriar-spin_0.9s_linear_infinite]')}
            aria-hidden
          />
          {direction ? 'Outra ideia' : 'Propor uma ideia'}
        </IdeaButton>
        {direction ? (
          <IdeaButton
            onClick={() => setOpen((value) => !value)}
            disabled={planning}
            pressed={open}
            aria-expanded={open}
            aria-controls={fieldId}
          >
            <Wand2 className="size-3" aria-hidden />
            Melhorar a ideia
          </IdeaButton>
        ) : null}
      </div>

      {open && direction ? (
        <form id={fieldId} onSubmit={submit} className="mt-3 flex flex-col gap-2">
          <label htmlFor={`${fieldId}-pedido`} className="sr-only">
            O que queres melhorar na ideia
          </label>
          <textarea
            id={`${fieldId}-pedido`}
            rows={2}
            autoFocus
            maxLength={600}
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            onKeyDown={(event) => {
              // Enter envia; Shift+Enter muda de linha, como numa conversa.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submit(event);
              }
              if (event.key === 'Escape') setOpen(false);
            }}
            placeholder="O que queres diferente? Por exemplo: mais luz natural, o produto maior, sem pessoas."
            className="w-full resize-none rounded-[11px] border border-line bg-ink-950/70 px-3 py-2.5 text-[12.5px] leading-relaxed text-fg outline-none transition-colors placeholder:text-fg-faint hover:border-line-strong focus:border-neon/60"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10.5px] leading-snug text-fg-faint">
              Os textos ficam, a não ser que fales deles.
            </p>
            <div className="flex shrink-0 gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={planning}
                disabled={!request.trim()}
              >
                Melhorar
              </Button>
            </div>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function IdeaButton({
  pressed,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:text-fg-faint',
        pressed
          ? 'border-neon/45 text-neon'
          : 'border-line text-fg-muted hover:border-neon/40 hover:text-neon',
        className,
      )}
      {...rest}
    />
  );
}
