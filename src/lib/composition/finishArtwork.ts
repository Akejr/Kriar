/**
 * Acabamento da arte gerada.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O gerador produz a publicação completa. Duas coisas não lhe podemos pedir
 * com exactidão:
 *
 *   · o LOGÓTIPO — um modelo de imagem redesenha-o, não o reproduz;
 *   · os CONTACTOS — dígitos de telefone e nomes de perfis saem com erros.
 *
 * Este módulo desenha essas duas camadas por cima, com o ficheiro e os
 * valores reais. É a mesma função que alimenta a prévia e a exportação, pelo
 * que o PNG descarregado é exactamente o que o cliente aprovou.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { formatContactForArt, getFormat } from '@/lib/domain/catalog';
import type {
  Brand,
  Composition,
  FormatId,
  LogoPlacement,
  LogoSize,
} from '@/lib/domain/types';
import { resolveFontFamily } from '@/lib/fontCatalog';
import { loadArtImage } from './renderCanvas';
import type { ResolvedAsset } from './resolve';
import { EDGE_CROP } from './frame';
import { fontShorthand, getFontMetrics, measureLineWidth } from './textLayout';

export type FinishedArtworkInput = {
  /** Endereço da imagem gerada. */
  src: string;
  format: FormatId;
  /** Logótipo a sobrepor. `null` desliga a camada. */
  logo: { src: string } | null;
  placement: LogoPlacement;
  size: LogoSize;
  /** Linha de contactos já formatada. Vazia desliga a camada. */
  contactLine: string;
  /** Família tipográfica real, como o `ctx.font` a espera. */
  fontFamily: string;
};

/** Largura da caixa do logótipo, em fracção da largura da arte. */
const LOGO_WIDTH: Record<LogoSize, number> = {
  pequeno: 0.17,
  medio: 0.24,
  grande: 0.32,
};

/** Proporção da caixa do logótipo. `contain` nunca distorce o ficheiro. */
const LOGO_BOX_RATIO = 0.42;

const MARGIN_X = 0.062;
const MARGIN_Y = 0.045;

export type FinishResult = {
  canvas: HTMLCanvasElement;
  /** `true` quando a imagem gerada não carregou. */
  missingImage: boolean;
  /** `true` quando o ficheiro do logótipo não carregou. */
  missingLogo: boolean;
};

