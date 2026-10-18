/**
 * Utilitários de cor.
 *
 * Todas as funções trabalham com `#RRGGBB`. São usadas tanto para derivar a
 * paleta das artes (a partir das cores da empresa) como para garantir
 * contraste legível sem obrigar o utilizador a pensar em acessibilidade.
 */

export type Rgb = { r: number; g: number; b: number };
export type Hsl = { h: number; s: number; l: number };

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Aceita `#abc`, `#aabbcc`, `aabbcc`. Devolve `null` se for inválido. */
export function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null;
  let hex = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return `#${hex.toUpperCase()}`;
}

/** Como `normalizeHex`, mas devolve a cor de reserva em vez de `null`. */
export function safeHex(input: string | null | undefined, fallback = '#000000'): string {
  return normalizeHex(input) ?? fallback;
}

export function hexToRgb(hex: string): Rgb {
  const value = safeHex(hex, '#000000').slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (n: number) =>
    Math.round(clamp(n, 0, 255))
      .toString(16)
      .padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hn = (((h % 360) + 360) % 360) / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const toChannel = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return {
    r: Math.round(toChannel(hn + 1 / 3) * 255),
    g: Math.round(toChannel(hn) * 255),
    b: Math.round(toChannel(hn - 1 / 3) * 255),
  };
}

export function hexToHsl(hex: string): Hsl {
  return rgbToHsl(hexToRgb(hex));
}

export function hslToHex(hsl: Hsl): string {
  return rgbToHex(hslToRgb(hsl));
}

function channelToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Luminância relativa WCAG (0 = preto, 1 = branco). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
  );
}

/** Razão de contraste WCAG entre duas cores (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Mistura linear entre duas cores. `t = 0` devolve `a`, `t = 1` devolve `b`. */
export function mix(a: string, b: string, t: number): string {
  const ratio = clamp(t, 0, 1);
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * ratio,
    g: ca.g + (cb.g - ca.g) * ratio,
    b: ca.b + (cb.b - ca.b) * ratio,
  });
}

export function lighten(hex: string, amount: number): string {
  return mix(hex, '#FFFFFF', amount);
}

export function darken(hex: string, amount: number): string {
  return mix(hex, '#000000', amount);
}

export function isLight(hex: string): boolean {
  return relativeLuminance(hex) > 0.42;
}

/** Escolhe entre claro e escuro o texto mais legível sobre `background`. */
export function bestTextOn(background: string, light = '#FFFFFF', dark = '#0B0D0C'): string {
  return contrastRatio(background, light) >= contrastRatio(background, dark) ? light : dark;
}

/**
 * Empurra `foreground` para longe de `background` até atingir a razão de
 * contraste pretendida. Nunca entra em ciclo: no máximo 28 passos.
 */
export function ensureContrast(foreground: string, background: string, target = 4.5): string {
  if (contrastRatio(foreground, background) >= target) return foreground;
  const goDark = isLight(background);
  let current = foreground;
  for (let i = 0; i < 28; i += 1) {
    current = goDark ? darken(current, 0.07) : lighten(current, 0.07);
    if (contrastRatio(current, background) >= target) return current;
  }
  // Último recurso: preto ou branco puro.
  return bestTextOn(background);
}

/** `#RRGGBB` + alfa → `rgba(...)`, aceite por CSS e pelo canvas. */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

/** Aumenta a saturação mantendo o tom. Usado para derivar cores de destaque. */
export function saturate(hex: string, amount: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, s: clamp(hsl.s + amount, 0, 1) });
}

/**
 * Deriva uma terceira cor plausível a partir das duas primeiras, quando a
 * empresa não indicou uma. Não é apresentada como "cor da marca": serve
 * apenas como realce por omissão e é editável.
 */
export function deriveAccent(primary: string, secondary: string): string {
  const p = hexToHsl(primary);
  const s = hexToHsl(secondary);
  // Se as duas cores forem próximas, afasta o tom; senão fica no meio.
  const delta = Math.abs(p.h - s.h);
  const hue = delta < 24 ? (p.h + 150) % 360 : (p.h + s.h) / 2;
  return hslToHex({
    h: hue,
    s: clamp(Math.max(p.s, s.s) + 0.14, 0.32, 0.95),
    l: clamp(p.l > 0.52 ? p.l - 0.1 : p.l + 0.14, 0.34, 0.68),
  });
}

/** Distância perceptual aproximada. Usada ao agrupar cores extraídas. */
export function colorDistance(a: string, b: string): number {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const rMean = (ca.r + cb.r) / 2;
  const dr = ca.r - cb.r;
  const dg = ca.g - cb.g;
  const db = ca.b - cb.b;
  return Math.sqrt(
    (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db,
  );
}

// --- Escalas tonais ---------------------------------------------------------

export type TonalStep = {
  /** 50 (mais claro) a 900 (mais escuro). */
  step: number;
  hex: string;
  /** Cor de texto legível sobre este degrau. */
  on: string;
};

/**
 * Escala tonal de uma cor de marca.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Uma cor sozinha não é um sistema. Um design system precisa de degraus: o
 * tom claro para fundos, o médio para elementos, o escuro para texto e
 * estados pressionados. É o que distingue uma paleta de oito quadrados de um
 * sistema utilizável.
 *
 * A escala é construída em HSL mantendo a matiz e ajustando a luminosidade,
 * com a saturação a cair nos extremos — subir a saturação num tom muito
 * claro dá um pastel sujo, e num tom muito escuro dá uma cor lamacenta.
 *
 * O degrau 500 é SEMPRE a cor original: é a cor da marca e não se mexe.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function tonalRamp(input: string): TonalStep[] {
  const base = safeHex(input, '#000000');
  const { h, s, l } = hexToHsl(base);

  // Alvos de luminosidade por degrau. O 500 é substituído pela cor original.
  const targets: Array<[number, number]> = [
    [50, 0.965],
    [100, 0.92],
    [200, 0.845],
    [300, 0.73],
    [400, 0.6],
    [500, l],
    [600, 0.38],
    [700, 0.29],
    [800, 0.2],
    [900, 0.12],
  ];

  return targets.map(([step, lightness]) => {
    if (step === 500) {
      return { step, hex: base, on: bestTextOn(base) };
    }

    /*
      A saturação acompanha a distância ao centro.

      Nos extremos o olho lê a cor como "cinza colorido"; manter a saturação
      cheia produziria pastéis sujos em cima e tons lamacentos em baixo.
    */
    const distance = Math.abs(lightness - 0.5) * 2;
    const saturation = clamp(s * (1 - distance * 0.45), 0, 1);

    const hex = hslToHex({ h, s: saturation, l: lightness });
    return { step, hex, on: bestTextOn(hex) };
  });
}

/** Degrau de uma escala, por número. */
export function rampStep(ramp: TonalStep[], step: number): string {
  return ramp.find((entry) => entry.step === step)?.hex ?? ramp[Math.floor(ramp.length / 2)].hex;
}
