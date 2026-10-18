'use client';

import * as React from 'react';
import { AlertTriangle, ImagePlus, Redo2, Sparkles, Trash2, Undo2, X } from 'lucide-react';
import {
  BRUSH_SIZES,
  describeZonePosition,
  ZONE_LIMIT,
  zoneBounds,
  type ZoneShape,
} from '@/lib/composition/zones';
import { checkImageFile, blobToDataUrl, downscaleImageBlob } from '@/lib/utils/files';
import { APP } from '@/config/app';
import { cn } from '@/lib/utils/cn';
import { Button, IconButton, Switch } from '@/components/ui/primitives';
import type { ZoneEditor } from './useZoneEditor';

/**
 * Pedidos rápidos. Não substituem o texto do cliente: dão-lhe o começo da
 * frase, que é a parte que mais custa escrever.
 */
const SUGGESTIONS = [
  { label: 'Remover', text: 'Remove isto e preenche com o fundo que está à volta.' },
  { label: 'Mudar a cor', text: 'Muda a cor para ' },
  { label: 'Mudar o texto', text: 'Muda o texto para «»' },
  { label: 'Aumentar', text: 'Aumenta isto, sem tapar o resto.' },
  { label: 'Substituir', text: 'Substitui por ' },
] as const;

/** A posição de uma zona em palavras, como o cartão a mostra. */
export function zonePosition(zone: ZoneShape, aspect: number): string {
  const bounds = zoneBounds(zone, aspect);
  return bounds ? describeZonePosition(bounds) : '';
}

/**
 * O que está a ser editado.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O painel serve dois materiais: a arte gerada de uma publicação e uma
 * fotografia que o cliente carregou na tela "Editar foto". A mecânica é a
 * mesma — pintar a zona, dizer o que lá vai —, e o que muda é só o nome da
 * coisa e o que acontece depois de aplicar (uma publicação guarda versões,
 * uma fotografia não).
 *
 * Fica num mapa e não em dez props de texto: as frases pertencem ao painel,
 * e espalhá-las pelos dois sítios que o usam era a forma garantida de elas
 * divergirem.
 * ──────────────────────────────────────────────────────────────────────────
 */
const SUBJECTS = {
  arte: {
    noun: 'arte',
    paintOver: 'Pinta por cima da arte',
    preserved: 'O resto da arte fica exactamente igual.',
    huge: 'Esta zona cobre quase a arte toda. Para mudar tudo, gerar outra arte sai melhor.',
    after: 'Cerca de minuto e meio. A versão actual fica guardada nas versões.',
  },
  fotografia: {
    noun: 'fotografia',
    paintOver: 'Pinta por cima da fotografia',
    preserved: 'O resto da fotografia fica exactamente igual, ao píxel.',
    huge: 'Esta zona cobre quase a fotografia toda. Para mudar tudo, marca zonas menores — fora delas nada se perde.',
    after: 'Cerca de minuto e meio. Podes voltar à anterior depois de ver o resultado.',
  },
} as const;

export type ZoneSubject = keyof typeof SUBJECTS;