export async function paintFinishedArtwork(
  input: FinishedArtworkInput,
): Promise<FinishResult> {
  const format = getFormat(input.format);
  const canvas = document.createElement('canvas');
  canvas.width = format.width;
  canvas.height = format.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('O browser não disponibilizou um contexto 2D.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. A imagem gerada, em `cover` — preenche o formato sem distorcer.
  let missingImage = false;
  try {
    const image = await loadArtImage(input.src);
    drawCover(ctx, image, format.width, format.height);
  } catch {
    missingImage = true;
    ctx.fillStyle = '#101211';
    ctx.fillRect(0, 0, format.width, format.height);
  }

  // 2. Logótipo real.
  let missingLogo = false;
  if (input.logo) {
    try {
      const logo = await loadArtImage(input.logo.src);
      drawLogo(ctx, logo, format.width, format.height, input.placement, input.size);
    } catch {
      missingLogo = true;
    }
  }

  // 3. Linha de contactos.
  if (input.contactLine.trim()) {
    drawContacts(ctx, input.contactLine.trim(), format.width, format.height, input.fontFamily);
  }

  return { canvas, missingImage, missingLogo };
}

// --- Desenho ----------------------------------------------------------------

/**
 * A imagem gerada como o cliente a vê: recortada pela moldura do formato.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Existe para o VERIFICADOR. Recebia a imagem inteira do gerador — 3:4
 * numa publicação 4:5 — e via inteira uma linha de contactos que a moldura
 * cortava a meio. Aprovava uma arte em que o cliente via meia linha de texto
 * por baixo do botão. Com a moldura, o que se verifica é o que se publica.
 * ──────────────────────────────────────────────────────────────────────────
 */
export async function framedArtDataUrl(
  src: string,
  format: FormatId,
  maxWidth = 1024,
): Promise<string> {
  const spec = getFormat(format);
  const scale = Math.min(1, maxWidth / spec.width);
  const width = Math.round(spec.width * scale);
  const height = Math.round(spec.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('O browser não disponibilizou um contexto 2D.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  drawCover(ctx, await loadArtImage(src), width, height);
  return canvas.toDataURL('image/jpeg', 0.88);
}

/**
 * Onde a imagem gerada assenta na moldura do formato.
 *
 * Exportado porque a edição por zonas precisa da mesma conta ao contrário:
 * o cliente pinta sobre a moldura que vê, e o gerador recebe o ficheiro
 * guardado, que tem outra proporção (3:4 numa publicação 4:5). Duas contas
 * diferentes para a mesma geometria deixavam a zona pintada desviada da
 * zona editada.
 *
 * `s*` é o rectângulo lido do ficheiro; `d*` é onde ele é desenhado.
 */
export function coverGeometry(
  naturalWidth: number,
  naturalHeight: number,
  width: number,
  height: number,
): { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } {
  const crop = EDGE_CROP;
  const sx = naturalWidth * crop;
  const sy = naturalHeight * crop;
  const sw = naturalWidth * (1 - crop * 2);
  const sh = naturalHeight * (1 - crop * 2);

  const ratio = sw / sh;
  const boxRatio = width / height;
  let dw: number;
  let dh: number;
  if (ratio < boxRatio) {
    dw = width;
    dh = width / ratio;
  } else {
    dh = height;
    dw = height * ratio;
  }

  return { sx, sy, sw, sh, dx: (width - dw) / 2, dy: (height - dh) / 2, dw, dh };
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
): void {
  const g = coverGeometry(image.naturalWidth, image.naturalHeight, width, height);
  ctx.drawImage(image, g.sx, g.sy, g.sw, g.sh, g.dx, g.dy, g.dw, g.dh);
}

function logoBox(
  width: number,
  height: number,
  placement: LogoPlacement,
  size: LogoSize,
): { x: number; y: number; w: number; h: number } {
  const w = LOGO_WIDTH[size] * width;
  const h = w * LOGO_BOX_RATIO;
  const marginX = MARGIN_X * width;
  const marginY = MARGIN_Y * height;

  const top = placement.startsWith('superior');
  const y = top ? marginY : height - marginY - h;

  const x = placement.endsWith('centro')
    ? (width - w) / 2
    : placement.endsWith('direito')
      ? width - marginX - w
      : marginX;

  return { x, y, w, h };
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  width: number,
  height: number,
  placement: LogoPlacement,
  size: LogoSize,
): void {
  const box = logoBox(width, height, placement, size);

  /*
    Véu discreto atrás do logótipo.

    A zona foi pedida ao gerador como livre, mas uma cena fotográfica nunca é
    perfeitamente lisa. Um véu suave na luminosidade oposta garante que o
    logótipo se lê sempre, sem parecer uma etiqueta colada.
  */
  const pad = box.w * 0.1;
  const light = isRegionLight(ctx, box.x - pad, box.y - pad, box.w + pad * 2, box.h + pad * 2);
  const veil = light ? 'rgba(255, 255, 255, 0.55)' : 'rgba(10, 11, 10, 0.42)';

  ctx.save();
  ctx.filter = `blur(${Math.round(box.w * 0.09)}px)`;
  ctx.fillStyle = veil;
  roundRect(ctx, box.x - pad, box.y - pad, box.w + pad * 2, box.h + pad * 2, box.h * 0.4);
  ctx.fill();
  ctx.restore();

  // `contain`: o ficheiro original nunca é esticado nem cortado.
  const ratio = logo.naturalWidth / logo.naturalHeight;
  const boxRatio = box.w / box.h;
  const dw = ratio > boxRatio ? box.w : box.h * ratio;
  const dh = ratio > boxRatio ? box.w / ratio : box.h;

  ctx.drawImage(logo, box.x + (box.w - dw) / 2, box.y + (box.h - dh) / 2, dw, dh);
}

function drawContacts(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  height: number,
  fontFamily: string,
): void {
  const fontSize = width * 0.0195;
  const weight = 500;
  const lineWidth = measureLineWidth(text, fontFamily, weight, fontSize);
  const metrics = getFontMetrics(fontFamily, weight, fontSize);

  const padX = fontSize * 1.1;
  const padY = fontSize * 0.62;
  const pillW = Math.min(width - MARGIN_X * width * 2, lineWidth + padX * 2);
  const pillH = metrics.ascent + metrics.descent + padY * 2;
  const pillX = (width - pillW) / 2;
  const pillY = height - MARGIN_Y * height * 0.72 - pillH;

  const light = isRegionLight(ctx, pillX, pillY, pillW, pillH);

  ctx.save();
  ctx.fillStyle = light ? 'rgba(255, 255, 255, 0.82)' : 'rgba(10, 11, 10, 0.62)';
  roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fill();

  ctx.fillStyle = light ? '#141715' : '#F3F7F2';
  ctx.font = fontShorthand(weight, fontSize, fontFamily);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, width / 2, pillY + padY + metrics.ascent);
  ctx.restore();
}

// --- Auxiliares -------------------------------------------------------------

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * A região já desenhada é clara?
 *
 * Amostra uma grelha esparsa em vez de todos os píxeis: o que interessa é a
 * decisão claro/escuro, e ler tudo numa arte de 1080 px seria desperdício.
 */
function isRegionLight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const left = Math.max(0, Math.round(x));
  const top = Math.max(0, Math.round(y));
  const width = Math.max(1, Math.min(Math.round(w), ctx.canvas.width - left));
  const height = Math.max(1, Math.min(Math.round(h), ctx.canvas.height - top));

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(left, top, width, height).data;
  } catch {
    // Canvas contaminado por uma imagem de outra origem: assumimos escuro,
    // que é o fundo mais comum nestas artes.
    return false;
  }

  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 400)));
  let total = 0;
  let count = 0;

  for (let py = 0; py < height; py += step) {
    for (let px = 0; px < width; px += step) {
      const index = (py * width + px) * 4;
      // Luminância relativa, igual à usada na paleta das artes.
      total +=
        0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
      count += 1;
    }
  }

  return count > 0 && total / count > 140;
}

