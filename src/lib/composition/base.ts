/**
 * A cor de base de uma arte.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Cada publicação é desenhada sobre UMA das duas cores da marca — a base:
 * pinta o fundo e as grandes áreas de design. A outra é o realce: formas,
 * botão, a palavra destacada. Há empresas que alternam de propósito (uma
 * publicação clara, uma escura) para o perfil ficar ritmado; por isso a base
 * escolhe-se em cada publicação e, por omissão, é a oposta da anterior.
 *
 * Um só sítio para isto, porque três partes têm de concordar: a revisão (que
 * mostra as duas amostras), a escolha do logótipo (que depende do tom do
 * fundo) e o prompt (que diz ao gerador qual pinta o quê).
 * ──────────────────────────────────────────────────────────────────────────
 */
import type { ArtBase, BrandColors } from '@/lib/domain/types';
import { colorDistance, hexToHsl, relativeLuminance, safeHex } from '@/lib/utils/color';

export const ART_BASES: readonly ArtBase[] = ['primaria', 'secundaria'];

export const BASE_LABEL: Record<ArtBase, string> = {
  primaria: 'Cor principal',
  secundaria: 'Cor secundária',
};

export function oppositeBase(base: ArtBase): ArtBase {
  return base === 'primaria' ? 'secundaria' : 'primaria';
}

/**
 * A base que uma publicação nova recebe sem o cliente escolher: a oposta da
 * última da marca, para o feed alternar. Sem histórico, a principal.
 */
export function proposedBase(recent: ArtBase | null | undefined): ArtBase {
  return recent ? oppositeBase(recent) : 'primaria';
}

/** O hexadecimal da cor de base. */
export function baseHex(colors: BrandColors, base: ArtBase): string {
  return base === 'secundaria'
    ? safeHex(colors.secondary, '#FFFFFF')
    : safeHex(colors.primary, '#000000');
}

/**
 * A cor de realce sobre a base.
 *
 * A outra cor da marca. A terceira, quando existe, só toma o lugar dela se
 * se distinguir mais da base — uma terceira cor quase igual ao fundo não
 * realça nada.
 */
export function accentHex(colors: BrandColors, base: ArtBase): string {
  const ground = baseHex(colors, base);
  const other = baseHex(colors, oppositeBase(base));
  const third = colors.accent ? safeHex(colors.accent, other) : null;
  if (third && colorDistance(third, ground) > colorDistance(other, ground) * 1.15) return third;
  return other;
}

/** Tom previsto do fundo de uma arte desenhada sobre esta base. */
export function baseTone(colors: BrandColors, base: ArtBase): 'claro' | 'escuro' {
  // 0.18: o ponto em que o contraste contra branco iguala o contraste contra preto.
  return relativeLuminance(baseHex(colors, base)) < 0.18 ? 'escuro' : 'claro';
}

/**
 * A marca é a preto e branco (ou quase)?
 *
 * Saturação abaixo de 0.12 nas cores todas. Estas marcas são as que saíam em
 * artes cinzentas: o prompt mandava usar só as cores da marca e o gerador
 * pintava tudo, fotografia incluída, de preto e branco.
 */
export function isMonochromeBrand(colors: BrandColors): boolean {
  const all = [colors.primary, colors.secondary, colors.accent].filter(
    (hex): hex is string => typeof hex === 'string' && hex.trim().length > 0,
  );
  return all.every((hex) => hexToHsl(safeHex(hex, '#000000')).s < 0.12 || isNearNeutral(hex));
}

/** Quase branco ou quase preto: a saturação HSL engana nos extremos. */
function isNearNeutral(hex: string): boolean {
  const { l } = hexToHsl(safeHex(hex, '#000000'));
  return l > 0.95 || l < 0.06;
}
