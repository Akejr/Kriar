'use client';

import * as React from 'react';
import { Lock } from 'lucide-react';
import type {
  LayerShadow,
  ResolvedArtwork,
  ResolvedLayer,
  ResolvedText,
} from '@/lib/composition/resolve';
import { cn } from '@/lib/utils/cn';

/**
 * Prévia interactiva.
 *
 * Desenha em DOM as MESMAS camadas que o canvas de exportação consome, com as
 * quebras de linha já decididas pelo motor. Daí o `white-space: pre` em cada
 * linha: o browser não pode voltar a decidir onde quebra, senão a prévia
 * deixaria de corresponder ao ficheiro exportado.
 *
 * Interacção: clicar selecciona, arrastar move, as alças dos cantos
 * redimensionam, duplo clique (ou Enter) edita o texto no lugar. Nada disto
 * entra na exportação, porque a arte é resolvida de novo em modo `final`.
 */

type PointerHandlers = {
  onPointerDown: (event: React.PointerEvent) => void;
  onPointerMove: (event: React.PointerEvent) => void;
  onPointerUp: (event: React.PointerEvent) => void;
  onPointerCancel: (event: React.PointerEvent) => void;
};

type DragState = { layerId: string; dx: number; dy: number };
type ResizeState = { layerId: string; factor: number };

export type StageProps = {
  artwork: ResolvedArtwork;
  scale: number;
  interactive?: boolean;
  selectedLayerId?: string | null;
  editingLayerId?: string | null;
  onSelect?: (layerId: string | null) => void;
  onStartEdit?: (layerId: string) => void;
  onCommitText?: (layerId: string, value: string) => void;
  onCancelEdit?: () => void;
  onMove?: (layerId: string, delta: { dx: number; dy: number }) => void;
  onResize?: (layerId: string, factor: number) => void;
  className?: string;
};

