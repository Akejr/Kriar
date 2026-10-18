'use client';

import * as React from 'react';
import {
  Download,
  Maximize2,
  Minus,
  MousePointerClick,
  Plus,
  Shuffle,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { ResolvedArtwork, ResolvedLayer } from '@/lib/composition/resolve';
import { getFormat } from '@/lib/domain/catalog';
import type { Composition } from '@/lib/domain/types';
import type { FontId } from '@/lib/fontCatalog';
import { cn } from '@/lib/utils/cn';
import { Button, Callout } from '@/components/ui/primitives';
import { SonarGrid } from '@/components/ui/SonarGrid';
import { FloatingToolbar } from './FloatingToolbar';
import { ModelCapabilities } from './ModelCapabilities';
import { Stage } from './Stage';
import { VisualDirectionNote } from './VisualDirectionNote';

const TOOLBAR_HEIGHT = 44;

export function RightPanel({
  artwork,
  composition,
  hasComposition,
  view,
  zoom,
  selectedLayerId,
  editingLayerId,
  planning,
  generating,
  exporting,
  backgroundMode,
  onSelect,
  onStartEdit,
  onCommitText,
  onCancelEdit,
  onMove,
  onResizeLayer,
  onFontChange,
  onSizeFactor,
  onWeightChange,
  onAlignLayer,
  onToggleLock,
  onResetLayer,
  onReplaceLayerImage,
  onZoomChange,
  onViewChange,
  onReshuffle,
  onGenerate,
  onExport,
  onVisualDirectionChange,
}: {
  artwork: ResolvedArtwork | null;
  composition: Composition;
  hasComposition: boolean;
  view: 'rascunho' | 'arte-final';
  zoom: number | 'fit';
  selectedLayerId: string | null;
  editingLayerId: string | null;
  planning: boolean;
  generating: boolean;
  exporting: boolean;
  backgroundMode: 'ia' | 'local' | null;
  onSelect: (layerId: string | null) => void;
  onStartEdit: (layerId: string) => void;
  onCommitText: (layerId: string, value: string) => void;
  onCancelEdit: () => void;
  onMove: (layerId: string, delta: { dx: number; dy: number }) => void;
  onResizeLayer: (layerId: string, factor: number) => void;
  onFontChange: (role: 'display' | 'body', font: FontId) => void;
  onSizeFactor: (layerId: string, factor: number) => void;
  onWeightChange: (layerId: string, weight: 400 | 700) => void;
  onAlignLayer: (layerId: string, align: 'left' | 'center' | 'right') => void;
  onToggleLock: (layerId: string) => void;
  onResetLayer: (layerId: string) => void;
  onReplaceLayerImage: (layerId: string, file: File) => void;
  onZoomChange: (zoom: number | 'fit') => void;
  onViewChange: (view: 'rascunho' | 'arte-final') => void;
  onReshuffle: () => void;
  onGenerate: () => void;
  onExport: () => void;
  onVisualDirectionChange: (text: string) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = React.useState({ width: 0, height: 0 });
  const format = getFormat(composition.format);

  React.useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitScale = React.useMemo(() => {
    if (viewport.width === 0 || viewport.height === 0) return 0.3;
    const padding = 72;
    return Math.min(
      (viewport.width - padding) / format.width,
      (viewport.height - padding) / format.height,
    );
  }, [viewport, format]);

  const scale = zoom === 'fit' ? Math.max(0.05, fitScale) : zoom;

  const selectedLayer: ResolvedLayer | null =
    artwork?.layers.find((layer) => layer.id === selectedLayerId && layer.selectable) ?? null;
  const hasFinalArt = Boolean(composition.background.assetId);
  const showToolbar = Boolean(selectedLayer) && editingLayerId !== selectedLayerId;

  // Posição da barra flutuante, em coordenadas do palco.
  const toolbarPosition = React.useMemo(() => {
    if (!selectedLayer || !artwork) return null;
    const stageWidth = artwork.width * scale;
    const centerX = (selectedLayer.x + selectedLayer.w / 2) * scale;
    const above = selectedLayer.y * scale - TOOLBAR_HEIGHT;
    return {
      left: Math.min(Math.max(centerX, 150), Math.max(150, stageWidth - 150)),
      // Perto do topo não cabe por cima: passa para baixo do elemento.
      top: above < 4 ? (selectedLayer.y + selectedLayer.h) * scale + 10 : above,
    };
  }, [selectedLayer, artwork, scale]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Barra do palco */}
      <div className="relative flex h-11 shrink-0 items-center gap-2 px-3">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-line to-transparent"
        />

        <div
          role="tablist"
          aria-label="Vista da publicação"
          className="flex rounded-[9px] bg-ink-900 p-0.5"
        >
          {(
            [
              { id: 'rascunho' as const, label: 'Rascunho' },
              { id: 'arte-final' as const, label: 'Arte final' },
            ] satisfies Array<{ id: 'rascunho' | 'arte-final'; label: string }>
          ).map((tab) => {
            const disabled = tab.id === 'arte-final' && !hasFinalArt;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={view === tab.id}
                disabled={disabled}
                title={disabled ? 'Gera a arte final para ver esta vista' : undefined}
                onClick={() => onViewChange(tab.id)}
                className={cn(
                  'rounded-[7px] px-3 py-1 text-[12px] font-medium transition-colors',
                  view === tab.id
                    ? 'bg-neon/15 text-neon'
                    : disabled
                      ? 'cursor-not-allowed text-fg-faint/60'
                      : 'text-fg-muted hover:text-fg',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/*
            O rótulo "Composição editável" abre o que o modelo monta, o que é
            gerado e o que ainda não faz. Afirmar que algo é editável sem
            dizer onde está a fronteira seria uma promessa vazia.
          */}
          {hasComposition && artwork ? (
            <ModelCapabilities template={artwork.template} className="hidden md:block" />
          ) : null}

          {hasComposition ? (
            <Button size="sm" variant="outline" onClick={onExport} loading={exporting}>
              <Download className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Descarregar PNG</span>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Palco */}
      <div
        ref={containerRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4"
      >
        {!hasComposition || !artwork ? (
          /*
            O campo de pontos só aparece enquanto não há arte. Por trás de uma
            publicação competiria com ela e confundiria o que é arte e o que é
            interface.

            O posicionamento absoluto fica NESTE invólucro, não no `SonarGrid`:
            o componente já declara `relative`, e duas utilidades `position` na
            mesma lista de classes entram em conflito — qual vence depende da
            ordem no CSS gerado, não da ordem em que foram escritas.
          */
          <div className="absolute inset-0">
            <SonarGrid
              className="flex size-full items-center justify-center"
              pingArea={[0.12, 0.15, 0.88, 0.85]}
              baseOpacity={0.24}
              dotRadius={1.5}
              pingEvery={3.4}
            >
              <span
                aria-hidden
                className="sonar-wash pointer-events-none absolute inset-0 -z-10"
              />
              <EmptyStage planning={planning} />
            </SonarGrid>
          </div>
        ) : (
          <div className="relative">
            <Stage
              artwork={artwork}
              scale={scale}
              // As duas vistas são editáveis. A diferença é o fundo: no
              // rascunho é o do modelo, na arte final é o gerado. Assim
              // corrigir o preço depois de gerar não obriga a refazer o fundo.
              interactive
              selectedLayerId={selectedLayerId}
              editingLayerId={editingLayerId}
              onSelect={onSelect}
              onStartEdit={onStartEdit}
              onCommitText={onCommitText}
              onCancelEdit={onCancelEdit}
              onMove={onMove}
              onResize={onResizeLayer}
              className="rounded-[3px] shadow-[0_32px_80px_-24px_rgba(0,0,0,0.95)] ring-1 ring-line-strong"
            />

            {showToolbar && selectedLayer && toolbarPosition ? (
              <div
                className="absolute z-30 -translate-x-1/2 animate-[kriar-rise_0.12s_var(--ease-out-soft)]"
                style={{ left: toolbarPosition.left, top: toolbarPosition.top }}
              >
                <FloatingToolbar
                  layer={selectedLayer}
                  composition={composition}
                  hasOverride={Boolean(composition.overrides[selectedLayer.id])}
                  onEdit={() => onStartEdit(selectedLayer.id)}
                  onFontChange={onFontChange}
                  onSizeFactor={(factor) => onSizeFactor(selectedLayer.id, factor)}
                  onWeightChange={(weight) => onWeightChange(selectedLayer.id, weight)}
                  onAlign={(align) => onAlignLayer(selectedLayer.id, align)}
                  onToggleLock={() => onToggleLock(selectedLayer.id)}
                  onReset={() => onResetLayer(selectedLayer.id)}
                  onReplaceImage={(file) => onReplaceLayerImage(selectedLayer.id, file)}
                />
              </div>
            ) : null}
          </div>
        )}

        {/* Dica e zoom */}
        {hasComposition && artwork ? (
          <>
            <p className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink-900/80 px-2.5 py-1 text-[11px] text-fg-faint backdrop-blur-sm sm:flex">
              <MousePointerClick className="size-3" aria-hidden />
              {selectedLayer
                ? 'Arrasta para mover · duplo clique para editar'
                : 'Clica num elemento para editar'}
            </p>

            <div className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-[9px] bg-ink-900/85 p-0.5 backdrop-blur-sm">
              <ZoomButton
                label="Reduzir zoom"
                onClick={() => onZoomChange(Math.max(0.05, scale / 1.2))}
              >
                <Minus className="size-3" aria-hidden />
              </ZoomButton>
              <span className="min-w-9 text-center text-[11px] tabular-nums text-fg-muted">
                {Math.round(scale * 100)}%
              </span>
              <ZoomButton
                label="Aumentar zoom"
                onClick={() => onZoomChange(Math.min(2, scale * 1.2))}
              >
                <Plus className="size-3" aria-hidden />
              </ZoomButton>
              <ZoomButton
                label="Ajustar à janela"
                active={zoom === 'fit'}
                onClick={() => onZoomChange('fit')}
              >
                <Maximize2 className="size-3" aria-hidden />
              </ZoomButton>
            </div>
          </>
        ) : null}
      </div>

      {/*
        Avisos da composição.

        ──────────────────────────────────────────────────────────────────
        Eram uma faixa âmbar com cada linha em texto âmbar e o seu próprio
        triângulo: por baixo da prévia, a faixa pesava mais do que a arte e
        do que os botões de gerar. Passaram a um aviso da casa — superfície
        de painel, um só chip de tom e o texto no cinzento de leitura.

        Um chip para a lista, não um por linha. Com dois ou três avisos, três
        triângulos seguidos liam-se como um alarme; o ponto discreto separa
        as linhas sem repetir o sinal.
        ──────────────────────────────────────────────────────────────────
      */}
      {hasComposition && artwork && artwork.warnings.length > 0 ? (
        <div className="shrink-0 px-3 pb-1">
          <Callout tone="warn" size="sm">
            {artwork.warnings.length === 1 ? (
              <p>{artwork.warnings[0].message}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {artwork.warnings.map((warning) => (
                  <li key={warning.id} className="flex gap-2">
                    <span
                      aria-hidden
                      className="mt-[0.64em] size-1 shrink-0 rounded-full bg-fg-faint"
                    />
                    {warning.message}
                  </li>
                ))}
              </ul>
            )}
          </Callout>
        </div>
      ) : null}

      {/* Barra de acções */}
      {hasComposition ? (
        <div className="relative flex shrink-0 flex-wrap items-center gap-3 px-3 py-2.5">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-line to-transparent"
          />

          <VisualDirectionNote
            value={composition.visualDirection}
            onChange={onVisualDirectionChange}
            backgroundMode={backgroundMode}
            className="min-w-0 flex-1"
          />

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" onClick={onReshuffle} loading={planning}>
              <Shuffle className="size-3.5" aria-hidden />
              Outra composição
            </Button>
            <Button
              variant="primary"
              onClick={onGenerate}
              loading={generating}
              className={!generating ? 'glow-neon' : undefined}
            >
              <Sparkles className="size-3.5" aria-hidden />
              {hasFinalArt ? 'Gerar novo fundo' : 'Gerar arte final'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ZoomButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      onClick={onClick}
      className={cn(
        'grid size-6 place-items-center rounded-[6px] transition-colors',
        active ? 'bg-neon/15 text-neon' : 'text-fg-muted hover:bg-ink-800 hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

function EmptyStage({ planning }: { planning: boolean }) {
  return (
    <div className="edge-top relative max-w-sm rounded-[16px] bg-ink-900/80 px-7 py-7 text-center shadow-[0_24px_60px_-28px_rgba(0,0,0,0.9)] ring-1 ring-line backdrop-blur-sm">
      <span
        className={cn(
          'mx-auto mb-4 grid size-11 place-items-center rounded-[13px] text-fg-faint ring-1 ring-line',
          planning
            ? 'animate-[kriar-pulse-soft_1.2s_ease-in-out_infinite] bg-neon/12 text-neon ring-neon/30'
            : 'bg-ink-800',
        )}
      >
        <Wand2 className="size-[1.1rem]" aria-hidden />
      </span>

      <h2 className="text-[14.5px] font-semibold text-fg">
        {planning ? 'A preparar a composição…' : 'A composição aparece aqui'}
      </h2>
      <p className="mx-auto mt-2 max-w-[17rem] text-[12.5px] leading-relaxed text-fg-muted">
        {planning
          ? 'É a estrutura real da publicação, não uma animação de espera.'
          : 'Descreve o que queres comunicar no painel ao lado. Podes ajustar tudo antes de gerar a arte.'}
      </p>

      {!planning ? (
        <ol className="mt-5 flex flex-col gap-1.5 text-left text-[11.5px] leading-relaxed text-fg-faint">
          {[
            'Escreve o pedido, com o preço se houver.',
            'Carrega as fotografias dos produtos.',
            'Ajusta clicando nos elementos da prévia.',
            'Gera o acabamento e descarrega o PNG.',
          ].map((step, index) => (
            <li key={step} className="flex gap-2">
              <span className="grid size-4 shrink-0 place-items-center rounded-full bg-ink-800 text-[9px] font-semibold text-fg-muted">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
