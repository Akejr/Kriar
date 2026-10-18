'use client';

import * as React from 'react';
import {
  DEFAULT_BRUSH,
  ZONE_LIMIT,
  zoneHit,
  type ZoneShape,
  type ZoneStroke,
} from '@/lib/composition/zones';
import { newId } from '@/lib/utils/id';

/** O que o cliente escreveu e juntou a cada zona. */
export type ZoneExtras = {
  comment: string;
  image: { dataUrl: string; name: string } | null;
};

/**
 * Estado do editor de zonas.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Duas camadas, e a separação é o que torna o desfazer previsível:
 *
 *  · os TRAÇOS de cada zona entram no histórico de desfazer/refazer;
 *  · os PEDIDOS (o texto e a imagem de cada zona) não entram.
 *
 * Se os pedidos entrassem, desfazer o último traço apagava também o que o
 * cliente escreveu depois dele. Ficam guardados pela identidade da zona: se
 * uma zona desaparece ao desfazer e volta ao refazer, volta com o pedido.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function useZoneEditor() {
  const [zones, setZonesState] = React.useState<ZoneShape[]>([]);
  const [extras, setExtras] = React.useState<Record<string, ZoneExtras>>({});
  const [activeId, setActiveId] = React.useState<string | null>(null);
  /** A zona acabada de criar: o cartão dela recebe o foco. */
  const [createdId, setCreatedId] = React.useState<string | null>(null);
  const [brush, setBrush] = React.useState<number>(DEFAULT_BRUSH);

  // A verdade fica numa referência: dois traços seguidos não podem ler a
  // mesma versão antiga do estado.
  const current = React.useRef<ZoneShape[]>([]);
  const past = React.useRef<ZoneShape[][]>([]);
  const future = React.useRef<ZoneShape[][]>([]);
  // O tamanho das duas pilhas, em estado: os botões de desfazer e refazer
  // acendem e apagam com ele.
  const [depth, setDepth] = React.useState({ past: 0, future: 0 });

  const sync = React.useCallback((next: ZoneShape[]) => {
    current.current = next;
    setZonesState(next);
    setDepth({ past: past.current.length, future: future.current.length });
  }, []);

  const apply = React.useCallback(
    (next: ZoneShape[], record = true) => {
      if (record) {
        past.current = [...past.current, current.current].slice(-60);
        future.current = [];
      }
      sync(next);
    },
    [sync],
  );

  /**
   * Junta um traço: estende a zona onde começou, ou abre uma nova.
   *
   * Devolve `limite` quando já há quatro zonas e o traço caiu fora de
   * todas — quem chama avisa o cliente.
   */
  const addStroke = React.useCallback(
    (stroke: ZoneStroke, aspect: number): 'estendida' | 'criada' | 'limite' => {
      const zonesNow = current.current;
      const start = stroke.points[0];
      if (!start) return 'estendida';

      // A zona activa ganha os empates: é a que o cliente está a trabalhar.
      const candidates = activeId
        ? [...zonesNow.filter((zone) => zone.id === activeId), ...zonesNow]
        : zonesNow;
      const target = candidates.find((zone) => zoneHit(zone, start, stroke.size / 2, aspect));

      if (target) {
        apply(
          zonesNow.map((zone) =>
            zone.id === target.id ? { ...zone, strokes: [...zone.strokes, stroke] } : zone,
          ),
        );
        setActiveId(target.id);
        return 'estendida';
      }

      if (zonesNow.length >= ZONE_LIMIT) return 'limite';

      const id = newId('zona');
      apply([...zonesNow, { id, strokes: [stroke] }]);
      setExtras((map) => (map[id] ? map : { ...map, [id]: { comment: '', image: null } }));
      setActiveId(id);
      setCreatedId(id);
      return 'criada';
    },
    [activeId, apply],
  );

  const undo = React.useCallback(() => {
    const previous = past.current[past.current.length - 1];
    if (!previous) return;
    past.current = past.current.slice(0, -1);
    future.current = [current.current, ...future.current].slice(0, 60);
    apply(previous, false);
    setActiveId((id) =>
      id && previous.some((zone) => zone.id === id) ? id : (previous.at(-1)?.id ?? null),
    );
  }, [apply]);

  const redo = React.useCallback(() => {
    const next = future.current[0];
    if (!next) return;
    future.current = future.current.slice(1);
    past.current = [...past.current, current.current].slice(-60);
    apply(next, false);
    setActiveId((id) => (id && next.some((zone) => zone.id === id) ? id : (next.at(-1)?.id ?? null)));
  }, [apply]);

  const removeZone = React.useCallback(
    (id: string) => {
      apply(current.current.filter((zone) => zone.id !== id));
      setActiveId((active) => (active === id ? null : active));
    },
    [apply],
  );

  const clear = React.useCallback(() => {
    if (current.current.length === 0) return;
    apply([]);
    setActiveId(null);
  }, [apply]);

  /** Depois de aplicar: tudo limpo, histórico incluído. */
  const reset = React.useCallback(() => {
    past.current = [];
    future.current = [];
    sync([]);
    setExtras({});
    setActiveId(null);
    setCreatedId(null);
  }, [sync]);

  const setComment = React.useCallback((id: string, comment: string) => {
    setExtras((map) => ({ ...map, [id]: { comment, image: map[id]?.image ?? null } }));
  }, []);

  const setImage = React.useCallback((id: string, image: ZoneExtras['image']) => {
    setExtras((map) => ({ ...map, [id]: { comment: map[id]?.comment ?? '', image } }));
  }, []);

  return {
    zones,
    extras,
    activeId,
    createdId,
    brush,
    canUndo: depth.past > 0,
    canRedo: depth.future > 0,
    setBrush,
    setActiveId,
    addStroke,
    undo,
    redo,
    removeZone,
    clear,
    reset,
    setComment,
    setImage,
  };
}

export type ZoneEditor = ReturnType<typeof useZoneEditor>;
