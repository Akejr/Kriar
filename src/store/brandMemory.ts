'use client';

import * as React from 'react';
import { appendMemoryEvent, applyLearnedRules, memoryNeedsLearning } from '@/lib/brand/memory';
import type { Brand } from '@/lib/domain/types';
import type { MemoryEventInput } from './editor';
import { useSession } from './session';

/**
 * Marcas com uma leitura da memória em curso.
 *
 * Ao nível do módulo e não do componente: o editor e a página da marca usam
 * este hook ao mesmo tempo, e duas leituras da mesma memória em paralelo
 * pagavam duas vezes pelo mesmo resultado.
 */
const learning = new Set<string>();

/**
 * A memória da empresa, do lado do browser.
 *
 * `record` junta um acontecimento e, quando há acontecimentos novos que
 * cheguem, pede uma leitura em segundo plano. `learn` pede-a já.
 */
export function useBrandMemory() {
  const { updateBrand } = useSession();

  const learn = React.useCallback(
    async (brand: Brand): Promise<{ ok: boolean; error?: string }> => {
      const memory = brand.identity.memory;
      if (!memory || memory.events.length === 0) {
        return { ok: false, error: 'Ainda não há uso suficiente para aprender.' };
      }
      if (learning.has(brand.id)) return { ok: false, error: 'Já estamos a actualizar a memória.' };
      learning.add(brand.id);
      const consumed = memory.pending;
      try {
        const response = await fetch('/api/brand/memory', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            company: {
              name: brand.company.name,
              segment: brand.company.segment,
              description: brand.company.description,
            },
            rules: memory.rules.map((rule) => ({ text: rule.text, source: rule.source })),
            dismissed: memory.dismissed,
            events: memory.events.map((event) => ({
              kind: event.kind,
              at: event.at,
              detail: event.detail,
            })),
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.ok || !Array.isArray(data.rules)) {
          throw new Error(data?.error ?? 'Não foi possível actualizar a memória.');
        }
        await updateBrand(brand.id, (latest) => ({
          ...latest,
          identity: {
            ...latest.identity,
            memory: applyLearnedRules(latest.identity.memory, data.rules as string[], consumed),
          },
        }));
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Não foi possível actualizar a memória.',
        };
      } finally {
        learning.delete(brand.id);
      }
    },
    [updateBrand],
  );

  const record = React.useCallback(
    async (event: MemoryEventInput) => {
      const saved = await updateBrand(event.brandId, (latest) =>
        latest.identity.memory?.enabled === false
          ? latest
          : {
              ...latest,
              identity: {
                ...latest.identity,
                memory: appendMemoryEvent(latest.identity.memory, {
                  kind: event.kind,
                  projectId: event.projectId,
                  detail: event.detail,
                }),
              },
            },
      ).catch(() => null);
      // A leitura corre sozinha, sem o cliente à espera.
      if (saved && memoryNeedsLearning(saved.identity.memory)) void learn(saved);
    },
    [updateBrand, learn],
  );

  return { record, learn, isLearning: (brandId: string) => learning.has(brandId) };
}
