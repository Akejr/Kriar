/**
 * Desenho em canvas.
 *
 * Consome exactamente as mesmas camadas que a prévia em DOM. As quebras de
 * linha e os tamanhos de tipografia já vêm decididos pelo motor, por isso
 * este módulo não toma nenhuma decisão de layout — só desenha.
 *
 * O cálculo da linha de base replica o `half-leading` do CSS, para que uma
 * linha de texto caia no mesmo píxel na prévia e no ficheiro exportado.
 */
import { primaryFamilyToken } from '@/lib/fontCatalog';
import { fontShorthand, getFontMetrics, measureLineWidth } from './textLayout';
import type {
  LayerShadow,
  ResolvedArtwork,
  ResolvedLayer,
  ResolvedPolygon,
  ResolvedText,
} from './resolve';

export type RenderOptions = {
  /** Largura final em píxeis. Por omissão, a largura real do formato. */
  pixelWidth?: number;
  /** Fundo opaco antes de desenhar. Útil para miniaturas. */
  clearColor?: string;
};

// --- Carregamento de imagens ------------------------------------------------

const imageCache = new Map<string, HTMLImageElement>();

function isDirectlyUsable(src: string): boolean {
  return (
    src.startsWith('blob:') ||
    src.startsWith('data:') ||
    src.startsWith('/') ||
    (typeof location !== 'undefined' && src.startsWith(location.origin))
  );
}

function proxied(src: string): string {
  return `/api/assets/proxy?url=${encodeURIComponent(src)}`;
}

