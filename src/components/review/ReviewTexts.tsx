'use client';

import * as React from 'react';
import { Pencil, RotateCcw, X } from 'lucide-react';
import { TEXT_ROLE_LABELS } from '@/lib/domain/catalog';
import type { Composition, TextRole } from '@/lib/domain/types';
import { cn } from '@/lib/utils/cn';

/**
 * Textos da publicação.
 *
 * Campos directos, sem modais. Editar aqui é o momento barato de corrigir:
 * depois de gerar, mudar uma palavra obriga a gerar outra vez.
 *
 * O preço e a etiqueta só aparecem quando existem. Mostrar um campo de preço
 * vazio convidava a inventar um valor que o pedido não tinha.
 *
 * Menos texto à volta dos campos: a nota "Editado por ti. Não volta a ser
 * reescrito." em cada campo editado passou a ser o lápis verde, com a frase
 * na dica. O que fica escrito é o que muda a arte — um botão retirado.
 */

const ORDER: Array<{
  role: TextRole;
  label: string;
  placeholder: string;
  wide?: boolean;
  /** Pode ser removido da arte. */
  removable?: boolean;
}> = [
  {
    role: 'headline',
    label: 'Título',
    placeholder: 'A frase principal da publicação',
  },
  {
    role: 'subheadline',
    label: 'Texto de apoio',
    placeholder: 'Uma linha que completa o título',
  },
  {
    /*
      A chamada para acção é REMOVÍVEL.

      Nem toda a publicação pede uma acção. Um anúncio institucional, uma
      mensagem de festa, uma apresentação de marca — em todas, um botão
      "Adquire já o teu" é ruído que o cliente não pediu.

      Retirada, fica retirada: "Actualizar proposta" não a devolve
      (`setText` no store) e a arte é verificada sem botão.
    */
    role: 'cta',
    label: 'Botão',
    placeholder: 'O que queres que o cliente faça',
    wide: true,
    removable: true,
  },
];

const EXTRA: Array<{ role: TextRole; label: string; placeholder: string }> = [
  { role: 'price', label: 'Preço', placeholder: '15.000 Kz' },
  { role: 'badge', label: 'Etiqueta', placeholder: 'Promoção' },
];

export function ReviewTexts({
  texts,
  onChange,
}: {
  texts: Composition['texts'];
  onChange: (role: TextRole, value: string) => void;
}) {
  // Retirados continuam à vista enquanto houver o que repor.
  const extras = EXTRA.filter((entry) => {
    const text = texts[entry.role];
    return Boolean(text?.value?.trim() || (text?.locked && text.proposed?.trim()));
  });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ORDER.map((entry) => (
        <TextRow
          key={entry.role}
          label={entry.label}
          placeholder={entry.placeholder}
          value={texts[entry.role]?.value ?? ''}
          locked={texts[entry.role]?.locked ?? false}
          proposed={texts[entry.role]?.proposed}
          className={entry.wide ? 'sm:col-span-2' : undefined}
          removable={entry.removable}
          onChange={(value) => onChange(entry.role, value)}
        />
      ))}

      {extras.map((entry) => (
        <TextRow
          key={entry.role}
          label={entry.label}
          placeholder={entry.placeholder}
          value={texts[entry.role]?.value ?? ''}
          locked={texts[entry.role]?.locked ?? false}
          proposed={texts[entry.role]?.proposed}
          removable
          onChange={(value) => onChange(entry.role, value)}
        />
      ))}
    </div>
  );
}

function TextRow({
  label,
  placeholder,
  value,
  locked,
  proposed,
  className,
  removable,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  locked: boolean;
  /** O que a IA propôs, para o poder repor depois de retirado. */
  proposed?: string;
  className?: string;
  removable?: boolean;
  onChange: (value: string) => void;
}) {
  const id = React.useId().replace(/:/g, '');
  const filled = value.trim().length > 0;
  // Vazio e protegido: o cliente retirou-o. Vazio e livre: ainda por propor.
  const removed = removable && !filled && locked;

  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={`rever-${id}`} className="block text-[11.5px] font-medium text-fg-muted">
          {label}
        </label>

        {/*
          Remover é uma acção explícita, não "apaga o campo e espera". Um
          botão com o nome do que faz é a diferença entre uma funcionalidade
          que existe e uma que o cliente descobre por acidente.
        */}
        {removable && filled ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="inline-flex shrink-0 items-center gap-1 text-[10.5px] font-medium text-fg-faint transition-colors hover:text-fg"
          >
            <X className="size-2.5" aria-hidden />
            Retirar da arte
          </button>
        ) : removed && proposed?.trim() ? (
          <button
            type="button"
            onClick={() => onChange(proposed)}
            className="inline-flex min-w-0 shrink items-center gap-1 text-[10.5px] font-medium text-fg-faint transition-colors hover:text-neon"
          >
            <RotateCcw className="size-2.5 shrink-0" aria-hidden />
            <span className="truncate">Repor «{proposed}»</span>
          </button>
        ) : null}
      </div>

      <div className="relative">
        <input
          id={`rever-${id}`}
          value={value}
          placeholder={removed ? `Sem ${label.toLocaleLowerCase('pt-PT')} nesta arte` : placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full rounded-[10px] border border-line bg-ink-950/70 pl-3 pr-9 text-[12.5px] text-fg outline-none transition-colors placeholder:text-fg-faint hover:border-line-strong focus:border-neon/60"
        />
        <span
          className="absolute right-3 top-1/2 -translate-y-1/2"
          title={locked && filled ? 'Editado por ti: não volta a ser reescrito.' : undefined}
        >
          <Pencil
            aria-hidden
            className={cn(
              'size-3.5 transition-colors',
              locked && filled ? 'text-neon' : 'text-fg-faint',
            )}
          />
        </span>
      </div>

      {removed ? (
        <p className="mt-1 text-[10.5px] text-fg-faint">
          Retirado: a arte sai sem {label === 'Botão' ? 'botão' : label.toLocaleLowerCase('pt-PT')}.
        </p>
      ) : null}
    </div>
  );
}

export { TEXT_ROLE_LABELS };
