/**
 * Catálogo de tipografia seguro para o cliente.
 *
 * Contém apenas metadados. O nome real da família (gerado pelo `next/font`,
 * ex. `"__Manrope_1a2b3c"`) é lido em runtime a partir da variável CSS
 * correspondente — é essa string que o canvas de exportação usa, garantindo
 * que a prévia e o PNG usam exactamente a mesma fonte.
 */

export type FontId = 'inter' | 'manrope' | 'jakarta' | 'grotesk' | 'playfair' | 'poppins';

export type FontEntry = {
  id: FontId;
  label: string;
  /** Variável CSS declarada pelo `next/font`. */
  cssVar: string;
  /** Como descrever a fonte a quem não é designer. */
  note: string;
  /** Pesos garantidos. Os modelos nunca pedem pesos fora desta lista. */
  weights: number[];
  /** Serifada ou não — usado nas sugestões de estilo. */
  kind: 'sans' | 'serif';
};

export const FONT_CATALOG: FontEntry[] = [
  {
    id: 'inter',
    label: 'Inter',
    cssVar: '--font-brand-inter',
    note: 'Neutra e muito legível. Boa escolha por omissão.',
    weights: [400, 500, 600, 700],
    kind: 'sans',
  },
  {
    id: 'manrope',
    label: 'Manrope',
    cssVar: '--font-brand-manrope',
    note: 'Geométrica e moderna, com formas abertas.',
    weights: [400, 500, 600, 700],
    kind: 'sans',
  },
  {
    id: 'jakarta',
    label: 'Plus Jakarta Sans',
    cssVar: '--font-brand-jakarta',
    note: 'Contemporânea e simpática. Funciona bem em títulos.',
    weights: [400, 500, 600, 700],
    kind: 'sans',
  },
  {
    id: 'grotesk',
    label: 'Space Grotesk',
    cssVar: '--font-brand-grotesk',
    note: 'Técnica e com carácter. Boa para marcas jovens.',
    weights: [400, 500, 600, 700],
    kind: 'sans',
  },
  {
    id: 'poppins',
    label: 'Poppins',
    cssVar: '--font-brand-poppins',
    note: 'Arredondada e popular em comércio e restauração.',
    weights: [400, 500, 600, 700],
    kind: 'sans',
  },
  {
    id: 'playfair',
    label: 'Playfair Display',
    cssVar: '--font-brand-playfair',
    note: 'Serifada e elegante. Indicada para beleza e alta gama.',
    weights: [400, 500, 600, 700],
    kind: 'serif',
  },
];

export const DEFAULT_DISPLAY_FONT: FontId = 'manrope';
export const DEFAULT_BODY_FONT: FontId = 'inter';

/**
 * Identificadores aceites, derivados do catálogo.
 *
 * Existe para o validador do servidor poder rejeitar uma fonte que a IA
 * invente. Derivado e não escrito à mão: acrescentar uma fonte ao catálogo
 * passa automaticamente a ser aceite.
 */
export const FONT_IDS = FONT_CATALOG.map((font) => font.id) as FontId[];

const byId = new Map(FONT_CATALOG.map((f) => [f.id, f]));

export function getFont(id: FontId | string | undefined | null): FontEntry {
  return byId.get((id ?? '') as FontId) ?? byId.get(DEFAULT_BODY_FONT)!;
}

export function isFontId(value: unknown): value is FontId {
  return typeof value === 'string' && byId.has(value as FontId);
}

const FALLBACK_STACK = 'ui-sans-serif, system-ui, sans-serif';

/**
 * Resolve a pilha de famílias real para uso em CSS e em `ctx.font`.
 * Só funciona no browser; no servidor devolve a pilha de reserva.
 */
export function resolveFontFamily(id: FontId): string {
  const entry = getFont(id);
  if (typeof document === 'undefined') return FALLBACK_STACK;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(entry.cssVar)
    .trim();
  if (!value) return FALLBACK_STACK;
  return `${value}, ${FALLBACK_STACK}`;
}

/**
 * Primeiro nome da pilha, para `document.fonts.load()`.
 * O `FontFaceSet.load` não aceita listas longas de forma fiável.
 */
export function primaryFamilyToken(fontFamily: string): string {
  const first = fontFamily.split(',')[0]?.trim();
  return first || 'sans-serif';
}