function load(src: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Não foi possível carregar a imagem: ${src}`));
    img.src = src;
  });
}

/**
 * Carrega uma imagem de forma que o canvas não fique "contaminado".
 *
 * Imagens locais (blob/data) e do mesmo domínio carregam directamente.
 * Imagens remotas tentam primeiro `crossOrigin=anonymous`; se o servidor não
 * enviar cabeçalhos CORS, passam por `/api/assets/proxy`, que as serve do
 * nosso próprio domínio. Sem isto, `toBlob()` falharia na exportação.
 */
export async function loadArtImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return cached;

  let img: HTMLImageElement;
  if (isDirectlyUsable(src)) {
    img = await load(src, false);
  } else {
    try {
      img = await load(src, true);
    } catch {
      img = await load(proxied(src), false);
    }
  }
  imageCache.set(src, img);
  return img;
}

export function forgetArtImage(src: string): void {
  imageCache.delete(src);
}

/** Pré-carrega tudo o que a arte precisa. Devolve as fontes que falharam. */
export async function preloadArtwork(artwork: ResolvedArtwork): Promise<string[]> {
  const sources = new Set<string>();
  for (const layer of artwork.layers) {
    if (layer.kind === 'image') sources.add(layer.src);
  }
  const failures: string[] = [];
  await Promise.all(
    [...sources].map(async (src) => {
      try {
        await loadArtImage(src);
      } catch {
        failures.push(src);
      }
    }),
  );
  return failures;
}

/** Garante que as fontes usadas pela arte estão prontas antes de desenhar. */
export async function ensureArtFonts(artwork: ResolvedArtwork): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const specs = new Set<string>();
  for (const layer of artwork.layers) {
    if (layer.kind !== 'text') continue;
    specs.add(
      `${layer.fontWeight} ${Math.round(layer.fontSize)}px ${primaryFamilyToken(layer.fontFamily)}`,
    );
  }
  await Promise.all(
    [...specs].map((spec) => document.fonts.load(spec).catch(() => undefined)),
  );
  await document.fonts.ready;
}

// --- Primitivas -------------------------------------------------------------

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  if (r === 0) {
    ctx.rect(x, y, w, h);
    return;
  }
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

function ellipsePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.closePath();
}

function polygonPath(ctx: CanvasRenderingContext2D, layer: ResolvedPolygon): void {
  ctx.beginPath();
  layer.points.forEach((point, index) => {
    const x = layer.x + point.x * layer.w;
    const y = layer.y + point.y * layer.h;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

/**
 * Aplica a sombra calculada pelo motor.
 *
 * Os mesmos números vão para o `drop-shadow` do CSS na prévia. O desvio-padrão
 * do desfoque é `valor / 2` nas duas implementações, por isso não há conversão
 * a fazer aqui.
 */
function applyShadow(
  ctx: CanvasRenderingContext2D,
  shadow: LayerShadow | null | undefined,
): void {
  if (!shadow) return;
  ctx.shadowColor = shadow.color;
  ctx.shadowBlur = shadow.blur;
  ctx.shadowOffsetY = shadow.offsetY;
}

function drawText(ctx: CanvasRenderingContext2D, layer: ResolvedText): void {
  const { fontFamily, fontWeight, fontSize, lineHeightPx, tracking, align, lines } = layer;
  const metrics = getFontMetrics(fontFamily, fontWeight, fontSize);
  const halfLeading = (lineHeightPx - (metrics.ascent + metrics.descent)) / 2;

  ctx.save();
  ctx.fillStyle = layer.color;
  ctx.font = fontShorthand(fontWeight, fontSize, fontFamily);
  ctx.textBaseline = 'alphabetic';

  // A biblioteca de tipos já declara `letterSpacing`, mas o suporte real
  // ainda varia entre browsers. Verificamos em runtime com um acesso que NÃO
  // estreita o tipo de `ctx`: usar `'letterSpacing' in ctx` tornaria o ramo
  // alternativo inalcançável para o compilador.
  const spacingCtx = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const supportsLetterSpacing = typeof spacingCtx.letterSpacing === 'string';
  const useNative = tracking === 0 || supportsLetterSpacing;

  if (tracking !== 0 && supportsLetterSpacing) {
    spacingCtx.letterSpacing = `${tracking}px`;
  }

  lines.forEach((line, index) => {
    const baseline = layer.y + index * lineHeightPx + halfLeading + metrics.ascent;
    if (useNative) {
      ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
      const x =
        align === 'center' ? layer.x + layer.w / 2 : align === 'right' ? layer.x + layer.w : layer.x;
      ctx.fillText(line, x, baseline);
      return;
    }
    // Sem suporte para `letterSpacing` no canvas: desenha carácter a carácter,
    // acrescentando o espaçamento depois de cada um (como o CSS faz).
    const trackingEm = tracking / fontSize;
    const lineWidth = measureLineWidth(line, fontFamily, fontWeight, fontSize, trackingEm);
    let cursor =
      align === 'center'
        ? layer.x + (layer.w - lineWidth) / 2
        : align === 'right'
          ? layer.x + layer.w - lineWidth
          : layer.x;
    ctx.textAlign = 'left';
    for (const char of line) {
      ctx.fillText(char, cursor, baseline);
      cursor += ctx.measureText(char).width + tracking;
    }
  });

  if (tracking !== 0 && supportsLetterSpacing) {
    spacingCtx.letterSpacing = '0px';
  }
  ctx.restore();
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: ResolvedLayer,
  designWidth: number,
): void {
  switch (layer.kind) {
    case 'rect': {
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.fillStyle = layer.fill;
      applyShadow(ctx, layer.shadow);
      roundRectPath(ctx, layer.x, layer.y, layer.w, layer.h, layer.radius);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'ellipse': {
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.fillStyle = layer.fill;
      applyShadow(ctx, layer.shadow);
      ellipsePath(ctx, layer.x, layer.y, layer.w, layer.h);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'polygon': {
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.fillStyle = layer.fill;
      applyShadow(ctx, layer.shadow);
      polygonPath(ctx, layer);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'gradient': {
      ctx.save();
      const [x0, y0, x1, y1] =
        layer.direction === 'to-bottom'
          ? [layer.x, layer.y, layer.x, layer.y + layer.h]
          : layer.direction === 'to-top'
            ? [layer.x, layer.y + layer.h, layer.x, layer.y]
            : layer.direction === 'to-right'
              ? [layer.x, layer.y, layer.x + layer.w, layer.y]
              : [layer.x + layer.w, layer.y, layer.x, layer.y];
      const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
      gradient.addColorStop(0, layer.from);
      gradient.addColorStop(1, layer.to);
      ctx.fillStyle = gradient;
      ctx.fillRect(layer.x, layer.y, layer.w, layer.h);
      ctx.restore();
      break;
    }
    case 'image': {
      const img = imageCache.get(layer.src);
      if (!img) break;
      ctx.save();
      if (layer.shadow && !layer.clip) {
        // Sem recorte, a sombra do canvas segue o contorno com alfa da
        // fotografia — exactamente como o `drop-shadow` do CSS na prévia.
        // Com recorte o `clip` apagaria a sombra, por isso nem a aplicamos.
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = designWidth * 0.035;
        ctx.shadowOffsetY = designWidth * 0.014;
      }
      if (layer.clip) {
        if (layer.shape === 'ellipse') ellipsePath(ctx, layer.x, layer.y, layer.w, layer.h);
        else roundRectPath(ctx, layer.x, layer.y, layer.w, layer.h, layer.radius);
        ctx.clip();
      }
      ctx.drawImage(img, layer.draw.dx, layer.draw.dy, layer.draw.dw, layer.draw.dh);
      ctx.restore();
      break;
    }
    case 'placeholder': {
      // Marcadores só existem no rascunho. Nunca chegam ao ficheiro exportado,
      // porque o motor é chamado com `mode: 'final'` na exportação.
      ctx.save();
      ctx.fillStyle = layer.fill;
      ctx.strokeStyle = layer.stroke;
      ctx.lineWidth = Math.max(1, designWidth * 0.0016);
      ctx.setLineDash([designWidth * 0.012, designWidth * 0.01]);
      if (layer.shape === 'ellipse') ellipsePath(ctx, layer.x, layer.y, layer.w, layer.h);
      else roundRectPath(ctx, layer.x, layer.y, layer.w, layer.h, layer.radius);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'text': {
      drawText(ctx, layer);
      break;
    }
  }
}

// --- API --------------------------------------------------------------------

/**
 * Desenha a arte num canvas novo.
 * Chamar `preloadArtwork` e `ensureArtFonts` antes, ou usar `renderArtwork`.
 */
export function paintArtwork(
  artwork: ResolvedArtwork,
  options: RenderOptions = {},
): HTMLCanvasElement {
  const pixelWidth = options.pixelWidth ?? artwork.width;
  const scale = pixelWidth / artwork.width;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(artwork.width * scale);
  canvas.height = Math.round(artwork.height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('O browser não disponibilizou um contexto 2D.');

  if (options.clearColor) {
    ctx.fillStyle = options.clearColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.save();
  ctx.scale(scale, scale);
  // `imageSmoothingQuality` melhora fotografias reduzidas para caber no slot.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  for (const layer of artwork.layers) {
    drawLayer(ctx, layer, artwork.width);
  }
  ctx.restore();

  return canvas;
}

/** Carrega tudo o que falta e desenha. */
export async function renderArtwork(
  artwork: ResolvedArtwork,
  options: RenderOptions = {},
): Promise<{ canvas: HTMLCanvasElement; missingImages: string[] }> {
  const missingImages = await preloadArtwork(artwork);
  await ensureArtFonts(artwork);
  return { canvas: paintArtwork(artwork, options), missingImages };
}
