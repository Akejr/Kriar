/**
 * Leitura de pistas de identidade num manual de marca em PDF.
 *
 * Isto NÃO é reconhecimento de design nem IA. É inspecção directa do
 * ficheiro, feita com a biblioteca `zlib` do Node e sem dependências
 * externas. Encontra apenas o que está lá:
 *
 *   · nomes de tipografias EMBEBIDAS no PDF (`/BaseFont`) → explícito;
 *   · códigos hexadecimais ESCRITOS no documento, do género `#1A3A5C`,
 *     que é como os manuais costumam listar as cores → explícito;
 *   · cores usadas nos operadores de pintura (`rg`, `k`), por frequência
 *     → inferido, porque podem ser de elementos decorativos.
 *
 * Nunca devolve nomes de fontes que não estejam no ficheiro, e nunca promete
 * reconhecimento perfeito. O utilizador confirma e corrige tudo antes de
 * guardar.
 */
import zlib from 'node:zlib';
import { FONT_CATALOG, type FontId } from '@/lib/fontCatalog';
import { hexToHsl, normalizeHex, relativeLuminance } from '@/lib/utils/color';

export type PdfFontHint = {
  /** Nome como aparece no ficheiro, já sem o prefixo de subconjunto. */
  name: string;
  /** Fonte do catálogo que corresponde, se houver. Nunca é um palpite vago. */
  supported: FontId | null;
};

export type PdfColorHint = {
  hex: string;
  /** Quantas vezes foi encontrada. */
  count: number;
};

export type PdfHints = {
  fonts: PdfFontHint[];
  /** Hexadecimais escritos no documento. */
  explicitColors: PdfColorHint[];
  /** Cores deduzidas dos operadores de pintura. */
  inferredColors: PdfColorHint[];
  pages: number | null;
  /** Avisos honestos sobre os limites da análise. */
  notes: string[];
};

const MAX_STREAMS = 400;
const MAX_DECOMPRESSED = 12 * 1024 * 1024;

function decompressStreams(buffer: Buffer): { data: Buffer; truncated: boolean } {
  const parts: Buffer[] = [];
  let total = 0;
  let position = 0;
  let streams = 0;
  let truncated = false;

  while (streams < MAX_STREAMS && total < MAX_DECOMPRESSED) {
    const marker = buffer.indexOf('stream', position);
    if (marker === -1) break;
    let start = marker + 'stream'.length;
    if (buffer[start] === 0x0d) start += 1;
    if (buffer[start] === 0x0a) start += 1;
    const end = buffer.indexOf('endstream', start);
    if (end === -1) break;

    const chunk = buffer.subarray(start, end);
    position = end + 'endstream'.length;
    streams += 1;

    for (const inflate of [zlib.inflateSync, zlib.inflateRawSync]) {
      try {
        const out = inflate(chunk);
        parts.push(out);
        total += out.length;
        break;
      } catch {
        // Fluxo não comprimido, ou com outro filtro: ignoramos.
      }
    }
  }

  if (streams >= MAX_STREAMS || total >= MAX_DECOMPRESSED) truncated = true;
  return { data: Buffer.concat(parts), truncated };
}

// --- Tipografia -------------------------------------------------------------

function normalizeFontName(raw: string): string {
  return raw
    .replace(/^[A-Z]{6}\+/, '') // prefixo de subconjunto, ex. "ABCDEF+"
    .replace(/#20/g, ' ')
    .replace(/[-_]?(Regular|Book)$/i, '')
    .trim();
}

function matchCatalog(name: string): FontId | null {
  const key = name.toLowerCase().replace(/[^a-z]/g, '');
  const family = key.replace(
    /(thin|extralight|ultralight|light|regular|medium|semibold|demibold|bold|extrabold|black|heavy|italic|oblique)+$/,
    '',
  );
  for (const entry of FONT_CATALOG) {
    const candidate = entry.label.toLowerCase().replace(/[^a-z]/g, '');
    if (family === candidate || key === candidate) return entry.id;
  }
  return null;
}

function extractFonts(raw: string): PdfFontHint[] {
  const found = new Map<string, PdfFontHint>();
  const regex = /\/BaseFont\s*\/([^\s/<>\][(){}]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    const name = normalizeFontName(match[1]);
    if (!name || name.length > 60) continue;
    if (found.has(name)) continue;
    found.set(name, { name, supported: matchCatalog(name) });
  }
  return [...found.values()].slice(0, 12);
}

// --- Cores ------------------------------------------------------------------

function isUsableColor(hex: string): boolean {
  const luminance = relativeLuminance(hex);
  if (luminance > 0.93 || luminance < 0.025) return false; // quase branco / quase preto
  const { s } = hexToHsl(hex);
  return s > 0.08;
}

function tally(values: string[]): PdfColorHint[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([hex, count]) => ({ hex, count }))
    .sort((a, b) => b.count - a.count);
}