/**
 * O painel da edição por zonas.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Um cartão por zona, com o mesmo número que a zona tem na imagem. O cartão
 * diz onde a zona fica — "no canto superior direito" — para o cliente
 * confirmar que pintou o que queria antes de gastar uma geração.
 *
 * O botão de aplicar só acende quando todas as zonas têm pedido. Uma zona
 * sem pedido era uma zona que o gerador tinha de adivinhar.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function ZonePanel({
  editor,
  aspect,
  busy,
  preserve,
  subject = 'arte',
  onPreserveChange,
  onApply,
  onClose,
}: {
  editor: ZoneEditor;
  aspect: number;
  busy: boolean;
  preserve: boolean;
  /** O que está a ser editado. Muda só os textos. */
  subject?: ZoneSubject;
  onPreserveChange: (value: boolean) => void;
  onApply: () => void;
  /**
   * Sair da edição. Omitido quando não há para onde sair: na tela da
   * fotografia, a marcação de zonas é o ecrã todo, não um modo dele.
   */
  onClose?: () => void;
}) {
  const copy = SUBJECTS[subject];
  const zones = editor.zones;
  const missing = zones.findIndex(
    (zone) => (editor.extras[zone.id]?.comment.trim().length ?? 0) < 3,
  );
  const ready = zones.length > 0 && missing < 0 && !busy;

  return (
    <aside
      aria-label="Edição por zonas"
      // Por baixo da arte quando o palco é estreito; ao lado, e preso ao
      // topo, quando há largura. Ver o `@container` em `ArtworkView`.
      className="edge-top flex w-full max-w-[36rem] flex-col rounded-[16px] bg-ink-900/90 ring-1 ring-line backdrop-blur-sm @3xl:sticky @3xl:top-0 @3xl:w-[20rem] @3xl:max-w-none @3xl:shrink-0"
    >
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div>
          <h2 className="text-[14px] font-semibold text-fg">Editar por zonas</h2>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-fg-muted">
            Pinta por cima do que queres mudar e diz o que queres lá.
          </p>
        </div>
        {onClose ? (
          <IconButton label="Sair da edição" size="sm" onClick={onClose}>
            <X className="size-4" aria-hidden />
          </IconButton>
        ) : null}
      </div>

      {/* Ferramentas */}
      <div className="flex items-center gap-1.5 border-y border-line px-4 py-2.5">
        <span className="mr-1 text-[11px] font-medium text-fg-faint">Pincel</span>
        {BRUSH_SIZES.map((size, index) => {
          const active = Math.abs(editor.brush - size.value) < 0.0001;
          return (
            <button
              key={size.id}
              type="button"
              aria-label={`Pincel ${size.label.toLowerCase()}`}
              aria-pressed={active}
              title={`Pincel ${size.label.toLowerCase()}`}
              onClick={() => editor.setBrush(size.value)}
              className={cn(
                'grid size-7 place-items-center rounded-full transition-colors',
                active ? 'bg-neon/15 ring-1 ring-neon/60' : 'hover:bg-ink-800',
              )}
            >
              <span
                className={cn('rounded-full', active ? 'bg-neon' : 'bg-fg-muted')}
                style={{ width: 4 + index * 4, height: 4 + index * 4 }}
              />
            </button>
          );
        })}
        <span aria-hidden className="mx-1.5 h-4 w-px bg-line" />
        <IconButton
          label="Desfazer traço (Ctrl+Z)"
          size="sm"
          onClick={editor.undo}
          disabled={!editor.canUndo || busy}
        >
          <Undo2 className="size-3.5" aria-hidden />
        </IconButton>
        <IconButton
          label="Refazer traço (Ctrl+Shift+Z)"
          size="sm"
          onClick={editor.redo}
          disabled={!editor.canRedo || busy}
        >
          <Redo2 className="size-3.5" aria-hidden />
        </IconButton>
        <IconButton
          label="Limpar todas as zonas"
          size="sm"
          tone="danger"
          onClick={editor.clear}
          disabled={zones.length === 0 || busy}
          className="ml-auto"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </IconButton>
      </div>

      {/* Zonas */}
      {/*
        A lista rola por dentro, com uma altura que deixa o botão de aplicar
        sempre à vista num ecrã de portátil: com 30 rem, num ecrã de 900 px o
        painel passava a área de trabalho e o botão ficava por baixo do
        rodapé.
      */}
      <div className="scroll-neon flex max-h-[min(26rem,calc(100dvh-27rem))] min-h-[7rem] flex-col gap-2.5 overflow-y-auto px-4 py-3">
        {zones.length === 0 ? (
          <EmptyZones copy={copy} />
        ) : (
          zones.map((zone, index) => (
            <ZoneCard
              key={zone.id}
              number={index + 1}
              zone={zone}
              aspect={aspect}
              editor={editor}
              busy={busy}
              missing={missing === index}
              copy={copy}
            />
          ))
        )}
        {zones.length > 0 && zones.length < ZONE_LIMIT ? (
          <p className="px-1 text-[11px] leading-relaxed text-fg-faint">
            Pinta noutro sítio para abrir a zona {zones.length + 1}. Junto a uma zona, o traço
            junta-se a ela.
          </p>
        ) : null}
        {zones.length >= ZONE_LIMIT ? (
          <p className="px-1 text-[11px] leading-relaxed text-fg-faint">
            Máximo de {ZONE_LIMIT} zonas por edição. Aplica estas primeiro.
          </p>
        ) : null}
      </div>

      {/* Aplicar */}
      <div className="flex flex-col gap-3 border-t border-line px-4 pb-4 pt-3">
        <Switch
          checked={preserve}
          onChange={onPreserveChange}
          label="Só dentro das zonas"
          description={
            preserve
              ? copy.preserved
              : 'A IA pode ajustar à volta das zonas para a alteração encaixar.'
          }
          disabled={busy}
        />
        <Button
          variant="primary"
          size="lg"
          block
          loading={busy}
          disabled={!ready}
          onClick={onApply}
          className={ready ? 'glow-neon' : undefined}
        >
          <Sparkles className="size-4" aria-hidden />
          {zones.length <= 1 ? 'Aplicar alteração' : `Aplicar ${zones.length} alterações`}
        </Button>
        <p className="text-center text-[11px] leading-relaxed text-fg-faint">
          {zones.length === 0
            ? 'Marca pelo menos uma zona.'
            : missing >= 0
              ? `Falta dizer o que queres na zona ${missing + 1}.`
              : copy.after}
        </p>
      </div>
    </aside>
  );
}

