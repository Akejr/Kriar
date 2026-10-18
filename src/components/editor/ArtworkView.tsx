'use client';

import * as React from 'react';
import {
  BookmarkCheck,
  BookmarkPlus,
  Brush,
  Check,
  Download,
  Pencil,
  RefreshCw,
  RotateCcw,
  X,
} from 'lucide-react';
import type { ResolvedAsset } from '@/lib/composition/resolve';
import { finishInputFrom, type FinishedArtworkInput } from '@/lib/composition/finishArtwork';
import { BRUSH_SIZES } from '@/lib/composition/zones';
import { getFormat } from '@/lib/domain/catalog';
import type { Brand, Composition } from '@/lib/domain/types';
import type { ActionResult, ArtworkEditInput } from '@/store/editor';
import { cn } from '@/lib/utils/cn';
import { Button, Callout, Spinner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { usePaintedArt } from './usePaintedArt';
import { CompareSlider } from './zones/CompareSlider';
import { useZoneEditor } from './zones/useZoneEditor';
import { VersionStrip, versionNumbers } from './zones/VersionStrip';
import { ZoneCanvas } from './zones/ZoneCanvas';
import { ZonePanel, zonePosition } from './zones/ZonePanel';

/**
 * Arte final.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * A imagem é desenhada com `paintFinishedArtwork` — exactamente a mesma
 * função que a exportação usa. Não é uma aproximação em DOM: é o ficheiro,
 * mostrado em escala reduzida.
 *
 * Três modos sobre a mesma moldura:
 *
 *  · VER — a arte, as versões e as acções de sempre;
 *  · EDITAR — o cliente pinta as zonas a mudar e escreve o pedido de cada
 *    uma, num painel ao lado;
 *  · COMPARAR — antes e depois com uma divisória, depois de uma edição ou
 *    ao escolher uma versão antiga. É daqui que se repõe uma versão: ver as
 *    duas lado a lado antes de decidir.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function ArtworkView({
  composition,
  brand,
  assets,
  exporting,
  generating,
  onExport,
  onBackToReview,
  onRegenerate,
  onEdit,
  onRestoreVersion,
  inLibrary,
  libraryBusy,
  onToggleLibrary,
}: {
  composition: Composition;
  brand: Brand;
  assets: Record<string, ResolvedAsset | undefined>;
  exporting: boolean;
  generating: boolean;
  onExport: () => void;
  onBackToReview: () => void;
  onRegenerate: () => void;
  onEdit: (input: ArtworkEditInput) => Promise<ActionResult>;
  onRestoreVersion: (assetId: string) => void;
  /** A versão actual já está na biblioteca da marca? */
  inLibrary: boolean;
  libraryBusy: boolean;
  /** Junta a versão actual à biblioteca da marca, ou retira-a. */
  onToggleLibrary: () => void;
}) {
  const { show } = useToast();
  const format = getFormat(composition.format);
  const aspect = format.height / format.width;
  const editor = useZoneEditor();

  /*
    A altura REAL do palco, medida.

    A moldura ficava com `calc(100dvh - 15.5rem)`: uma estimativa do que
    sobrava depois do cabeçalho, das versões e da barra de baixo. Bastava um
    aviso no topo do editor, ou a barra partir em duas linhas, para a conta
    falhar — e foi o que cortou "Repor esta versão" no fundo do ecrã.
  */
  const stageRef = React.useRef<HTMLDivElement>(null);
  const stageHeight = useContentHeight(stageRef);

  const [mode, setMode] = React.useState<'ver' | 'editar'>('ver');
  const [preserve, setPreserve] = React.useState(true);
  /**
   * A versão aberta em comparação com a actual.
   *
   * `edicao` depois de uma edição acabada de aplicar: a pergunta é "fica?".
   * `versao` quando o cliente escolheu uma versão antiga na faixa.
   */
  const [compare, setCompare] = React.useState<{
    assetId: string;
    kind: 'edicao' | 'versao';
  } | null>(null);

  const finishInput = React.useMemo(
    () => finishInputFrom(composition, brand, assets),
    [composition, brand, assets],
  );
  const current = usePaintedArt(finishInput);

  // A versão em comparação, pintada com o mesmo acabamento e o mesmo recorte.
  const compareUrl = compare ? assets[compare.assetId]?.url : undefined;
  const compareInput = React.useMemo<FinishedArtworkInput | null>(
    () => (finishInput && compareUrl ? { ...finishInput, src: compareUrl } : null),
    [finishInput, compareUrl],
  );
  const other = usePaintedArt(compareInput);

  // Uma versão que deixou de existir (reposta, por exemplo) fecha a comparação.
  const history = composition.artwork.history;
  React.useEffect(() => {
    if (!compare) return;
    if (!history.some((version) => version.assetId === compare.assetId)) setCompare(null);
  }, [compare, history]);

  /*
    Atalhos do modo de edição, em captura.

    Ctrl+Z desfaz o último TRAÇO e não a última alteração da publicação:
    sem a captura, o atalho global do editor desfazia a arte inteira
    enquanto o cliente só queria apagar um risco.
  */
  const { undo, redo, setBrush, brush } = editor;
  React.useEffect(() => {
    if (mode !== 'editar') return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (typing) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && (key === 'z' || key === 'y')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (key === 'y' || event.shiftKey) redo();
        else undo();
      } else if (event.key === '[' || event.key === ']') {
        event.preventDefault();
        const index = BRUSH_SIZES.findIndex((size) => Math.abs(size.value - brush) < 0.0001);
        const next = Math.min(
          BRUSH_SIZES.length - 1,
          Math.max(0, (index < 0 ? 1 : index) + (event.key === ']' ? 1 : -1)),
        );
        setBrush(BRUSH_SIZES[next].value);
      } else if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        setMode('ver');
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [mode, undo, redo, setBrush, brush]);

  if (!finishInput) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="max-w-xs text-[13px] leading-relaxed text-fg-muted">
          Esta publicação ainda não tem arte gerada. Volta à revisão e gera.
        </p>
      </div>
    );
  }

  async function apply() {
    const previous = composition.artwork.assetId;
    const result = await onEdit({
      zones: editor.zones.map((zone) => ({
        shape: zone,
        comment: editor.extras[zone.id]?.comment ?? '',
        position: zonePosition(zone, aspect),
        image: editor.extras[zone.id]?.image?.dataUrl ?? null,
      })),
      preserveOutside: preserve,
    });
    if (result.ok) {
      editor.reset();
      setMode('ver');
      // Antes e depois, logo a seguir: a pergunta natural é "ficou melhor?".
      if (previous) setCompare({ assetId: previous, kind: 'edicao' });
    }
  }

  function onStroke(stroke: Parameters<typeof editor.addStroke>[0]) {
    const outcome = editor.addStroke(stroke, aspect);
    if (outcome === 'limite') {
      show({
        tone: 'aviso',
        message:
          'Já marcaste 4 zonas, o máximo por edição. Pinta junto a uma delas para a alargar, ou aplica estas primeiro.',
      });
    }
  }

  const editing = mode === 'editar' && !compare;
  // Os mesmos números que a faixa de versões mostra.
  const numbers = versionNumbers(composition.artwork);
  const versionNumber = (assetId: string) => numbers.get(assetId) ?? null;
  const origin =
    composition.finish.overlayLogo || composition.finish.overlayContacts
      ? 'logótipo e contactos aplicados por cima'
      : composition.artwork.origin === 'edicao'
        ? 'editada por zonas e verificada por IA'
        : 'gerada e verificada por IA';

  /*
    A moldura cabe sempre no palco, também na altura.

    Com a largura como único limite, um story (9:16) ficava mais alto do que
    a área de trabalho: para pintar a parte de baixo era preciso rolar a
    meio do traço. A altura vem medida; enquanto não há medida, fica a
    estimativa antiga.
  */
  const fitHeight =
    stageHeight !== null
      ? `${Math.max(160, Math.floor(stageHeight / aspect))}px`
      : `calc((100dvh - 15.5rem) / ${aspect.toFixed(4)})`;
  const artMaxWidth = `min(100%, ${Math.round(format.width * 0.52)}px, ${fitHeight})`;

  async function restoreCompared() {
    if (!compare) return;
    onRestoreVersion(compare.assetId);
    setCompare(null);
    show({
      tone: 'sucesso',
      message:
        compare.kind === 'edicao'
          ? 'Voltámos à versão anterior. A edição ficou guardada nas versões.'
          : 'Versão reposta. A que estava ficou guardada nas versões.',
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/*
        A arte e o painel das zonas lado a lado só quando há LARGURA para
        isso — medida no próprio palco (`@container`), não no ecrã.

        O palco muda de largura com o ajustador do painel de criação: num
        ecrã de 1440 px com o painel aberto ao máximo sobram 800 px, e uma
        regra pelo ecrã punha a arte e o painel lado a lado num espaço onde
        a arte ficava com cem píxeis.
      */}
      <div
        ref={stageRef}
        className="@container relative flex min-h-0 flex-1 overflow-auto p-5"
      >
        <div
          className={cn(
            'm-auto flex w-full flex-col items-center gap-5',
            editing && '@3xl:flex-row @3xl:items-start @3xl:justify-center',
          )}
        >
          <div
            className={cn('relative w-full', editing && '@3xl:min-w-0 @3xl:flex-1')}
            style={{ maxWidth: artMaxWidth }}
          >
            <div
              className={cn(
                'relative overflow-hidden rounded-[4px] bg-ink-900 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.95)] ring-1 transition-shadow duration-200',
                editing ? 'ring-neon/45' : 'ring-line-strong',
              )}
              style={{ aspectRatio: `${format.width} / ${format.height}` }}
            >
              {compare && other.url && current.url ? (
                <CompareSlider
                  before={other.url}
                  after={current.url}
                  beforeLabel={
                    compare.kind === 'edicao'
                      ? 'Antes'
                      : `Versão ${versionNumber(compare.assetId) ?? ''}`.trim()
                  }
                  afterLabel={compare.kind === 'edicao' ? 'Depois' : 'Actual'}
                />
              ) : current.url ? (
                <img
                  src={current.url}
                  alt={`Arte final: ${composition.texts.headline?.value ?? 'publicação'}`}
                  className="absolute inset-0 size-full"
                  draggable={false}
                />
              ) : null}

              {editing ? (
                <ZoneCanvas
                  zones={editor.zones}
                  activeId={editor.activeId}
                  brush={editor.brush}
                  aspect={aspect}
                  disabled={generating}
                  onStroke={onStroke}
                  onSelectZone={editor.setActiveId}
                />
              ) : null}

              {/* O convite, enquanto não há nenhuma zona. */}
              {editing && editor.zones.length === 0 && !generating ? (
                <span className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                  <span className="flex items-center gap-1.5 rounded-full bg-ink-950/80 px-3 py-1.5 text-[11.5px] font-medium text-fg ring-1 ring-neon/40 backdrop-blur-sm animate-[kriar-rise_0.25s_var(--ease-out-soft)]">
                    <Brush className="size-3.5 text-neon" aria-hidden />
                    Pinta por cima do que queres mudar
                  </span>
                </span>
              ) : null}

              {current.painting || (compare && !other.url) ? (
                <div className="absolute inset-0 grid place-items-center bg-ink-900/70 backdrop-blur-sm">
                  <Spinner label="A compor o acabamento…" />
                </div>
              ) : null}
            </div>
          </div>

          {editing ? (
            <ZonePanel
              editor={editor}
              aspect={aspect}
              busy={generating}
              preserve={preserve}
              onPreserveChange={setPreserve}
              onApply={() => void apply()}
              onClose={() => setMode('ver')}
            />
          ) : null}
        </div>
      </div>

      {/*
        A arte ou o logótipo não carregaram.

        Aviso da casa, e não a faixa âmbar de antes: o problema é real, mas
        quem resolve é o botão de gerar ali em baixo — um bloco amarelo por
        cima dele roubava-lhe o olhar. `status` porque aparece depois de a
        pintura acabar, sem acção do cliente: quem usa leitor de ecrã tem de
        saber que a imagem à vista não é a arte toda.
      */}
      {current.problem ? (
        <div className="shrink-0 px-5 pb-1">
          <Callout tone="warn" size="sm" role="status">
            {current.problem}
          </Callout>
        </div>
      ) : null}

      {!editing ? (
        <VersionStrip
          artwork={composition.artwork}
          assets={assets}
          selected={compare?.kind === 'versao' ? compare.assetId : null}
          onSelect={(assetId) => setCompare({ assetId, kind: 'versao' })}
        />
      ) : null}

      <div className="@container relative flex shrink-0 flex-wrap items-center gap-2.5 px-5 py-3">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-line to-transparent"
        />

        {/*
          A COMPARAÇÃO decide-se aqui, na barra de baixo.

          Estava numa barra própria por baixo da arte, e a moldura era
          calculada sem lhe reservar espaço: numa arte estreita a barra partia
          em duas linhas e "Repor esta versão" saía do ecrã. A barra de baixo
          tem sempre lugar. Enquanto se compara, as outras acções saem — a
          pergunta é uma só: fica esta ou a outra?
        */}
        {compare ? (
          <>
            <p
              className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-fg-muted"
              aria-live="polite"
            >
              {compare.kind === 'edicao'
                ? 'Arrasta a divisória para comparar com a versão anterior.'
                : `A comparar a versão ${versionNumber(compare.assetId) ?? ''} com a actual. Arrasta a divisória.`}
            </p>
            {compare.kind === 'edicao' ? (
              <>
                <Button variant="ghost" onClick={() => void restoreCompared()}>
                  <RotateCcw className="size-3.5" aria-hidden />
                  Voltar à anterior
                </Button>
                <Button variant="primary" onClick={() => setCompare(null)}>
                  <Check className="size-3.5" aria-hidden />
                  Manter a edição
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setCompare(null)}>
                  <X className="size-3.5" aria-hidden />
                  Fechar
                </Button>
                <Button variant="primary" onClick={() => void restoreCompared()}>
                  <RotateCcw className="size-3.5" aria-hidden />
                  Repor esta versão
                </Button>
              </>
            )}
          </>
        ) : (
          <>
            <p
              className="min-w-0 flex-1 truncate text-[11.5px] text-fg-faint"
              title={`${format.width} × ${format.height} · ${origin}`}
            >
              {format.width} × {format.height} · {origin}
            </p>

            {mode === 'editar' ? (
              <Button variant="ghost" onClick={() => setMode('ver')} disabled={generating}>
                <X className="size-3.5" aria-hidden />
                Sair da edição
              </Button>
            ) : (
              <>
                {/*
                  A biblioteca da marca, só pelo botão.

                  Uma arte descarregada não entra sozinha: nem tudo o que se
                  descarrega é exemplar. É o cliente que diz "esta representa
                  a minha marca".
                */}
                <Button
                  variant="ghost"
                  onClick={onToggleLibrary}
                  loading={libraryBusy}
                  disabled={generating}
                  aria-pressed={inLibrary}
                  title={
                    inLibrary
                      ? 'Esta arte está na biblioteca da marca. Clica para a retirar.'
                      : 'Guarda esta arte como referência: as próximas publicações aprendem com ela, sem a copiar.'
                  }
                  className={inLibrary ? 'text-neon hover:text-neon' : undefined}
                >
                  {inLibrary ? (
                    <BookmarkCheck className="size-3.5" aria-hidden />
                  ) : (
                    <BookmarkPlus className="size-3.5" aria-hidden />
                  )}
                  {/* O rótulo inteiro só quando a barra tem largura para ele. */}
                  <span className="hidden @5xl:inline">
                    {inLibrary ? 'Na biblioteca da marca' : 'Usar como referência da marca'}
                  </span>
                  <span className="@5xl:hidden">{inLibrary ? 'Na biblioteca' : 'Referência'}</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCompare(null);
                    setMode('editar');
                  }}
                  disabled={generating}
                >
                  <Brush className="size-3.5" aria-hidden />
                  Editar uma zona
                </Button>
                <Button variant="ghost" onClick={onBackToReview} disabled={generating}>
                  <Pencil className="size-3.5" aria-hidden />
                  Corrigir
                </Button>
                <Button variant="secondary" loading={generating} onClick={onRegenerate}>
                  <RefreshCw className="size-3.5" aria-hidden />
                  Gerar outra
                </Button>
              </>
            )}
            <Button variant="primary" loading={exporting} onClick={onExport} className="glow-neon">
              <Download className="size-4" aria-hidden />
              Descarregar PNG
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * A altura do conteúdo de um elemento, sem o enchimento, sempre actual.
 *
 * O palco é `flex-1` numa coluna de altura fixa: a altura dele vem do
 * ecrã, não do que tem dentro, e medi-lo não cria um ciclo.
 */
function useContentHeight(ref: React.RefObject<HTMLElement | null>): number | null {
  const [height, setHeight] = React.useState<number | null>(null);
  React.useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.height);
      setHeight((current) => (current === next ? current : next));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}

