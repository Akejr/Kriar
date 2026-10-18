/**
 * Medição e ajuste de texto.
 *
 * Este módulo é a razão pela qual a prévia e o PNG exportado são iguais: as
 * quebras de linha e o tamanho final da tipografia são decididos UMA vez,
 * aqui, e depois desenhados tanto em DOM como em canvas. Nenhum dos dois
 * renderizadores decide quebras por si.
 *
 * As medidas vêm de um contexto 2D fora do ecrã, que usa exactamente o mesmo
 * motor de tipografia do browser.
 */

export type FitInput = {
  text: string;
  /** Largura disponível, em píxeis do espaço da arte. */
  maxWidth: number;
  /** Altura disponível. Se faltar, só `maxLines` limita. */
  maxHeight?: number;
  fontFamily: string;
  fontWeight: number;
  /** Tamanho pretendido, em píxeis. */
  idealSize: number;
  /** Tamanho mínimo legível. Abaixo disto preferimos avisar. */
  minSize: number;
  maxLines: number;
  /** Multiplicador da altura de linha. */
  lineHeight: number;
  /** Espaçamento entre letras, em `em`. */
  tracking?: number;
  uppercase?: boolean;
};

export type FitResult = {
  lines: string[];
  fontSize: number;
  lineHeightPx: number;
  /** Largura da linha mais larga. */
  width: number;
  /** Altura total do bloco. */
  height: number;
  /** `true` quando foi preciso cortar conteúdo. */
  overflow: boolean;
  /** `true` quando o tamanho ficou abaixo do pretendido. */
  shrunk: boolean;
};

// --- Contexto de medição ----------------------------------------------------

let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  measureCtx = canvas.getContext('2d');
  return measureCtx;
}

export function fontShorthand(weight: number, size: number, family: string): string {
  return `${weight} ${size}px ${family}`;
}

const widthCache = new Map<string, number>();
const WIDTH_CACHE_LIMIT = 6000;

