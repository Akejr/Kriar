/**
 * Ficheiros das referências visuais, lidos no servidor.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Os ficheiros vivem em `src/referencias/` e NUNCA em `public/`. São artes
 * reais, com a marca do estúdio e logótipos de terceiros aplicados. Se
 * fossem servidos pelo browser, qualquer pessoa as descarregava.
 *
 * Substitui `templateReference.ts`, e com uma diferença de política que não
 * é de implementação: aquele módulo devolvia a referência do modelo para ser
 * enviada SEMPRE e como primeira imagem, porque era tratada como estrutura
 * obrigatória. Aqui uma referência só viaja quando o plano de aproveitamento
 * o pedir, e nunca quando o cadastro a marcou como `directUse: 'nunca'`.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getReference } from '@/lib/references/catalog';
import type { ReferenceUsage } from '@/lib/domain/references';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

/** O disco só é lido uma vez por ficheiro: as referências não mudam em runtime. */
const cache = new Map<string, string | null>();

/**
 * Lê um ficheiro de referência e devolve-o como data URL.
 *
 * O caminho é confinado a `src/referencias`, independentemente do que o
 * cadastro declarar: um `../` numa entrada do catálogo não pode virar
 * leitura arbitrária de ficheiros do servidor.
 */
export async function readReferenceFile(relative: string): Promise<string | null> {
  const cached = cache.get(relative);
  if (cached !== undefined) return cached;

  const root = path.join(process.cwd(), 'src', 'referencias');
  const resolved = path.resolve(process.cwd(), relative);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    cache.set(relative, null);
    return null;
  }

  const mime = MIME_BY_EXTENSION[path.extname(resolved).toLowerCase()];
  if (!mime) {
    cache.set(relative, null);
    return null;
  }

  try {
    const bytes = await readFile(resolved);
    const url = `data:${mime};base64,${bytes.toString('base64')}`;
    cache.set(relative, url);
    return url;
  } catch {
    /*
      Um ficheiro ausente não falha a geração.

      As qualidades da referência já foram para o prompt por palavras, no
      plano de aproveitamento. A imagem reforça; não é indispensável.
    */
    cache.set(relative, null);
    return null;
  }
}

/**
 * Imagens das referências que o plano manda enviar.
 *
 * Devolve apenas as de `mode: 'imagem'`, cada uma com o identificador da
 * referência: o prompt precisa de saber qual é qual para dizer, ao lado de
 * cada imagem, o que dela se aproveita e o que não se copia.
 *
 * Duas é o limite: a partir daí o gerador começa a misturar acabamentos em
 * vez de absorver um.
 */
export async function referenceImages(
  usage: ReferenceUsage[],
): Promise<Array<{ referenceId: string; dataUrl: string }>> {
  const wanted = usage
    .filter((entry) => entry.mode === 'imagem')
    .map((entry) => getReference(entry.referenceId))
    .filter((reference): reference is NonNullable<typeof reference> => Boolean(reference))
    // Segunda barreira: `completeUsage` já força `descricao` nestas, mas um
    // plano gravado por uma versão anterior pode trazer outra coisa.
    .filter((reference) => reference.directUse !== 'nunca')
    .slice(0, 2);

  const loaded = await Promise.all(
    wanted.map(async (reference) => ({
      referenceId: reference.id,
      dataUrl: await readReferenceFile(reference.payloadFile),
    })),
  );

  return loaded.filter(
    (entry): entry is { referenceId: string; dataUrl: string } => Boolean(entry.dataUrl),
  );
}