function extractWrittenHex(text: string): PdfColorHint[] {
  const matches = text.match(/#[0-9A-Fa-f]{6}\b/g) ?? [];
  const normalized = matches
    .map((m) => normalizeHex(m))
    .filter((hex): hex is string => Boolean(hex) && isUsableColor(hex!));
  return tally(normalized).slice(0, 8);
}

function channel(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 255);
}

function toHex(r: number, g: number, b: number): string {
  const part = (n: number) => n.toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

function extractPaintedColors(content: string): PdfColorHint[] {
  const values: string[] = [];

  const rgbRegex = /(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(rg|RG)\b/g;
  let match: RegExpExecArray | null;
  while ((match = rgbRegex.exec(content)) !== null) {
    const hex = toHex(
      channel(Number(match[1])),
      channel(Number(match[2])),
      channel(Number(match[3])),
    );
    if (isUsableColor(hex)) values.push(hex);
  }

  const cmykRegex = /(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(k|K)\b/g;
  while ((match = cmykRegex.exec(content)) !== null) {
    const c = Number(match[1]);
    const m = Number(match[2]);
    const y = Number(match[3]);
    const k = Number(match[4]);
    if ([c, m, y, k].some((v) => !Number.isFinite(v) || v < 0 || v > 1)) continue;
    const hex = toHex(
      channel((1 - c) * (1 - k)),
      channel((1 - m) * (1 - k)),
      channel((1 - y) * (1 - k)),
    );
    if (isUsableColor(hex)) values.push(hex);
  }

  return tally(values).slice(0, 8);
}

/** Texto legível dos fluxos de conteúdo, para encontrar hexadecimais escritos. */
function extractReadableText(content: string): string {
  const parts: string[] = [];
  const regex = /\(((?:\\.|[^\\()])*)\)/g;
  let match: RegExpExecArray | null;
  let count = 0;
  while ((match = regex.exec(content)) !== null && count < 40_000) {
    parts.push(match[1].replace(/\\([()\\])/g, '$1'));
    count += 1;
  }
  return parts.join(' ');
}

// --- API --------------------------------------------------------------------

export function extractPdfHints(buffer: Buffer): PdfHints {
  const raw = buffer.toString('latin1');
  const { data, truncated } = decompressStreams(buffer);
  const decompressed = data.toString('latin1');

  const fonts = extractFonts(raw);
  const readable = `${extractReadableText(decompressed)} ${extractReadableText(raw)}`;
  const explicitColors = extractWrittenHex(readable || raw);
  const inferredColors = extractPaintedColors(decompressed || raw).filter(
    (candidate) => !explicitColors.some((explicit) => explicit.hex === candidate.hex),
  );

  const pages = (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length || null;

  const notes: string[] = [];
  if (truncated) {
    notes.push('O ficheiro é grande: a análise cobriu apenas a primeira parte.');
  }
  if (fonts.length === 0) {
    notes.push('Não encontrámos tipografias embebidas no PDF.');
  }
  if (explicitColors.length === 0 && inferredColors.length === 0) {
    notes.push('Não encontrámos códigos de cor legíveis no PDF.');
  }
  if (fonts.length > 0 && fonts.every((f) => !f.supported)) {
    notes.push(
      'As tipografias encontradas não estão na nossa lista. Escolhe a alternativa mais próxima.',
    );
  }

  return { fonts, explicitColors, inferredColors, pages, notes };
}