/** Largura de um texto numa única linha, já com o espaçamento entre letras. */
export function measureLineWidth(
  text: string,
  fontFamily: string,
  fontWeight: number,
  fontSize: number,
  tracking = 0,
): number {
  if (!text) return 0;
  const key = `${fontWeight}|${fontSize}|${tracking}|${fontFamily}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;

  const ctx = getMeasureContext();
  let width: number;
  if (ctx) {
    ctx.font = fontShorthand(fontWeight, fontSize, fontFamily);
    width = ctx.measureText(text).width;
  } else {
    // Sem DOM (servidor): aproximação apenas para não falhar.
    width = text.length * fontSize * 0.52;
  }
  // O `letter-spacing` do CSS acrescenta espaço depois de cada carácter,
  // incluindo o último. O renderizador de canvas replica esse modelo.
  if (tracking) width += tracking * fontSize * text.length;

  if (widthCache.size > WIDTH_CACHE_LIMIT) widthCache.clear();
  widthCache.set(key, width);
  return width;
}

export type FontMetrics = { ascent: number; descent: number };

const metricsCache = new Map<string, FontMetrics>();

/**
 * Altura de ascendente e descendente da fonte, para o canvas reproduzir o
 * `half-leading` que o CSS aplica dentro de uma caixa de linha.
 */
export function getFontMetrics(
  fontFamily: string,
  fontWeight: number,
  fontSize: number,
): FontMetrics {
  const key = `${fontWeight}|${fontSize}|${fontFamily}`;
  const cached = metricsCache.get(key);
  if (cached) return cached;

  const ctx = getMeasureContext();
  let metrics: FontMetrics = { ascent: fontSize * 0.8, descent: fontSize * 0.2 };
  if (ctx) {
    ctx.font = fontShorthand(fontWeight, fontSize, fontFamily);
    const m = ctx.measureText('Hxg');
    const ascent = m.fontBoundingBoxAscent;
    const descent = m.fontBoundingBoxDescent;
    if (typeof ascent === 'number' && typeof descent === 'number' && ascent > 0) {
      metrics = { ascent, descent };
    }
  }
  metricsCache.set(key, metrics);
  return metrics;
}

/** Limpa as caches. Chamar quando as fontes acabam de ser carregadas. */
export function resetTextMeasurement(): void {
  widthCache.clear();
  metricsCache.clear();
}

// --- Quebra de linhas -------------------------------------------------------

function breakLongWord(
  word: string,
  maxWidth: number,
  fontFamily: string,
  fontWeight: number,
  fontSize: number,
  tracking: number,
): string[] {
  const parts: string[] = [];
  let current = '';
  for (const char of word) {
    const next = current + char;
    if (current && measureLineWidth(next, fontFamily, fontWeight, fontSize, tracking) > maxWidth) {
      parts.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function wrapText(
  text: string,
  maxWidth: number,
  fontFamily: string,
  fontWeight: number,
  fontSize: number,
  tracking: number,
): string[] {
  const out: string[] = [];
  const paragraphs = text.split(/\r?\n/);

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (
        line &&
        measureLineWidth(candidate, fontFamily, fontWeight, fontSize, tracking) > maxWidth
      ) {
        out.push(line);
        if (measureLineWidth(word, fontFamily, fontWeight, fontSize, tracking) > maxWidth) {
          const pieces = breakLongWord(word, maxWidth, fontFamily, fontWeight, fontSize, tracking);
          line = pieces.pop() ?? '';
          out.push(...pieces);
        } else {
          line = word;
        }
      } else if (
        !line &&
        measureLineWidth(word, fontFamily, fontWeight, fontSize, tracking) > maxWidth
      ) {
        const pieces = breakLongWord(word, maxWidth, fontFamily, fontWeight, fontSize, tracking);
        line = pieces.pop() ?? '';
        out.push(...pieces);
      } else {
        line = candidate;
      }
    }
    out.push(line);
  }

  return out;
}

// --- Ajuste -----------------------------------------------------------------

/** Tamanhos a tentar, do ideal para o mínimo. */
function sizeLadder(ideal: number, min: number): number[] {
  const sizes: number[] = [];
  let size = ideal;
  const floor = Math.min(min, ideal);
  for (let i = 0; i < 40 && size > floor; i += 1) {
    sizes.push(Math.round(size * 2) / 2);
    size = size * 0.955;
  }
  sizes.push(Math.round(floor * 2) / 2);
  return sizes;
}

/**
 * Decide o tamanho e as quebras de linha de um bloco de texto.
 *
 * Tenta o tamanho ideal e vai reduzindo até caber no número de linhas e na
 * altura disponíveis. Se nem no tamanho mínimo couber, corta com reticências
 * e marca `overflow` — é esse sinal que faz a aplicação avisar o utilizador,
 * em vez de deixar o texto sobrepor-se.
 */
export function fitText(input: FitInput): FitResult {
  const {
    maxWidth,
    maxHeight,
    fontFamily,
    fontWeight,
    idealSize,
    minSize,
    maxLines,
    lineHeight,
    tracking = 0,
    uppercase = false,
  } = input;

  const raw = (input.text ?? '').trim();
  const content = uppercase ? raw.toLocaleUpperCase('pt-PT') : raw;

  if (!content) {
    return {
      lines: [],
      fontSize: idealSize,
      lineHeightPx: idealSize * lineHeight,
      width: 0,
      height: 0,
      overflow: false,
      shrunk: false,
    };
  }

  const usableWidth = Math.max(8, maxWidth);

  for (const size of sizeLadder(idealSize, minSize)) {
    const lines = wrapText(content, usableWidth, fontFamily, fontWeight, size, tracking);
    const lineHeightPx = size * lineHeight;
    const height = lines.length * lineHeightPx;
    const fitsLines = lines.length <= maxLines;
    const fitsHeight = maxHeight === undefined || height <= maxHeight + 0.5;
    if (fitsLines && fitsHeight) {
      return {
        lines,
        fontSize: size,
        lineHeightPx,
        width: Math.max(
          ...lines.map((l) => measureLineWidth(l, fontFamily, fontWeight, size, tracking)),
          0,
        ),
        height,
        overflow: false,
        shrunk: size < idealSize - 0.25,
      };
    }
  }

  // Nem no tamanho mínimo cabe: cortar e avisar.
  const size = Math.round(Math.min(minSize, idealSize) * 2) / 2;
  const lineHeightPx = size * lineHeight;
  const allLines = wrapText(content, usableWidth, fontFamily, fontWeight, size, tracking);
  const heightBudget = maxHeight === undefined ? Infinity : Math.max(lineHeightPx, maxHeight);
  const lineBudget = Math.max(
    1,
    Math.min(maxLines, Math.floor(heightBudget / lineHeightPx + 0.01)),
  );
  const kept = allLines.slice(0, lineBudget);
  const truncated = kept.length < allLines.length;

  if (truncated && kept.length > 0) {
    const last = kept[kept.length - 1];
    let shortened = `${last}…`;
    while (
      shortened.length > 2 &&
      measureLineWidth(shortened, fontFamily, fontWeight, size, tracking) > usableWidth
    ) {
      shortened = `${shortened.slice(0, -2)}…`;
    }
    kept[kept.length - 1] = shortened;
  }

  return {
    lines: kept,
    fontSize: size,
    lineHeightPx,
    width: Math.max(
      ...kept.map((l) => measureLineWidth(l, fontFamily, fontWeight, size, tracking)),
      0,
    ),
    height: kept.length * lineHeightPx,
    overflow: truncated,
    shrunk: true,
  };
}
