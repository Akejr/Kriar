/**
 * Referências criativas dos modelos, lidas no servidor.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Os ficheiros vivem em `src/modelos/` e NUNCA em `public/`. São artes de
 * demonstração: trazem a identidade Kriar aplicada. Se fossem servidos pelo
 * browser, qualquer pessoa as descarregava; se chegassem às artes dos
 * clientes, a publicação de um cliente sairia com a marca do estúdio.
 *
 * Este módulo lê-as do disco e devolve um data URL para a chamada de
 * geração. Nunca devolve um caminho público.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Template } from '@/lib/templates/types';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

/** O disco só é lido uma vez por ficheiro: as referências não mudam em runtime. */
const cache = new Map<string, string | null>();

/**
 * Lê uma referência e devolve-a como data URL.
 *
 * O caminho é confinado a `src/modelos`, independentemente do que o modelo
 * declarar: um `../` num ficheiro de modelo não pode virar leitura arbitrária
 * de ficheiros do servidor.
 */
export async function readTemplateReference(relative: string): Promise<string | null> {
  const cached = cache.get(relative);
  if (cached !== undefined) return cached;

  const root = path.join(process.cwd(), 'src', 'modelos');
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
    // Referência ausente não é motivo para falhar a geração: o `scenePrompt`
    // do modelo descreve o cenário por palavras.
    cache.set(relative, null);
    return null;
  }
}

/**
 * Referência de composição do modelo, pronta a enviar ao gerador.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * REVERSÃO DE UMA DECISÃO ANTERIOR.
 *
 * Durante um tempo esta função recusava enviar qualquer referência marcada
 * com `containsDemoBrand`, com medo de o gerador copiar a marca de
 * demonstração para a arte do cliente. O custo dessa prudência foi alto: o
 * modelo deixou de influenciar o resultado e o gerador compunha às cegas —
 * saíam painéis de cor achatados com a fotografia relegada para metade da
 * imagem. Era o oposto do que a biblioteca de modelos existe para garantir.
 *
 * Passa a ser enviada. O que o modelo contribui é enquadramento, encenação,
 * luz e hierarquia — e isso só se transmite em píxeis; por palavras não
 * chega. A marca de demonstração é tratada no prompt, com instrução
 * explícita para ignorar o texto e o logótipo da referência.
 *
 * `containsDemoBrand` continua a ter função: é o que activa essa instrução.
 * ──────────────────────────────────────────────────────────────────────────
 */
export type TemplateReferencePayload = {
  dataUrl: string;
  /** `true` quando o prompt tem de mandar ignorar a marca da referência. */
  ignoreBranding: boolean;
};

export async function generationReferences(
  template: Template,
): Promise<TemplateReferencePayload[]> {
  const files = [template.reference.payloadFile, ...(template.reference.variants ?? [])];
  const urls = await Promise.all(files.map((file) => readTemplateReference(file)));

  // Uma referência de composição basta. Mais do que isso e o gerador começa a
  // misturar enquadramentos em vez de seguir um.
  return urls
    .filter((url): url is string => Boolean(url))
    .slice(0, 1)
    .map((dataUrl) => ({
      dataUrl,
      ignoreBranding: template.reference.containsDemoBrand,
    }));
}
