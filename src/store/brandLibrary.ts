'use client';

import * as React from 'react';
import { libraryEntryFor, libraryOf, LIBRARY_LIMIT } from '@/lib/brand/library';
import { contentOfProject, framedArtBlob, readLibrary } from '@/lib/brand/libraryOps';
import { appendMemoryEvent, memoryNeedsLearning } from '@/lib/brand/memory';
import { profileText } from '@/lib/brand/styleLearning';
import { getBackend } from '@/lib/data';
import { registerAsset } from '@/lib/data/assetCache';
import type { Brand, BrandStyleLearning, BrandStyleReference, Project } from '@/lib/domain/types';
import { useBrandMemory } from './brandMemory';
import { useSession } from './session';

export type LibraryResult = { ok: boolean; error?: string; notice?: string };

/**
 * A biblioteca da marca a partir do editor: "Usar como referência da marca".
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Aprovar uma arte faz três coisas:
 *
 *  1. guarda a arte, na moldura em que foi vista, como arte da biblioteca;
 *  2. volta a ler o perfil do estilo com a biblioteca inteira, a nova à
 *     frente — é o perfil, em texto, que leva a biblioteca a todos os
 *     pedidos;
 *  3. regista a aprovação na memória da empresa.
 *
 * Só pelo botão, e só pelo cliente. Uma arte descarregada não entra: nem
 * tudo o que se descarrega é exemplar.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function useBrandLibrary() {
  const { updateBrand } = useSession();
  const memory = useBrandMemory();
  const [busy, setBusy] = React.useState(false);

  const approve = React.useCallback(
    async (brand: Brand, project: Project, artUrl: string): Promise<LibraryResult> => {
      const artwork = project.composition.artwork;
      if (!artwork.assetId) return { ok: false, error: 'Ainda não há arte para aprovar.' };
      if (libraryEntryFor(brand.identity.styleLearning, artwork.assetId)) {
        return { ok: true, notice: 'Esta arte já está na biblioteca da marca.' };
      }
      if (libraryOf(brand.identity.styleLearning).length >= LIBRARY_LIMIT) {
        return {
          ok: false,
          error: `A biblioteca já tem ${LIBRARY_LIMIT} artes. Retira uma na área Marca para juntar esta.`,
        };
      }

      setBusy(true);
      const backend = getBackend();
      let uploaded: string | null = null;
      try {
        const framed = await framedArtBlob(artUrl, project.composition.format);
        const asset = await backend.uploadAsset({
          accountId: project.accountId,
          // `reference` é um dos tipos que a base de dados aceita; um tipo
          // novo pedia uma migração só para isto.
          kind: 'reference',
          file: framed.blob,
          name: 'biblioteca-aprovada.jpg',
          width: framed.width || null,
          height: framed.height || null,
          provenance: 'ia',
        });
        uploaded = asset.id;
        registerAsset(asset, await backend.resolveAssetUrl(asset));

        const { content, topics } = contentOfProject(project);
        const entry: BrandStyleReference = {
          assetId: asset.id,
          content,
          why: 'Aprovada por ti na Kriar.',
          width: framed.width || null,
          height: framed.height || null,
          source: 'aprovada',
          topics,
          format: project.composition.format,
          projectId: project.id,
          fromAssetId: artwork.assetId,
          addedAt: new Date().toISOString(),
        };

        /*
          O perfil, lido de novo com a biblioteca toda.

          Se a leitura falhar e a marca já tiver perfil, a arte entra na
          mesma: a imagem já serve as próximas gerações, e o perfil apanha-a
          na leitura seguinte. Sem perfil nenhum, não há onde a guardar — a
          biblioteca vive dentro do estilo aprendido.
        */
        const current = brand.identity.styleLearning ?? null;
        let reading: Awaited<ReturnType<typeof readLibrary>> | null = null;
        let readingError: string | null = null;
        try {
          reading = await readLibrary({
            company: brand.company,
            fresh: [],
            library: [entry, ...libraryOf(current)],
            previous: current ? profileText(current.profile, 1200) : '',
          });
        } catch (error) {
          readingError = error instanceof Error ? error.message : 'a leitura falhou';
        }
        if (!current && !reading) {
          throw new Error(
            `Não foi possível ler a arte para a biblioteca (${readingError}). Tenta outra vez.`,
          );
        }

        const now = new Date().toISOString();
        const saved = await updateBrand(brand.id, (latest) => {
          const learning = latest.identity.styleLearning ?? null;
          const references = [entry, ...(learning?.references ?? [])].slice(0, LIBRARY_LIMIT);
          const next: BrandStyleLearning =
            learning && !reading
              ? { ...learning, references }
              : {
                  enabled: learning?.enabled ?? true,
                  profile: reading!.profile,
                  references,
                  analysedCount: reading!.analysedCount,
                  consistency: reading!.consistency,
                  analysedAt: now,
                  producedBy: reading!.producedBy,
                };
          return {
            ...latest,
            identity: {
              ...latest.identity,
              styleLearning: next,
              memory:
                latest.identity.memory?.enabled === false
                  ? latest.identity.memory
                  : appendMemoryEvent(latest.identity.memory, {
                      kind: 'aprovada',
                      projectId: project.id,
                      detail: `Aprovou para a biblioteca da marca a arte de ${content || 'uma publicação'}.`,
                    }),
            },
          };
        });
        if (!saved) throw new Error('Não foi possível guardar a biblioteca.');
        uploaded = null;
        if (memoryNeedsLearning(saved.identity.memory)) void memory.learn(saved);

        return {
          ok: true,
          notice: reading
            ? 'Arte na biblioteca da marca. O estilo foi actualizado com ela.'
            : 'Arte na biblioteca da marca. O estilo actualiza-se na próxima leitura.',
        };
      } catch (error) {
        if (uploaded) void backend.deleteAsset(uploaded).catch(() => undefined);
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Não foi possível juntar a arte.',
        };
      } finally {
        setBusy(false);
      }
    },
    [updateBrand, memory],
  );

  /**
   * Retira uma arte da biblioteca e volta a ler o perfil sem ela.
   *
   * O ficheiro só se apaga depois de a marca ficar gravada sem ele: ao
   * contrário, uma falha deixava a biblioteca a apontar para um ficheiro
   * que já não existe.
   */
  const remove = React.useCallback(
    async (brand: Brand, assetId: string): Promise<LibraryResult> => {
      setBusy(true);
      try {
        const saved = await updateBrand(brand.id, (latest) => {
          const learning = latest.identity.styleLearning;
          if (!learning) return latest;
          return {
            ...latest,
            identity: {
              ...latest.identity,
              styleLearning: {
                ...learning,
                references: learning.references.filter((entry) => entry.assetId !== assetId),
              },
            },
          };
        });
        if (!saved) throw new Error('Não foi possível guardar a biblioteca.');
        void getBackend().deleteAsset(assetId).catch(() => undefined);

        const learning = saved.identity.styleLearning;
        if (!learning || learning.references.length === 0) {
          return { ok: true, notice: 'Arte retirada da biblioteca.' };
        }
        try {
          const reading = await readLibrary({
            company: saved.company,
            fresh: [],
            library: learning.references,
            previous: profileText(learning.profile, 1200),
          });
          await updateBrand(brand.id, (latest) =>
            latest.identity.styleLearning
              ? {
                  ...latest,
                  identity: {
                    ...latest.identity,
                    styleLearning: {
                      ...latest.identity.styleLearning,
                      profile: reading.profile,
                      consistency: reading.consistency,
                      analysedCount: reading.analysedCount,
                      analysedAt: new Date().toISOString(),
                      producedBy: reading.producedBy,
                    },
                  },
                }
              : latest,
          );
          return { ok: true, notice: 'Arte retirada. O estilo foi lido de novo sem ela.' };
        } catch {
          return {
            ok: true,
            notice: 'Arte retirada. Não foi possível ler o estilo de novo agora.',
          };
        }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Não foi possível retirar a arte.',
        };
      } finally {
        setBusy(false);
      }
    },
    [updateBrand],
  );

  return { approve, remove, busy };
}