export function Stage({
  artwork,
  scale,
  interactive = false,
  selectedLayerId = null,
  editingLayerId = null,
  onSelect,
  onStartEdit,
  onCommitText,
  onCancelEdit,
  onMove,
  onResize,
  className,
}: StageProps) {
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const [resize, setResize] = React.useState<ResizeState | null>(null);

  // Os gestos também vivem numa referência: no `pointerup` precisamos do
  // valor mais recente, sem depender de o React já ter voltado a desenhar.
  const dragRef = React.useRef<{
    layerId: string;
    startX: number;
    startY: number;
    dx: number;
    dy: number;
    moved: boolean;
  } | null>(null);

  const resizeRef = React.useRef<{
    layerId: string;
    centerX: number;
    centerY: number;
    startDistance: number;
    factor: number;
  } | null>(null);

  function handlePointerDown(event: React.PointerEvent, layer: ResolvedLayer) {
    if (!interactive || !layer.selectable) return;
    if (editingLayerId === layer.id) return;
    if (event.button !== 0) return;

    onSelect?.(layer.id);
    dragRef.current = {
      layerId: layer.id,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      dy: 0,
      moved: false,
    };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent) {
    const state = dragRef.current;
    if (!state) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) < 3) return;
    state.moved = true;
    state.dx = dx;
    state.dy = dy;
    setDrag({ layerId: state.layerId, dx, dy });
  }

  function handlePointerUp(event: React.PointerEvent) {
    const state = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!state) return;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    if (!state.moved) return;

    // Converte o deslocamento no ecrã para unidades normalizadas da arte.
    onMove?.(state.layerId, {
      dx: state.dx / (artwork.width * scale),
      dy: state.dy / (artwork.height * scale),
    });
  }

  /**
   * Redimensionamento pelas alças.
   *
   * O factor é a razão entre a distância actual ao centro do elemento e a
   * distância no início do gesto. Isso dá um crescimento proporcional, que é
   * o único que faz sentido com o nosso modelo de escala centrada.
   */
  function handleResizeDown(event: React.PointerEvent, layer: ResolvedLayer) {
    if (!interactive) return;
    event.stopPropagation();
    const host = (event.currentTarget as HTMLElement).closest('[data-stage-surface]');
    const rect = host?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + (layer.x + layer.w / 2) * scale;
    const centerY = rect.top + (layer.y + layer.h / 2) * scale;
    const startDistance = Math.max(8, Math.hypot(event.clientX - centerX, event.clientY - centerY));

    resizeRef.current = { layerId: layer.id, centerX, centerY, startDistance, factor: 1 };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function handleResizeMove(event: React.PointerEvent) {
    const state = resizeRef.current;
    if (!state) return;
    const distance = Math.hypot(event.clientX - state.centerX, event.clientY - state.centerY);
    const factor = Math.min(2.2, Math.max(0.45, distance / state.startDistance));
    state.factor = factor;
    setResize({ layerId: state.layerId, factor });
  }

  function handleResizeUp(event: React.PointerEvent) {
    const state = resizeRef.current;
    resizeRef.current = null;
    setResize(null);
    if (!state) return;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    if (Math.abs(state.factor - 1) < 0.01) return;
    onResize?.(state.layerId, state.factor);
  }

  const selectedLayer =
    interactive && selectedLayerId
      ? artwork.layers.find((layer) => layer.id === selectedLayerId && layer.selectable)
      : undefined;

  return (
    <div
      data-stage-surface
      className={cn('relative select-none', className)}
      style={{ width: artwork.width * scale, height: artwork.height * scale }}
      onPointerDown={(event) => {
        if (interactive && event.target === event.currentTarget) onSelect?.(null);
      }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left overflow-hidden"
        style={{
          width: artwork.width,
          height: artwork.height,
          transform: `scale(${scale})`,
        }}
      >
        {artwork.layers.map((layer) => {
          const isEditing = editingLayerId === layer.id;
          const layerDrag = drag?.layerId === layer.id ? drag : null;
          const layerResize = resize?.layerId === layer.id ? resize : null;
          const layerHandlers: PointerHandlers | null =
            interactive && layer.selectable
              ? {
                  onPointerDown: (event: React.PointerEvent) => handlePointerDown(event, layer),
                  onPointerMove: handlePointerMove,
                  onPointerUp: handlePointerUp,
                  onPointerCancel: handlePointerUp,
                }
              : null;

          if (layer.kind === 'text') {
            return (
              <TextLayerView
                key={layer.id}
                layer={layer}
                scale={scale}
                interactive={interactive}
                editing={isEditing}
                drag={layerDrag}
                resize={layerResize}
                handlers={layerHandlers}
                onStartEdit={onStartEdit}
                onCommitText={onCommitText}
                onCancelEdit={onCancelEdit}
              />
            );
          }

          return (
            <ShapeLayerView
              key={layer.id}
              layer={layer}
              scale={scale}
              designWidth={artwork.width}
              drag={layerDrag}
              resize={layerResize}
              handlers={layerHandlers}
            />
          );
        })}

        {/* Margens de segurança, visíveis só durante um gesto. */}
        {interactive && (drag || resize) ? (
          <div
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              left: artwork.safeArea.x,
              top: artwork.safeArea.y,
              width: artwork.safeArea.w,
              height: artwork.safeArea.h,
              // Lê o token da interface: um verde escrito à mão aqui ficaria
              // dessincronizado na próxima alteração de paleta.
              border: `${Math.max(1, 2 / scale)}px dashed color-mix(in srgb, var(--color-neon) 45%, transparent)`,
            }}
          />
        ) : null}
      </div>

      {/* Selecção: contorno, alças e etiqueta. Em coordenadas de ecrã, para a
          espessura não depender do zoom. */}
      {selectedLayer && editingLayerId !== selectedLayer.id ? (
        <SelectionOverlay
          layer={selectedLayer}
          scale={scale}
          drag={drag?.layerId === selectedLayer.id ? drag : null}
          resize={resize?.layerId === selectedLayer.id ? resize : null}
          onHandleDown={(event) => handleResizeDown(event, selectedLayer)}
          onHandleMove={handleResizeMove}
          onHandleUp={handleResizeUp}
        />
      ) : null}
    </div>
  );
}

// --- Selecção ---------------------------------------------------------------

