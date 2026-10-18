/**
 * Operações da biblioteca da marca que precisam do browser: ler imagens,
 * reduzi-las, enviá-las à leitura do estilo.
 *
 * Separado de `library.ts`, que é puro e corre também no servidor.
 */
import { framedArtDataUrl } from '@/lib/composition/finishArtwork';
import { resolveAsset } from '@/lib/data/assetCache';
import type {
  Brand,
  BrandStyleProfile,
  BrandStyleReference,
  Project,
} from '@/lib/domain/types';
import { blobToDataUrl, downscaleImageBlob } from '@/lib/utils/files';
import { learningSet, topicWords } from './library';
import { clipText, LEARN_IMAGE_LIMIT } from './styleLearning';

export type LibraryReading = {
  profile: BrandStyleProfile;
  consistency: string;
  /** Quantas artes a leitura viu. */
  analysedCount: number;
  producedBy: string;
  /** Escolhas entre as imagens novas, quando as havia. */
  picks: Array<{ index: number; why: string; content: string; topics: string[] }>;
};

/** 768 px em JPEG: chega para ler o estilo, e doze imagens cabem num pedido. */
async function toLearnImage(source: Blob | string): Promise<string> {
  const blob =
    typeof source === 'string' ? await fetch(source).then((response) => response.blob()) : source;
  const small = await downscaleImageBlob(blob, 768, 0.82, { reencode: true });
  return blobToDataUrl(small.blob);
}

/**
 * Lê o perfil a partir de imagens novas e da biblioteca.
 *
 * As novas vão à frente e são as únicas que a leitura pode escolher como
 * referência; as da biblioteca entram para o perfil contar com elas, até
 * ao limite de doze imagens por leitura.
 */
export async function readLibrary(args: {
  company: Brand['company'];
  fresh: Array<Blob | string>;
  library: BrandStyleReference[];
  previous: string;
}): Promise<LibraryReading> {
  const images: string[] = [];
  for (const source of args.fresh.slice(0, LEARN_IMAGE_LIMIT)) {
    images.push(await toLearnImage(source));
  }
  const pickable = images.length;

  const room = LEARN_IMAGE_LIMIT - images.length;
  for (const reference of learningSet(args.library, Math.max(0, room))) {
    try {
      const asset = await resolveAsset(reference.assetId);
      if (asset?.url) images.push(await toLearnImage(asset.url));
    } catch {
      // Uma arte que não carrega fica de fora desta leitura.
    }
  }
  if (images.length === 0) throw new Error('Não há artes para ler.');

  const response = await fetch('/api/brand/learn', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      company: {
        name: args.company.name,
        segment: args.company.segment,
        description: args.company.description,
      },
      images,
      pickable,
      previous: args.previous,
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok || !data.profile) {
    throw new Error(data?.error ?? 'Não foi possível ler o estilo das artes.');
  }

  return {
    profile: data.profile as BrandStyleProfile,
    consistency: typeof data.consistency === 'string' ? data.consistency : '',
    analysedCount: images.length,
    producedBy: typeof data.provider === 'string' ? data.provider : '',
    picks: Array.isArray(data.picks) ? data.picks : [],
  };
}

/**
 * O que uma arte gerada aqui MOSTRA — sabido, não adivinhado.
 *
 * Para as artes do cadastro é a leitura que o descreve. Para uma aprovada
 * na Kriar sabemos exactamente: o título, os produtos, o preço e a cena
 * vieram da revisão. É a lista do que a próxima arte não pode copiar.
 */
export function contentOfProject(project: Project): { content: string; topics: string[] } {
  const composition = project.composition;
  const headline = composition.texts.headline?.value.trim();
  const price = composition.texts.price?.value.trim();
  const items = composition.items.map((item) => item.name.trim()).filter(Boolean);
  const idea = composition.direction?.idea?.trim();
  const parts = [
    headline ? `o título «${headline}»` : null,
    items.length > 0 ? `os produtos ${items.join(', ')}` : null,
    price ? `o preço ${price}` : null,
    idea ? `a cena (${idea})` : null,
  ].filter(Boolean) as string[];

  const topics = topicWords(
    [project.brief, headline, ...items].filter(Boolean).join(' '),
  ).slice(0, 6);

  return { content: clipText(parts.join('; '), 240), topics };
}

/**
 * A arte aprovada, como fica guardada na biblioteca: na moldura, a 1024 px.
 *
 * Na moldura e não o ficheiro do gerador: o que se aprovou foi o que se viu,
 * e uma referência com a faixa que a moldura corta ensinava ao gerador a
 * pôr conteúdo exactamente onde não pode.
 */
export async function framedArtBlob(
  src: string,
  format: Project['composition']['format'],
): Promise<{ blob: Blob; width: number; height: number }> {
  const dataUrl = await framedArtDataUrl(src, format, 1024);
  const blob = await fetch(dataUrl).then((response) => response.blob());
  const size = await new Promise<{ width: number; height: number }>((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ width: 0, height: 0 });
    image.src = dataUrl;
  });
  return { blob, ...size };
}
