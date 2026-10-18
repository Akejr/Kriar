import type { ResolvedAsset } from '@/lib/composition/resolve';
import type { Asset } from '@/lib/domain/types';
import { getBackend } from './index';

/**
 * Cache de metadados e endereços de ficheiros.
 *
 * O motor de composição precisa das dimensões naturais de cada imagem para
 * calcular recortes sem distorcer as proporções. Guardamos aqui o par
 * `{ url, width, height }` por recurso.
 *
 * Quando um ficheiro foi carregado sem dimensões registadas (por exemplo um
 * SVG), medimos a imagem uma vez e completamos o registo.
 */
const cache = new Map<string, ResolvedAsset>();
const pending = new Map<string, Promise<ResolvedAsset | null>>();
const metadata = new Map<string, Asset>();

function measure(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function load(assetId: string): Promise<ResolvedAsset | null> {
  const backend = getBackend();
  const asset = await backend.getAsset(assetId);
  if (!asset) return null;
  metadata.set(assetId, asset);

  const url = await backend.resolveAssetUrl(asset);
  let width = asset.width;
  let height = asset.height;

  if (!width || !height) {
    const measured = await measure(url);
    if (measured) {
      width = measured.width;
      height = measured.height;
    }
  }

  const resolved: ResolvedAsset = { url, width, height };
  cache.set(assetId, resolved);
  return resolved;
}

export function peekAsset(assetId: string): ResolvedAsset | undefined {
  return cache.get(assetId);
}

export function peekAssetMeta(assetId: string): Asset | undefined {
  return metadata.get(assetId);
}

export async function resolveAsset(assetId: string): Promise<ResolvedAsset | null> {
  const cached = cache.get(assetId);
  if (cached) return cached;

  const inFlight = pending.get(assetId);
  if (inFlight) return inFlight;

  const promise = load(assetId).finally(() => pending.delete(assetId));
  pending.set(assetId, promise);
  return promise;
}

/** Resolve vários de uma vez. Ignora os que falharem. */
export async function resolveAssets(
  assetIds: Array<string | null | undefined>,
): Promise<Record<string, ResolvedAsset>> {
  const unique = [...new Set(assetIds.filter((id): id is string => Boolean(id)))];
  const entries = await Promise.all(
    unique.map(async (id) => [id, await resolveAsset(id)] as const),
  );
  const out: Record<string, ResolvedAsset> = {};
  for (const [id, asset] of entries) {
    if (asset) out[id] = asset;
  }
  return out;
}

export function registerAsset(asset: Asset, url: string): void {
  metadata.set(asset.id, asset);
  cache.set(asset.id, { url, width: asset.width, height: asset.height });
}

export function forgetAsset(assetId: string): void {
  cache.delete(assetId);
  metadata.delete(assetId);
}
