'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { bestTextOn, normalizeHex, safeHex } from '@/lib/utils/color';

/**
 * Selector de cor.
 *
 * Combina o selector nativo do sistema com um campo hexadecimal, porque quem
 * recebe o manual da marca costuma ter o código exacto e quer escrevê-lo.
 */
export function ColorField({
  value,
  onChange,
  label,
  id,
  optional,
  onClear,
  suggestions,
}: {
  value: string | null | undefined;
  onChange: (hex: string) => void;
  label: string;
  id?: string;
  optional?: boolean;
  onClear?: () => void;
  /** Cores propostas, por exemplo encontradas no manual de marca. */
  suggestions?: Array<{ hex: string; note?: string }>;
}) {
  const generatedId = React.useId();
  const controlId = id ?? `cor-${generatedId.replace(/:/g, '')}`;
  const current = normalizeHex(value);
  const [draft, setDraft] = React.useState(current ?? '');

  React.useEffect(() => {
    setDraft(current ?? '');
  }, [current]);

  const commit = (raw: string) => {
    const normalized = normalizeHex(raw);
    if (normalized) onChange(normalized);
    else setDraft(current ?? '');
  };

  const preview = current ?? '#1A1F1B';

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={controlId} className="flex items-baseline gap-2 text-[13px] font-medium text-fg">
          {label}
          {optional ? <span className="text-[11px] font-normal text-fg-faint">opcional</span> : null}
        </label>
        {onClear && current ? (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] text-fg-faint underline-offset-2 hover:text-fg hover:underline"
          >
            remover
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative size-10 shrink-0 overflow-hidden rounded-[10px] border border-line">
          <input
            id={controlId}
            type="color"
            value={preview}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            aria-label={`${label}: escolher no selector do sistema`}
            className="absolute -inset-2 size-[calc(100%+1rem)] cursor-pointer border-0 bg-transparent p-0"
          />
        </div>
        <input
          type="text"
          inputMode="text"
          spellCheck={false}
          value={draft}
          placeholder="#1F3A5F"
          aria-label={`${label}: código hexadecimal`}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit(draft);
            }
          }}
          className={cn(
            'h-10 w-full rounded-[10px] border bg-ink-950 px-3 font-mono text-[13px] uppercase text-fg',
            'placeholder:font-sans placeholder:text-fg-faint',
            normalizeHex(draft) || draft === ''
              ? 'border-line hover:border-line-strong focus:border-neon/60'
              : 'border-danger/60',
          )}
        />
      </div>

      {suggestions && suggestions.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {suggestions.map((suggestion) => {
            const hex = safeHex(suggestion.hex);
            const selected = current === hex;
            return (
              <button
                key={`${hex}-${suggestion.note ?? ''}`}
                type="button"
                onClick={() => onChange(hex)}
                title={suggestion.note ? `${hex} — ${suggestion.note}` : hex}
                className={cn(
                  'flex h-7 items-center gap-1.5 rounded-full border px-2 text-[11px] font-medium transition-colors',
                  selected ? 'border-neon/70' : 'border-line hover:border-line-strong',
                )}
                style={{ backgroundColor: hex, color: bestTextOn(hex) }}
              >
                {selected ? <Check className="size-3" aria-hidden /> : null}
                <span className="font-mono">{hex}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
