/**
 * Paleta das ARTES.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Este ficheiro não importa nada de `globals.css` nem nenhum token da
 * interface. Todas as cores devolvidas derivam exclusivamente das cores da
 * empresa (ou das cores escolhidas para a publicação em curso).
 *
 * O preto e o verde neon do painel NUNCA chegam às artes. As únicas cores
 * fixas aqui são branco, preto e os cinzas neutros necessários para garantir
 * contraste legível — e mesmo esses são misturados com a cor da marca.
 * ──────────────────────────────────────────────────────────────────────────
 */
import {
  bestTextOn,
  darken,
  deriveAccent,
  ensureContrast,
  isLight,
  lighten,
  mix,
  safeHex,
  withAlpha,
} from '@/lib/utils/color';
import type { BrandColors } from '@/lib/domain/types';

/** Esquema de fundo pedido pelo modelo. */
export type PaletteScheme = 'brand' | 'secondary' | 'light' | 'neutral' | 'dark';

export type ColorToken =
  | 'bg'
  | 'onBg'
  | 'muted'
  | 'panel'
  | 'onPanel'
  | 'panelLine'
  | 'primary'
  | 'onPrimary'
  | 'secondary'
  | 'onSecondary'
  | 'accent'
  | 'onAccent'
  | 'highlight'
  | 'onHighlight'
  | 'line'
  | 'scrim'
  | 'scrimStrong'
  | 'white'
  | 'black';

export type ArtPalette = Record<ColorToken, string>;

/**
 * Deriva a paleta completa da arte a partir das cores da empresa.
 * Garante contraste mínimo em todos os pares texto/fundo que os modelos usam.
 */
export function resolveArtPalette(colors: BrandColors, scheme: PaletteScheme): ArtPalette {
  const primary = safeHex(colors.primary, '#16324F');
  const secondary = safeHex(colors.secondary, '#D9C7A3');
  const accent = safeHex(colors.accent ?? '', deriveAccent(primary, secondary));

  let bg: string;
  switch (scheme) {
    case 'brand':
      bg = primary;
      break;
    case 'secondary':
      bg = secondary;
      break;
    case 'light':
      // Tom muito claro da cor principal: mantém a assinatura da marca.
      bg = mix(primary, '#FFFFFF', 0.9);
      break;
    case 'neutral':
      // Neutro quente com 4% da cor da marca, para não parecer branco de sistema.
      bg = mix('#F7F5F1', primary, 0.04);
      break;
    case 'dark':
      bg = mix(primary, '#0A0B0D', 0.78);
      break;
  }

  const bgIsLight = isLight(bg);
  const onBg = ensureContrast(bestTextOn(bg), bg, 7);
  const muted = ensureContrast(mix(onBg, bg, 0.38), bg, 4.5);

  // Superfície neutra sobre o fundo (cartões, molduras de produto).
  const panel = bgIsLight ? '#FFFFFF' : mix(bg, '#FFFFFF', 0.12);
  const onPanel = ensureContrast(bestTextOn(panel), panel, 7);
  const panelLine = bgIsLight ? darken(panel, 0.08) : lighten(panel, 0.1);

  const onPrimary = ensureContrast(bestTextOn(primary), primary, 4.5);
  const onSecondary = ensureContrast(bestTextOn(secondary), secondary, 4.5);
  const onAccent = ensureContrast(bestTextOn(accent), accent, 4.5);

  // Realce: a cor da marca que mais se destaca do fundo escolhido.
  const candidates: Array<[string, string]> = [
    [accent, onAccent],
    [secondary, onSecondary],
    [primary, onPrimary],
  ];
  const [highlight, onHighlight] = pickMostContrasting(candidates, bg);

  return {
    bg,
    onBg,
    muted,
    panel,
    onPanel,
    panelLine,
    primary,
    onPrimary,
    secondary,
    onSecondary,
    accent,
    onAccent,
    highlight,
    onHighlight,
    line: mix(onBg, bg, 0.76),
    scrim: withAlpha('#000000', 0.38),
    scrimStrong: withAlpha('#000000', 0.66),
    white: '#FFFFFF',
    black: '#0B0D0C',
  };
}

function pickMostContrasting(
  candidates: Array<[string, string]>,
  background: string,
): [string, string] {
  let best = candidates[0];
  let bestScore = -1;
  for (const candidate of candidates) {
    const score = Math.abs(
      relativeDistance(candidate[0], background),
    );
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

function relativeDistance(a: string, b: string): number {
  // Diferença de luminância simples: suficiente para escolher o realce.
  const la = luminance(a);
  const lb = luminance(b);
  return la - lb;
}

function luminance(hex: string): number {
  const value = safeHex(hex).slice(1);
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function token(palette: ArtPalette, name: ColorToken): string {
  return palette[name] ?? palette.onBg;
}

/**
 * Descreve a paleta por palavras, para a nota de direcção visual.
 * Não inventa nomes de cor exóticos: usa uma tabela de tons simples.
 */
export function describeColor(hex: string): string {
  const value = safeHex(hex);
  const r = parseInt(value.slice(1, 3), 16);
  const g = parseInt(value.slice(3, 5), 16);
  const b = parseInt(value.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 510;
  const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));

  const tone = lightness > 0.78 ? 'muito claro' : lightness > 0.56 ? 'claro' : lightness > 0.3 ? 'médio' : 'escuro';

  if (saturation < 0.1) {
    return lightness > 0.8 ? 'branco' : lightness < 0.18 ? 'preto' : `cinza ${tone}`;
  }

  let hue = 0;
  if (max === r) hue = ((g - b) / (max - min) + 6) % 6;
  else if (max === g) hue = (b - r) / (max - min) + 2;
  else hue = (r - g) / (max - min) + 4;
  hue *= 60;

  /*
    Os tons quentes nos extremos têm nome próprio.

    Um creme (#E7DCC8) saía "laranja muito claro" — na amostra da cor de
    base da revisão e no prompt, onde o gerador o lia como laranja. Um
    castanho saía "laranja escuro". Um amarelo-pálido muito saturado continua
    a ser amarelo: o creme é o claro quente e pouco vivo.
  */
  if (hue >= 25 && hue <= 60 && lightness > 0.72 && saturation < 0.8) {
    return lightness > 0.9 ? 'creme muito claro' : 'creme';
  }
  if (hue >= 12 && hue <= 45 && lightness < 0.4) {
    return lightness < 0.2 ? 'castanho escuro' : 'castanho';
  }

  const names: Array<[number, string]> = [
    [15, 'vermelho'],
    [40, 'laranja'],
    [65, 'amarelo'],
    [95, 'verde-lima'],
    [160, 'verde'],
    [195, 'turquesa'],
    [250, 'azul'],
    [285, 'violeta'],
    [330, 'rosa'],
    [360, 'vermelho'],
  ];
  const name = names.find(([limit]) => hue <= limit)?.[1] ?? 'azul';
  return `${name} ${tone}`;
}