function labelOf(layer: ResolvedLayer): string {
  // O motor já traz o nome legível de cada camada selectionável, incluindo as
  // peças, que não têm papel de texto.
  return layer.label ?? 'Elemento';
}

function SelectionOverlay({
  layer,
  scale,
  drag,
  resize,
  onHandleDown,
  onHandleMove,
  onHandleUp,
}: {
  layer: ResolvedLayer;
  scale: number;
  drag: DragState | null;
  resize: ResizeState | null;
  onHandleDown: (event: React.PointerEvent) => void;
  onHandleMove: (event: React.PointerEvent) => void;
  onHandleUp: (event: React.PointerEvent) => void;
}) {
  const factor = resize?.factor ?? 1;
  const width = layer.w * scale * factor;
  const height = layer.h * scale * factor;
  const left = layer.x * scale + (layer.w * scale - width) / 2 + (drag?.dx ?? 0);
  const top = layer.y * scale + (layer.h * scale - height) / 2 + (drag?.dy ?? 0);

  const corners = [
    { key: 'tl', style: { left: -4, top: -4 }, cursor: 'nwse-resize' },
    { key: 'tr', style: { right: -4, top: -4 }, cursor: 'nesw-resize' },
    { key: 'bl', style: { left: -4, bottom: -4 }, cursor: 'nesw-resize' },
    { key: 'br', style: { right: -4, bottom: -4 }, cursor: 'nwse-resize' },
  ] as const;

  const locked = layer.kind === 'text' && layer.locked;

  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{
        left,
        top,
        width,
        height,
        outline: '1.5px solid var(--color-neon)',
        outlineOffset: 1,
      }}
    >
      {/* Etiqueta do elemento */}
      <span className="pointer-events-none absolute -top-[21px] left-0 flex items-center gap-1 whitespace-nowrap rounded-[5px] bg-neon px-1.5 py-[3px] text-[10px] font-semibold leading-none text-ink-950">
        {locked ? <Lock className="size-2.5" aria-hidden /> : null}
        {labelOf(layer)}
        {locked ? ' · protegido' : ''}
      </span>

      {corners.map((corner) => (
        <span
          key={corner.key}
          role="slider"
          tabIndex={-1}
          aria-label={`Redimensionar ${labelOf(layer)}`}
          aria-valuenow={Math.round(factor * 100)}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          className="pointer-events-auto absolute size-[9px] rounded-[2px] border border-ink-950 bg-neon"
          style={{ ...corner.style, cursor: corner.cursor }}
        />
      ))}
    </div>
  );
}

// --- Auxiliares -------------------------------------------------------------

function boxStyle(
  layer: ResolvedLayer,
  drag: DragState | null,
  resize: ResizeState | null,
  scale: number,
): React.CSSProperties {
  const transforms: string[] = [];
  if (drag) transforms.push(`translate(${drag.dx / scale}px, ${drag.dy / scale}px)`);
  if (resize) transforms.push(`scale(${resize.factor})`);

  return {
    position: 'absolute',
    left: layer.x,
    top: layer.y,
    width: layer.w,
    height: layer.h,
    transform: transforms.length > 0 ? transforms.join(' ') : undefined,
    transformOrigin: 'center',
  };
}

/**
 * Mesma sombra que o canvas desenha. Os valores vêm já calculados do motor,
 * por isso não há conversão nem arredondamento aqui.
 */
function shadowFilter(shadow: LayerShadow | null | undefined): string | undefined {
  if (!shadow) return undefined;
  return `drop-shadow(0 ${shadow.offsetY}px ${shadow.blur}px ${shadow.color})`;
}

function polygonClip(points: Array<{ x: number; y: number }>): string {
  return `polygon(${points.map((p) => `${p.x * 100}% ${p.y * 100}%`).join(', ')})`;
}

// --- Formas, imagens e marcadores -------------------------------------------

