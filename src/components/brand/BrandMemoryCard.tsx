'use client';

import * as React from 'react';
import { Brain, ChevronDown, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  dismissMemoryRule,
  emptyMemory,
  MEMORY_RULE_LIMIT,
  MEMORY_RULE_MAX,
  writeClientRule,
} from '@/lib/brand/memory';
import type { BrandMemory, BrandMemoryEvent } from '@/lib/domain/types';
import { cn } from '@/lib/utils/cn';
import { Button, IconButton, Switch } from '@/components/ui/primitives';

const KIND_LABEL: Record<BrandMemoryEvent['kind'], string> = {
  edicao: 'Edição',
  'outra-ideia': 'Ideia recusada',
  melhoria: 'Ideia melhorada',
  descarga: 'Descarregada',
  texto: 'Texto reescrito',
  aprovada: 'Aprovada',
};

function when(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}

/**
 * A MEMÓRIA DA EMPRESA, à vista e editável.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * As regras entram em todas as ideias e em todas as artes, e foram escritas
 * por um modelo a partir do uso. Uma regra errada repetia-se em cada
 * publicação sem o cliente saber porquê. Por isso estão aqui todas, cada
 * uma com a origem, e cada uma se corrige ou apaga — uma regra apagada não
 * volta.
 *
 * Grava-se sozinho, como a biblioteca: nada aqui espera pelo "Guardar" da
 * página.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function BrandMemoryCard({
  memory,
  learning,
  onChange,
  onLearn,
}: {
  memory: BrandMemory | null;
  /** Uma leitura está em curso. */
  learning: boolean;
  /** Grava a memória. `true` se ficou gravada. */
  onChange: (next: BrandMemory) => Promise<boolean>;
  /** Pede uma leitura já. */
  onLearn: () => void;
}) {
  const current = memory ?? emptyMemory();
  const [adding, setAdding] = React.useState(false);
  const [showEvents, setShowEvents] = React.useState(false);

  const full = current.rules.length >= MEMORY_RULE_LIMIT;

  return (
    <div className={cn('flex flex-col gap-4', !current.enabled && 'opacity-80')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-[12.5px] leading-relaxed text-fg-muted">
          <Brain className="size-4 shrink-0 text-neon" aria-hidden />
          {current.rules.length === 0
            ? 'Ainda sem regras.'
            : `${current.rules.length} ${current.rules.length === 1 ? 'regra' : 'regras'}`}
          {current.events.length > 0
            ? ` · ${current.events.length} ${current.events.length === 1 ? 'acontecimento registado' : 'acontecimentos registados'}`
            : ''}
          {current.learnedAt ? ` · actualizada ${when(current.learnedAt)}` : ''}
        </p>
        <Switch
          checked={current.enabled}
          onChange={(enabled) => void onChange({ ...current, enabled })}
          label="Usar nas novas publicações"
        />
      </div>

      {current.rules.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {current.rules.map((rule) => (
            <RuleRow
              key={rule.id}
              text={rule.text}
              source={rule.source}
              onCommit={(text) => void onChange(writeClientRule(current, rule.id, text))}
              onDelete={() => void onChange(dismissMemoryRule(current, rule.id))}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-[12px] border border-dashed border-line px-3.5 py-3 text-[12px] leading-relaxed text-fg-faint">
          As regras vão aparecendo à medida que usas a Kriar: o que pedes nas edições por zonas,
          as ideias que recusas, os textos que reescreves, as artes que descarregas e aprovas.
          Também podes escrever as tuas.
        </p>
      )}

      {adding ? (
        <NewRule
          onCancel={() => setAdding(false)}
          onSave={async (text) => {
            const ok = await onChange(writeClientRule(current, null, text));
            if (ok) setAdding(false);
          }}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAdding(true)}
          disabled={adding || full}
          title={full ? `Cabem até ${MEMORY_RULE_LIMIT} regras.` : undefined}
        >
          <Plus className="size-3.5" aria-hidden />
          Escrever uma regra
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onLearn}
          loading={learning}
          disabled={current.events.length === 0 || !current.enabled}
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Actualizar agora
        </Button>
        {current.events.length > 0 ? (
          <button
            type="button"
            aria-expanded={showEvents}
            onClick={() => setShowEvents((value) => !value)}
            className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-fg-faint transition-colors hover:text-fg-muted"
          >
            O que registámos
            <ChevronDown
              className={cn('size-3.5 transition-transform', showEvents && 'rotate-180')}
              aria-hidden
            />
          </button>
        ) : null}
      </div>

      {showEvents ? (
        <ol className="flex flex-col gap-1.5 rounded-[12px] bg-ink-950/50 p-3 ring-1 ring-line">
          {current.events.slice(0, 15).map((event) => (
            <li key={event.id} className="flex gap-2 text-[11.5px] leading-relaxed">
              <span className="w-[6.5rem] shrink-0 text-fg-faint">{KIND_LABEL[event.kind]}</span>
              <span className="min-w-0 flex-1 text-fg-muted">{event.detail}</span>
              <span className="shrink-0 tabular-nums text-fg-faint">{when(event.at)}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

/** Uma regra. Clica-se no texto para o corrigir; corrigir torna-a do cliente. */
function RuleRow({
  text,
  source,
  onCommit,
  onDelete,
}: {
  text: string;
  source: 'ia' | 'cliente';
  onCommit: (text: string) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = React.useState(text);
  React.useEffect(() => setDraft(text), [text]);

  function commit() {
    const clean = draft.replace(/\s+/g, ' ').trim();
    if (!clean) {
      setDraft(text);
      return;
    }
    if (clean !== text) onCommit(clean);
  }

  return (
    <li className="flex items-center gap-2 rounded-[11px] border border-line bg-ink-950/60 py-1.5 pl-3 pr-1.5">
      <span
        className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
          source === 'cliente' ? 'bg-neon/12 text-neon' : 'bg-ink-800 text-fg-muted',
        )}
      >
        {source === 'cliente' ? 'Tua' : 'Aprendida'}
      </span>
      <input
        value={draft}
        maxLength={MEMORY_RULE_MAX}
        aria-label="Regra da memória"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            setDraft(text);
            event.currentTarget.blur();
          }
        }}
        className="h-8 min-w-0 flex-1 rounded-[7px] bg-transparent px-1.5 text-[12.5px] text-fg outline-none ring-1 ring-transparent transition-shadow hover:ring-line focus:ring-neon/35"
      />
      <IconButton label="Apagar esta regra" size="sm" tone="danger" onClick={onDelete}>
        <Trash2 className="size-3.5" aria-hidden />
      </IconButton>
    </li>
  );
}

function NewRule({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (text: string) => Promise<void>;
}) {
  const [text, setText] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => inputRef.current?.focus(), []);

  async function save() {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return;
    setSaving(true);
    await onSave(clean);
    setSaving(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[11px] border border-neon/30 bg-ink-950/60 p-2">
      <input
        ref={inputRef}
        value={text}
        maxLength={MEMORY_RULE_MAX}
        aria-label="Nova regra"
        placeholder="Ex.: O website aparece sempre por baixo do botão."
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void save();
          } else if (event.key === 'Escape') onCancel();
        }}
        className="h-9 min-w-[12rem] flex-1 rounded-[8px] bg-ink-900/70 px-2.5 text-[12.5px] text-fg outline-none ring-1 ring-line placeholder:text-fg-faint focus:ring-neon/35"
      />
      <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
        Cancelar
      </Button>
      <Button variant="primary" size="sm" onClick={() => void save()} loading={saving} disabled={!text.trim()}>
        Guardar regra
      </Button>
    </div>
  );
}
