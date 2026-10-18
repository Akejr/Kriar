/**
 * Exportação para PNG.
 *
 * O ficheiro sai nas dimensões exactas do formato escolhido. A arte é
 * resolvida de novo em modo `final`, o que remove todos os marcadores de
 * rascunho: nenhum controlo de edição, selecção ou nota de direcção visual
 * chega ao ficheiro.
 */
import { APP } from '@/config/app';
import { getFormat } from '@/lib/domain/catalog';
import type { Brand, Project } from '@/lib/domain/types';
import { slugify } from '@/lib/utils/id';
import { downloadBlob } from '@/lib/utils/files';
import { finishInputFrom, paintFinishedArtwork } from './finishArtwork';
import { resolveComposition, type ResolvedAsset } from './resolve';
import { renderArtwork } from './renderCanvas';

export type ExportInput = {
  project: Project;
  brand: Brand;
  assets: Record<string, ResolvedAsset | undefined>;
};

export type ExportResult = {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  /** Imagens que não foi possível carregar. Lista vazia é o caso normal. */
  missingImages: string[];
};

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('O browser não conseguiu produzir o ficheiro PNG.'));
      }, 'image/png');
    } catch {
      // `SecurityError`: alguma imagem de outra origem contaminou o canvas.
      // O `renderCanvas` já tenta o proxy; se chegámos aqui, falhou mesmo.
      reject(
        new Error(
          'A exportação foi bloqueada por uma imagem de outra origem. Volta a carregar a fotografia e tenta de novo.',
        ),
      );
    }
  });
}

/** Produz o PNG. Não descarrega: devolve o blob para quem chamou decidir. */
export async function buildPng(input: ExportInput): Promise<ExportResult> {
  const { project, brand, assets } = input;
  const format = getFormat(project.composition.format);

  const artwork = resolveComposition({
    composition: project.composition,
    brand,
    assets,
    mode: 'final',
  });

  const { canvas, missingImages } = await renderArtwork(artwork, {
    pixelWidth: format.width,
    clearColor: artwork.palette.bg,
  });

  const blob = await canvasToBlob(canvas);

  const filename = `${APP.slug}-${slugify(project.name)}-${format.width}x${format.height}.png`;

  return { blob, filename, width: canvas.width, height: canvas.height, missingImages };
}

/** Produz e descarrega o PNG. */
export async function exportPng(input: ExportInput): Promise<ExportResult> {
  const result = await buildPng(input);
  downloadBlob(result.blob, result.filename);
  return result;
}

/**
 * Exporta a arte GERADA, com o acabamento aplicado.
 *
 * É a mesma função que desenha a prévia (`paintFinishedArtwork`), pelo que o
 * ficheiro é exactamente o que o cliente viu e aprovou.
 */
export async function exportFinishedArtwork(
  input: ExportInput,
): Promise<{ notice: string }> {
  const { project, brand, assets } = input;
  const format = getFormat(project.composition.format);

  const finishInput = finishInputFrom(project.composition, brand, assets);
  if (!finishInput) throw new Error('Esta publicação ainda não tem arte gerada.');

  const { canvas, missingLogo } = await paintFinishedArtwork(finishInput);
  const blob = await canvasToBlob(canvas);
  const filename = `${APP.slug}-${slugify(project.name)}-${format.width}x${format.height}.png`;
  downloadBlob(blob, filename);

  return {
    notice: missingLogo
      ? `Ficheiro ${canvas.width} × ${canvas.height} descarregado, mas o logótipo não carregou e ficou de fora.`
      : `Ficheiro ${canvas.width} × ${canvas.height} descarregado.`,
  };
}

/**
 * Miniatura para a lista de projectos.
 *
 * Com arte gerada, a miniatura é essa arte. Sem ela, usa o motor de
 * composição em modo `rascunho`, para um projecto incompleto continuar a
 * mostrar algo reconhecível na lista.
 */
export async function buildThumbnail(
  input: ExportInput,
  pixelWidth = 320,
): Promise<string | null> {
  const finishInput = finishInputFrom(input.project.composition, input.brand, input.assets);
  if (finishInput) {
    try {
      const { canvas } = await paintFinishedArtwork(finishInput);
      const small = document.createElement('canvas');
      small.width = pixelWidth;
      small.height = Math.round((canvas.height / canvas.width) * pixelWidth);
      const ctx = small.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(canvas, 0, 0, small.width, small.height);
        return small.toDataURL('image/jpeg', 0.78);
      }
    } catch {
      // Cai para o motor de composição.
    }
  }

  try {
    const artwork = resolveComposition({
      composition: input.project.composition,
      brand: input.brand,
      assets: input.assets,
      mode: 'rascunho',
    });
    const { canvas } = await renderArtwork(artwork, {
      pixelWidth,
      clearColor: artwork.palette.bg,
    });
    return canvas.toDataURL('image/jpeg', 0.78);
  } catch {
    return null;
  }
}