function ZoneCard({
  number,
  zone,
  aspect,
  editor,
  busy,
  missing,
  copy,
}: {
  number: number;
  zone: ZoneShape;
  aspect: number;
  editor: ZoneEditor;
  busy: boolean;
  missing: boolean;
  copy: (typeof SUBJECTS)[ZoneSubject];
}) {
  const extras = editor.extras[zone.id] ?? { comment: '', image: null };
  const active = editor.activeId === zone.id;
  const textarea = React.useRef<HTMLTextAreaElement>(null);
  const file = React.useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = React.useState<string | null>(null);
  const position = zonePosition(zone, aspect);
  const bounds = zoneBounds(zone, aspect);
  const huge = bounds ? bounds.w * bounds.h > 0.55 : false;

  /*
    A zona acabada de pintar recebe o foco: o passo seguinte é escrever.

    Sem rolar a página. Com o painel por baixo da arte, rolar até ao campo
    tirava a arte do ecrã a meio da marcação — e o cliente quase sempre
    pinta duas ou três zonas seguidas antes de escrever.
  */
  React.useEffect(() => {
    if (editor.createdId === zone.id) textarea.current?.focus({ preventScroll: true });
  }, [editor.createdId, zone.id]);

  function suggest(text: string) {
    const current = extras.comment.trim();
    const next = current ? `${current} ${text}` : text;
    editor.setComment(zone.id, next.slice(0, 400));
    requestAnimationFrame(() => {
      const element = textarea.current;
      if (!element) return;
      element.focus();
      // Em «», o cursor fica entre as aspas: é aí que vai o texto novo.
      const caret = next.endsWith('«»') ? next.length - 1 : next.length;
      element.setSelectionRange(caret, caret);
    });
  }

  async function attach(files: FileList | null) {
    const picked = files?.[0];
    if (file.current) file.current.value = '';
    if (!picked) return;
    const check = checkImageFile(picked);
    if (!check.ok) {
      setImageError(check.reason);
      return;
    }
    setImageError(null);
    try {
      const reduced = await downscaleImageBlob(picked, 1024, 0.9, { reencode: true });
      editor.setImage(zone.id, { dataUrl: await blobToDataUrl(reduced.blob), name: picked.name });
    } catch {
      setImageError('Não foi possível ler esta imagem.');
    }
  }

  return (
    <div
      onFocusCapture={() => editor.setActiveId(zone.id)}
      onClick={() => editor.setActiveId(zone.id)}
      className={cn(
        'rounded-[12px] bg-ink-950/60 p-3 ring-1 transition-[box-shadow,background-color] duration-150',
        active ? 'ring-neon/50 shadow-[0_0_0_3px_rgba(191,248,57,0.08)]' : 'ring-line',
        missing && !active && 'ring-warn/40',
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'grid size-5 shrink-0 place-items-center rounded-full text-[10.5px] font-bold tabular-nums',
            active ? 'bg-neon text-ink-950' : 'bg-ink-800 text-neon ring-1 ring-neon/30',
          )}
        >
          {number}
        </span>
        <p className="min-w-0 flex-1 text-[11px] leading-snug text-fg-muted">
          <span className="font-semibold text-fg">Zona {number}</span>
          {position ? ` · ${position.replace(/\s*\(.*\)$/, '')}` : ''}
        </p>
        <IconButton
          label={`Apagar a zona ${number}`}
          size="sm"
          tone="danger"
          onClick={(event) => {
            event.stopPropagation();
            editor.removeZone(zone.id);
          }}
          disabled={busy}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </IconButton>
      </div>

      <label className="sr-only" htmlFor={`zona-${zone.id}`}>
        O que queres mudar na zona {number}
      </label>
      <textarea
        id={`zona-${zone.id}`}
        ref={textarea}
        rows={2}
        maxLength={400}
        value={extras.comment}
        disabled={busy}
        onChange={(event) => editor.setComment(zone.id, event.target.value)}
        placeholder="O que queres mudar aqui?"
        className="mt-2 w-full resize-none rounded-[9px] bg-ink-900 px-2.5 py-2 text-[12.5px] leading-relaxed text-fg outline-none ring-1 ring-line transition-shadow placeholder:text-fg-faint focus:ring-neon/40"
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.label}
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              suggest(suggestion.text);
            }}
            className="rounded-full bg-ink-800 px-2 py-0.5 text-[10.5px] font-medium text-fg-muted ring-1 ring-line transition-colors hover:text-fg hover:ring-neon/40 disabled:opacity-50"
          >
            {suggestion.label}
          </button>
        ))}
      </div>

      {/* Material opcional: "troca por este produto". */}
      <div className="mt-2.5">
        {extras.image ? (
          <div className="flex items-center gap-2 rounded-[9px] bg-ink-900 p-1.5 ring-1 ring-line">
            <img
              src={extras.image.dataUrl}
              alt=""
              className="size-9 rounded-[6px] object-cover ring-1 ring-line"
            />
            <span className="min-w-0 flex-1 truncate text-[11px] text-fg-muted">
              {extras.image.name}
            </span>
            <IconButton
              label="Tirar a imagem"
              size="sm"
              onClick={() => editor.setImage(zone.id, null)}
              disabled={busy}
            >
              <X className="size-3.5" aria-hidden />
            </IconButton>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              file.current?.click();
            }}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-fg-faint transition-colors hover:text-neon disabled:opacity-50"
          >
            <ImagePlus className="size-3.5" aria-hidden />
            Juntar uma imagem para esta zona (opcional)
          </button>
        )}
        <input
          ref={file}
          type="file"
          accept={APP.uploads.acceptedImageMimes.join(',')}
          className="hidden"
          onChange={(event) => void attach(event.target.files)}
        />
        {imageError ? (
          <p role="alert" className="mt-1 text-[11px] text-danger">
            {imageError}
          </p>
        ) : null}
      </div>

      {/*
        Uma linha, não uma caixa: já estamos dentro do cartão da zona, que
        está dentro do painel, e um terceiro rectângulo era ruído. O tom fica
        no ícone; o texto é o cinzento de leitura do cartão — em âmbar, a
        10,5 px, cansava e lia-se como erro quando é só um conselho.
      */}
      {huge ? (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-fg-muted">
          <AlertTriangle className="mt-[0.3em] size-3 shrink-0 text-warn/90" aria-hidden />
          {copy.huge}
        </p>
      ) : null}
    </div>
  );
}

/** O convite antes da primeira zona. */
function EmptyZones({ copy }: { copy: (typeof SUBJECTS)[ZoneSubject] }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[12px] border border-dashed border-line px-4 py-5 text-center">
      <svg viewBox="0 0 120 44" className="h-10 w-28" aria-hidden>
        <path
          d="M8 30 C 22 8, 36 40, 52 20 S 82 6, 96 24 S 108 34, 112 26"
          pathLength={100}
          fill="none"
          stroke="#BFF839"
          strokeOpacity={0.55}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={100}
          className="animate-[kriar-draw_2.6s_ease-in-out_infinite]"
          style={{ mixBlendMode: 'screen' }}
        />
      </svg>
      <p className="text-[12.5px] font-medium text-fg">{copy.paintOver}</p>
      <p className="text-[11px] leading-relaxed text-fg-muted">
        Marca o que queres mudar — um texto, um objecto, o fundo. Até {ZONE_LIMIT} zonas, cada
        uma com o seu pedido.
      </p>
      <p className="text-[10.5px] text-fg-faint">[ e ] mudam o pincel · Ctrl+Z desfaz</p>
    </div>
  );
}