function ShapeLayerView({
  layer,
  scale,
  designWidth,
  drag,
  resize,
  handlers,
}: {
  layer: Exclude<ResolvedLayer, ResolvedText>;
  scale: number;
  designWidth: number;
  drag: DragState | null;
  resize: ResizeState | null;
  handlers: PointerHandlers | null;
}) {
  const box = boxStyle(layer, drag, resize, scale);

  // Formas selectionáveis existem desde que há peças: precisam dos mesmos
  // gestos que as imagens, e de nome acessível.
  const shapeInteraction = handlers
    ? {
        onPointerDown: handlers.onPointerDown,
        onPointerMove: handlers.onPointerMove,
        onPointerUp: handlers.onPointerUp,
        onPointerCancel: handlers.onPointerCancel,
        role: 'button' as const,
        tabIndex: 0,
        'aria-label': layer.label ?? 'Elemento',
      }
    : { 'aria-hidden': true as const };

  switch (layer.kind) {
    case 'rect':
      return (
        <div
          {...shapeInteraction}
          style={{
            ...box,
            backgroundColor: layer.fill,
            borderRadius: layer.radius,
            opacity: layer.opacity,
            filter: shadowFilter(layer.shadow),
            cursor: handlers ? 'move' : undefined,
          }}
        />
      );

    case 'ellipse':
      return (
        <div
          {...shapeInteraction}
          style={{
            ...box,
            backgroundColor: layer.fill,
            borderRadius: '50%',
            opacity: layer.opacity,
            filter: shadowFilter(layer.shadow),
            cursor: handlers ? 'move' : undefined,
          }}
        />
      );

    case 'polygon':
      /*
        Dois elementos, de propósito. Na ordem de composição do CSS o
        `clip-path` é aplicado DEPOIS do `filter`, pelo que uma sombra no
        mesmo elemento seria recortada pela própria silhueta e desapareceria.
        Com o recorte no filho e o filtro no pai, a sombra é calculada a
        partir do resultado já recortado — como no canvas, que desenha o
        caminho do polígono com `shadowBlur`.
      */
      return (
        <div
          {...shapeInteraction}
          style={{
            ...box,
            opacity: layer.opacity,
            filter: shadowFilter(layer.shadow),
            cursor: handlers ? 'move' : undefined,
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              backgroundColor: layer.fill,
              clipPath: polygonClip(layer.points),
            }}
          />
        </div>
      );

    case 'gradient': {
      const direction =
        layer.direction === 'to-bottom'
          ? 'to bottom'
          : layer.direction === 'to-top'
            ? 'to top'
            : layer.direction === 'to-right'
              ? 'to right'
              : 'to left';
      return (
        <div
          aria-hidden
          style={{
            ...box,
            backgroundImage: `linear-gradient(${direction}, ${layer.from}, ${layer.to})`,
          }}
        />
      );
    }

    case 'placeholder':
      return (
        <div
          onPointerDown={handlers?.onPointerDown}
          onPointerMove={handlers?.onPointerMove}
          onPointerUp={handlers?.onPointerUp}
          onPointerCancel={handlers?.onPointerCancel}
          role={handlers ? 'button' : undefined}
          tabIndex={handlers ? 0 : undefined}
          aria-label={handlers ? `Compartimento: ${layer.label}` : undefined}
          style={{
            ...box,
            backgroundColor: layer.fill,
            border: `${Math.max(1, 2 / scale)}px dashed ${layer.stroke}`,
            borderRadius: layer.shape === 'ellipse' ? '50%' : layer.radius,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: handlers ? 'pointer' : 'default',
          }}
        >
          <span
            style={{
              fontSize: Math.max(13, layer.w * 0.045),
              color: layer.stroke,
              textAlign: 'center',
              padding: '0 6%',
              lineHeight: 1.3,
            }}
          >
            {layer.label}
          </span>
        </div>
      );

    case 'image': {
      // Mesmos valores que `renderCanvas.ts`, para a sombra coincidir.
      const blur = designWidth * 0.035;
      const offsetY = designWidth * 0.014;
      const useShadow = layer.shadow && !layer.clip;

      return (
        <div
          onPointerDown={handlers?.onPointerDown}
          onPointerMove={handlers?.onPointerMove}
          onPointerUp={handlers?.onPointerUp}
          onPointerCancel={handlers?.onPointerCancel}
          role={handlers ? 'button' : undefined}
          tabIndex={handlers ? 0 : undefined}
          aria-label={handlers ? layer.label : undefined}
          style={{
            ...box,
            overflow: layer.clip ? 'hidden' : 'visible',
            borderRadius: layer.shape === 'ellipse' ? '50%' : layer.radius,
            cursor: handlers ? 'move' : 'default',
            filter: useShadow
              ? `drop-shadow(0 ${offsetY}px ${blur}px rgba(0, 0, 0, 0.3))`
              : undefined,
          }}
        >
          <img
            src={layer.src}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              left: layer.draw.dx - layer.x,
              top: layer.draw.dy - layer.y,
              width: layer.draw.dw,
              height: layer.draw.dh,
              pointerEvents: 'none',
            }}
          />
        </div>
      );
    }

    default:
      return null;
  }
}