// --- Entrada a partir da composição -----------------------------------------

/**
 * Monta a entrada do acabamento a partir da composição.
 *
 * Devolve `null` quando ainda não há arte gerada — é o sinal de que a prévia
 * deve mostrar a revisão, não uma imagem.
 *
 * Esta função é a única fonte de verdade sobre o acabamento. A prévia e a
 * exportação chamam-na as duas, e é por isso que o ficheiro descarregado
 * corresponde ao que foi aprovado.
 */
export function finishInputFrom(
  composition: Composition,
  brand: Brand,
  assets: Record<string, ResolvedAsset | undefined>,
): FinishedArtworkInput | null {
  const generated = composition.artwork.assetId
    ? assets[composition.artwork.assetId]
    : undefined;
  if (!generated?.url) return null;

  const logoAssetId =
    brand.identity.logoForDarkBgAssetId ?? brand.identity.logoAssetId ?? null;
  const logoAsset = logoAssetId ? assets[logoAssetId] : undefined;

  const showLogo = composition.logo.show && composition.finish.overlayLogo;

  const contactLine = composition.finish.overlayContacts
    ? composition.contacts
        .map((contact) => formatContactForArt(contact.type, contact.value))
        .filter(Boolean)
        .join('  ·  ')
    : '';

  return {
    src: generated.url,
    format: composition.format,
    logo: showLogo && logoAsset?.url ? { src: logoAsset.url } : null,
    placement: composition.logo.placement,
    size: composition.logo.size,
    contactLine,
    fontFamily: resolveFontFamily(composition.fontBody),
  };
}
