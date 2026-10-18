'use client';

import * as React from 'react';
import { HelpCircle } from 'lucide-react';
import { Button, Input, NoticeBar, NoticeMark } from '@/components/ui/primitives';

/**
 * Informação que a aplicação não pode inventar.
 *
 * Quando o pedido fala de uma promoção mas não diz o preço, ou pede
 * encomendas por WhatsApp sem número guardado, aparece aqui um campo em vez
 * de um valor inventado.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Montado com as peças do `Callout`, não com o `Callout` inteiro.
 *
 * Era uma caixa âmbar com o título em âmbar. Passou à linguagem dos avisos —
 * superfície de painel, o chip e o traço de tom — mas com o chip na linha do
 * título em vez de numa coluna à esquerda: aqui há campos de texto, e o
 * recuo do `Callout` roubava-lhes 40 px numa coluna que já é estreita.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function MissingFields({
  fields,
  onFill,
}: {
  fields: Array<{ field: string; question: string }>;
  onFill: (field: string, value: string) => void;
}) {
  const [values, setValues] = React.useState<Record<string, string>>({});

  if (fields.length === 0) return null;

  return (
    <div className="edge-top relative rounded-[12px] border border-line bg-ink-800/80 p-3">
      <NoticeBar tone="warn" className="inset-y-3" />
      <p className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold text-fg">
        <NoticeMark
          tone="warn"
          size="sm"
          icon={<HelpCircle className="size-[11px]" aria-hidden />}
        />
        Falta esta informação
      </p>
      <ul className="flex flex-col gap-2.5">
        {fields.map((item) => (
          <li key={item.field}>
            <label
              htmlFor={`falta-${item.field}`}
              className="mb-1.5 block text-[12px] leading-relaxed text-fg"
            >
              {item.question}
            </label>
            <div className="flex gap-1.5">
              <Input
                id={`falta-${item.field}`}
                value={values[item.field] ?? ''}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [item.field]: event.target.value }))
                }
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  const value = values[item.field]?.trim();
                  if (value) onFill(item.field, value);
                }}
                placeholder={
                  item.field === 'price'
                    ? '15.000 Kz'
                    : item.field === 'whatsapp'
                      ? '+244 923 000 000'
                      : item.field === 'items'
                        ? 'Corte, barba, coloração'
                        : ''
                }
                className="h-9 text-[12.5px]"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-9 shrink-0"
                disabled={!values[item.field]?.trim()}
                onClick={() => {
                  const value = values[item.field]?.trim();
                  if (value) onFill(item.field, value);
                }}
              >
                Usar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