// --- Texto ------------------------------------------------------------------

function TextLayerView({
  layer,
  scale,
  interactive,
  editing,
  drag,
  resize,
  handlers,
  onStartEdit,
  onCommitText,
  onCancelEdit,
}: {
  layer: ResolvedText;
  scale: number;
  interactive: boolean;
  editing: boolean;
  drag: DragState | null;
  resize: ResizeState | null;
  handlers: PointerHandlers | null;
  onStartEdit?: (layerId: string) => void;
  onCommitText?: (layerId: string, value: string) => void;
  onCancelEdit?: () => void;
}) {
  const [draft, setDraft] = React.useState(layer.rawValue);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const box = boxStyle(layer, drag, resize, scale);

  React.useEffect(() => {
    if (!editing) return;
    setDraft(layer.rawValue);
    const frame = requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [editing, layer.rawValue]);

  const typography: React.CSSProperties = {
    fontFamily: layer.fontFamily,
    fontSize: layer.fontSize,
    fontWeight: layer.fontWeight,
    letterSpacing: layer.tracking ? `${layer.tracking}px` : undefined,
    color: layer.color,
    textAlign: layer.align,
  };

  if (editing) {
    return (
      <div style={{ ...box, zIndex: 40, height: 'auto', minHeight: layer.h }}>
        <textarea
          ref={textareaRef}
          value={draft}
          aria-label={`Editar ${layer.label}`}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => onCommitText?.(layer.id, draft)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onCancelEdit?.();
              return;
            }
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onCommitText?.(layer.id, draft);
            }
          }}
          style={{
            ...typography,
            width: '100%',
            minHeight: layer.h,
            lineHeight: `${layer.lineHeightPx}px`,
            background: 'rgba(0, 0, 0, 0.18)',
            border: `${Math.max(1.5, 2 / scale)}px solid var(--color-neon)`,
            borderRadius: Math.max(3, 6 / scale),
            padding: 0,
            resize: 'none',
            outline: 'none',
            overflow: 'hidden',
            textTransform: layer.uppercase ? 'uppercase' : undefined,
          }}
        />
      </div>
    );
  }

  return (
    <div
      onPointerDown={handlers?.onPointerDown}
      onPointerMove={handlers?.onPointerMove}
      onPointerUp={handlers?.onPointerUp}
      onPointerCancel={handlers?.onPointerCancel}
      role={handlers ? 'button' : undefined}
      tabIndex={handlers ? 0 : undefined}
      aria-label={handlers ? `${layer.label}: ${layer.lines.join(' ')}` : undefined}
      onDoubleClick={interactive ? () => onStartEdit?.(layer.id) : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === 'Enter' || event.key === 'F2') {
                event.preventDefault();
                onStartEdit?.(layer.id);
              }
            }
          : undefined
      }
      style={{ ...box, cursor: handlers ? 'move' : 'default' }}
    >
      {layer.lines.map((line, index) => (
        <div
          key={`${layer.id}-${index}`}
          style={{
            ...typography,
            height: layer.lineHeightPx,
            lineHeight: `${layer.lineHeightPx}px`,
            // As quebras vêm do motor: o browser não pode voltar a decidir.
            whiteSpace: 'pre',
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}
