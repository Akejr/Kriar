/**
 * Extracção de cores dominantes de uma imagem, no browser.
 *
 * É análise real: reduzimos a imagem, agrupamos os píxeis por proximidade e
 * contamos. Mesmo assim é apresentada como "inferido", porque a cor mais
 * frequente de um logótipo não é necessariamente a cor oficial da marca — o
 * utilizador confirma sempre antes de guardar.
 */
import { colorDistance, hexToHsl, relativeLuminance, rgbToHex } from '@/lib/utils/color';

export type ExtractedColor = {
  hex: string;
  /** Fracção dos píxeis considerados. */
  share: number;
};

const SAMPLE_SIZE = 72;

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem.'));
    };
    img.src = url;
  });
}

export async function extractDominantColors(
  blob: Blob,
  count = 4,
): Promise<ExtractedColor[]> {
  const img = await loadImage(blob);

  const canvas = document.createElement('canvas');
  const ratio = img.naturalWidth / Math.max(1, img.naturalHeight);
  canvas.width = ratio >= 1 ? SAMPLE_SIZE : Math.max(1, Math.round(SAMPLE_SIZE * ratio));
  canvas.height = ratio >= 1 ? Math.max(1, Math.round(SAMPLE_SIZE / ratio)) : SAMPLE_SIZE;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let pixels: Uint8ClampedArray;
  try {
    pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    // Imagem de outra origem sem CORS: não conseguimos ler os píxeis.
    return [];
  }

  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
  let considered = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    if (alpha < 160) continue;

    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const hex = rgbToHex({ r, g, b });

    /*
      Só a SATURAÇÃO decide o que é cor de marca.

      Antes havia também um filtro de luminância que descartava tudo abaixo
      de 0.02 como "quase preto". Um logótipo em azul-marinho — `#000A33`,
      luminância 0.008 — era inteiramente descartado, e a aplicação dizia
      "não conseguimos ler as cores" sobre um logótipo que só tem uma. O
      filtro de saturação já remove o preto e o branco verdadeiros, que têm
      saturação zero.
    */
    const { s } = hexToHsl(hex);
    if (s < 0.1) continue;

    considered += 1;
    // Agrupa em degraus de 24 níveis por canal.
    const key = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.n += 1;
    } else {
      buckets.set(key, { r, g, b, n: 1 });
    }
  }

  if (considered === 0) return [];

  const averaged = [...buckets.values()]
    .map((bucket) => ({
      hex: rgbToHex({ r: bucket.r / bucket.n, g: bucket.g / bucket.n, b: bucket.b / bucket.n }),
      n: bucket.n,
    }))
    .sort((a, b) => b.n - a.n);

  // Junta grupos perceptualmente próximos, para não propor quatro azuis iguais.
  const merged: Array<{ hex: string; n: number }> = [];
  for (const candidate of averaged) {
    const near = merged.find((item) => colorDistance(item.hex, candidate.hex) < 70);
    if (near) near.n += candidate.n;
    else merged.push({ ...candidate });
  }

  return merged
    .sort((a, b) => b.n - a.n)
    .slice(0, count)
    .map((item) => ({ hex: item.hex, share: item.n / considered }));
}

// --- Análise completa de um logótipo ---------------------------------------

export type LogoColorAnalysis = {
  /** Cores com saturação, por ordem de frequência. */
  colors: ExtractedColor[];
  /**
   * `false` quando o logótipo é monocromático — só preto, branco ou cinzas.
   * Nesse caso `colors` está vazio e `tone` diz se é escuro ou claro.
   */
  chromatic: boolean;
  /** `escuro` ou `claro`, medido nos píxeis visíveis do ficheiro. */
  tone: 'escuro' | 'claro';
  /** Cor dominante mesmo quando é acromática. Vazio se o ficheiro não se leu. */
  dominant: string;
  /** `true` quando não foi possível ler os píxeis (ficheiro ou CORS). */
  unreadable: boolean;
};

/**
 * Lê o logótipo e decide o que dele serve como cor de marca.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Duas passagens, porque os dois casos têm respostas diferentes:
 *
 *  1. logótipo COM cor → essas cores são a marca;
 *  2. logótipo monocromático → a marca é o preto (ou o branco) do ficheiro,
 *     e o par complementar deduz-se do tom.
 *
 * A segunda passagem existe porque um logótipo a preto não é um logótipo
 * sem cor: a cor dele é preto, e dizer "não conseguimos ler" sobre isso é
 * errado.
 * ──────────────────────────────────────────────────────────────────────────
 */
export async function analyseLogoColors(blob: Blob): Promise<LogoColorAnalysis> {
  const empty: LogoColorAnalysis = {
    colors: [],
    chromatic: false,
    tone: 'escuro',
    dominant: '',
    unreadable: true,
  };

  let img: HTMLImageElement;
  try {
    img = await loadImage(blob);
  } catch {
    return empty;
  }

  const canvas = document.createElement('canvas');
  const ratio = img.naturalWidth / Math.max(1, img.naturalHeight);
  canvas.width = ratio >= 1 ? SAMPLE_SIZE : Math.max(1, Math.round(SAMPLE_SIZE * ratio));
  canvas.height = ratio >= 1 ? Math.max(1, Math.round(SAMPLE_SIZE / ratio)) : SAMPLE_SIZE;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return empty;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let pixels: Uint8ClampedArray;
  try {
    pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    return empty;
  }

  /*
    O branco do fundo não conta.

    Um logótipo chega quase sempre sobre fundo branco, opaco ou transparente.
    Contar esses píxeis fazia o branco ganhar sempre, e a "cor dominante" de
    qualquer logótipo passava a ser branco.
  */
  const marks: Array<{ hex: string; lum: number }> = [];

  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 160) continue;
    const hex = rgbToHex({ r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] });
    const lum = relativeLuminance(hex);
    const { s } = hexToHsl(hex);
    // Quase branco e sem cor: é fundo, não é marca.
    if (lum > 0.88 && s < 0.12) continue;
    marks.push({ hex, lum });
  }

  if (marks.length === 0) return empty;

  const averageLuminance = marks.reduce((sum, mark) => sum + mark.lum, 0) / marks.length;
  const tone: 'escuro' | 'claro' = averageLuminance < 0.42 ? 'escuro' : 'claro';

  const colors = await extractDominantColors(blob, 4);

  if (colors.length > 0) {
    return {
      colors,
      chromatic: true,
      tone,
      dominant: colors[0].hex,
      unreadable: false,
    };
  }

  // Monocromático: a cor dominante é a média dos píxeis da marca.
  const counts = new Map<string, number>();
  for (const mark of marks) {
    const key = mark.hex;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

  return { colors: [], chromatic: false, tone, dominant, unreadable: false };
}

/**
 * Par complementar de uma cor de marca.
 *
 * Quando o logótipo só dá uma cor, a segunda não se inventa: deriva-se. Um
 * logótipo escuro pede branco; um logótipo claro pede um preto suave — preto
 * absoluto em publicidade fica duro e revela os artefactos de compressão.
 */
export function complementFor(primary: string, tone: 'escuro' | 'claro'): string {
  const dark = relativeLuminance(primary) < 0.42 || tone === 'escuro';
  return dark ? '#FFFFFF' : '#10141A';
}
