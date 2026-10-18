/**
 * As grelhas das artes: onde fica a imagem protagonista, o texto, o
 * logótipo e os contactos.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Tiradas das artes de agência da biblioteca, não inventadas: título em
 * cima com a cena por baixo (o tabuleiro, a bandeja de jogos), título
 * centrado com o logótipo por cima (os gift cards, a Udemy), texto de um
 * lado e pessoa do outro (o Dia da Mulher), cena em cima e texto em baixo
 * (os três painéis de streaming).
 *
 * Em todas, o logótipo tem folga e vai, por omissão, EM CIMA; os contactos
 * são a última linha do bloco de texto, por baixo do botão. Uma arte real
 * saiu com o website colado por cima do logótipo e o logótipo colado à
 * aresta — com o gerador a decidir sozinho onde punha cada coisa. E três
 * gerações medidas mostraram porquê: o gerador segue o esboço no título, no
 * botão e num logótipo em cima, mas desce tudo o que é rodapé para a aresta
 * de baixo da imagem dele, que a moldura 4:5 ainda corta (ver `sketch.ts`).
 *
 * Módulo puro: serve o browser (o esboço) e o servidor (o prompt da ideia).
 * ──────────────────────────────────────────────────────────────────────────
 */
import type { LayoutId, VisualApproach } from '@/lib/domain/direction';
import type { FormatId, LogoPlacement, LogoSize } from '@/lib/domain/types';

/** Um rectângulo em fracções da área de conteúdo (dentro das margens). */
export type Region = { x: number; y: number; w: number; h: number };

export type TextRegion = Region & {
  align: 'left' | 'center';
  /** Onde o bloco de texto assenta dentro da região. */
  anchor: 'top' | 'center' | 'bottom';
};

export type LayoutSpec = {
  id: LayoutId;
  /** Para o cliente, no selector da revisão. */
  label: string;
  /** Para o modelo que propõe as ideias. */
  prompt: string;
};

export const LAYOUTS: LayoutSpec[] = [
  {
    id: 'titulo-topo',
    label: 'Título em cima, imagem por baixo',
    prompt: 'título e texto em cima, alinhados à esquerda; a imagem protagonista ocupa a parte de baixo.',
  },
  {
    id: 'titulo-centro',
    label: 'Título centrado, imagem por baixo',
    prompt: 'título centrado em cima, com o logótipo por cima dele; a imagem protagonista por baixo.',
  },
  {
    id: 'texto-esquerda',
    label: 'Texto à esquerda, imagem à direita',
    prompt: 'texto à esquerda, a meio da altura; a imagem protagonista à direita, de cima a baixo.',
  },
  {
    id: 'texto-direita',
    label: 'Texto à direita, imagem à esquerda',
    prompt: 'texto à direita, a meio da altura; a imagem protagonista à esquerda, de cima a baixo.',
  },
  {
    id: 'titulo-baixo',
    label: 'Imagem em cima, texto em baixo',
    prompt: 'a imagem protagonista ocupa a parte de cima; o texto fica em baixo, à esquerda.',
  },
  {
    id: 'tipografica',
    label: 'Título dominante',
    prompt: 'o título é o elemento maior e a imagem é de apoio, mais pequena. Só para a abordagem "tipografica".',
  },
];

export const LAYOUT_IDS = LAYOUTS.map((layout) => layout.id);

export function isLayoutId(value: unknown): value is LayoutId {
  return typeof value === 'string' && LAYOUT_IDS.includes(value as LayoutId);
}

export function getLayout(id: LayoutId): LayoutSpec {
  return LAYOUTS.find((layout) => layout.id === id) ?? LAYOUTS[0];
}

/** A grelha mais natural para cada abordagem, quando a direcção não traz nenhuma. */
export function defaultLayoutFor(approach: VisualApproach | string | undefined): LayoutId {
  switch (approach) {
    case 'tipografica':
      return 'tipografica';
    case 'editorial':
      return 'titulo-baixo';
    case 'cena-conceptual':
    case 'varios-produtos':
      return 'titulo-centro';
    case 'fotografia-simples':
      return 'titulo-topo';
    default:
      return 'texto-esquerda';
  }
}

/** Formatos deitados. Os outros são de pé ou quadrados. */
export function isLandscape(format: FormatId): boolean {
  return format === 'linkedin' || format === 'horizontal';
}

type Regions = { subject: Region; text: TextRegion; logos: LogoPlacement[] };

/*
  As regiões em fracções da ÁREA DE CONTEÚDO — o que sobra depois das
  margens, da faixa do logótipo (quando vai em cima) e da linha dos
  contactos.

  As duas regiões cruzam-se de propósito. O texto ocupa o que precisa da
  sua; a imagem fica com o resto da dela, sem tocar no texto (`clearOf`, no
  esboço). Por isso as regiões de texto são generosas: com etiqueta,
  título, apoio, preço e botão, 38% da altura não chegavam e o botão descia
  para cima do produto.

  O primeiro logótipo de cada lista é o de omissão.
*/
const PORTRAIT: Record<LayoutId, Regions> = {
  'titulo-topo': {
    text: { x: 0, y: 0, w: 0.86, h: 0.5, align: 'left', anchor: 'top' },
    subject: { x: 0, y: 0.4, w: 1, h: 0.6 },
    // Em cima por omissão: em baixo, o gerador encostou-o à aresta e a
    // moldura cortou-o. Fica como escolha do cliente.
    logos: ['superior-esquerdo', 'superior-direito', 'inferior-direito'],
  },
  'titulo-centro': {
    text: { x: 0.05, y: 0, w: 0.9, h: 0.5, align: 'center', anchor: 'top' },
    subject: { x: 0, y: 0.4, w: 1, h: 0.6 },
    logos: ['superior-centro', 'inferior-direito', 'superior-esquerdo'],
  },
  'texto-esquerda': {
    text: { x: 0, y: 0.12, w: 0.5, h: 0.76, align: 'left', anchor: 'center' },
    subject: { x: 0.46, y: 0, w: 0.54, h: 1 },
    logos: ['superior-esquerdo', 'inferior-direito', 'superior-direito'],
  },
  'texto-direita': {
    text: { x: 0.5, y: 0.12, w: 0.5, h: 0.76, align: 'left', anchor: 'center' },
    subject: { x: 0, y: 0, w: 0.54, h: 1 },
    logos: ['superior-direito', 'inferior-esquerdo', 'superior-esquerdo'],
  },
  'titulo-baixo': {
    subject: { x: 0, y: 0, w: 1, h: 0.6 },
    /*
      Acaba a 94% e não a 100%: os contactos são a última linha do bloco, e
      um bloco assente na margem de baixo punha-os onde o gerador mais
      falha — junto à aresta.
    */
    text: { x: 0, y: 0.5, w: 0.84, h: 0.44, align: 'left', anchor: 'bottom' },
    logos: ['superior-esquerdo', 'inferior-direito', 'superior-direito'],
  },
  tipografica: {
    text: { x: 0, y: 0.04, w: 0.94, h: 0.62, align: 'left', anchor: 'center' },
    subject: { x: 0.5, y: 0.6, w: 0.5, h: 0.4 },
    logos: ['superior-esquerdo', 'inferior-direito'],
  },
};

const LANDSCAPE: Record<LayoutId, Regions> = {
  'titulo-topo': {
    text: { x: 0, y: 0, w: 0.66, h: 0.56, align: 'left', anchor: 'top' },
    subject: { x: 0.36, y: 0.28, w: 0.64, h: 0.72 },
    logos: ['superior-direito', 'superior-esquerdo', 'inferior-direito'],
  },
  'titulo-centro': {
    text: { x: 0.14, y: 0, w: 0.72, h: 0.56, align: 'center', anchor: 'top' },
    subject: { x: 0.08, y: 0.4, w: 0.84, h: 0.6 },
    logos: ['superior-centro', 'inferior-direito', 'superior-esquerdo'],
  },
  'texto-esquerda': {
    text: { x: 0, y: 0.1, w: 0.46, h: 0.8, align: 'left', anchor: 'center' },
    subject: { x: 0.44, y: 0, w: 0.56, h: 1 },
    logos: ['superior-esquerdo', 'inferior-direito', 'superior-direito'],
  },
  'texto-direita': {
    text: { x: 0.54, y: 0.1, w: 0.46, h: 0.8, align: 'left', anchor: 'center' },
    subject: { x: 0, y: 0, w: 0.56, h: 1 },
    logos: ['superior-direito', 'inferior-esquerdo', 'superior-esquerdo'],
  },
  'titulo-baixo': {
    subject: { x: 0, y: 0, w: 1, h: 0.56 },
    // Folga em baixo pela mesma razão do formato de pé.
    text: { x: 0, y: 0.5, w: 0.64, h: 0.44, align: 'left', anchor: 'bottom' },
    logos: ['superior-esquerdo', 'inferior-direito', 'superior-direito'],
  },
  tipografica: {
    text: { x: 0, y: 0.06, w: 0.6, h: 0.88, align: 'left', anchor: 'center' },
    subject: { x: 0.6, y: 0.08, w: 0.4, h: 0.84 },
    logos: ['superior-esquerdo', 'inferior-direito'],
  },
};

export function regionsFor(layout: LayoutId, format: FormatId): Regions {
  return (isLandscape(format) ? LANDSCAPE : PORTRAIT)[layout] ?? PORTRAIT['texto-esquerda'];
}

/** As posições do logótipo que esta grelha aceita, a de omissão primeiro. */
export function logoPlacementsFor(layout: LayoutId, format: FormatId): LogoPlacement[] {
  return regionsFor(layout, format).logos;
}

/** A posição do logótipo que serve esta grelha: a pedida, se couber; senão, a de omissão. */
export function fitLogoPlacement(
  layout: LayoutId,
  format: FormatId,
  wanted: LogoPlacement | null | undefined,
): LogoPlacement {
  const allowed = logoPlacementsFor(layout, format);
  return wanted && allowed.includes(wanted) ? wanted : allowed[0];
}

/**
 * O tamanho do logótipo, em fracção do lado menor da arte.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Uma assinatura, não um título. Ia a 19% da largura, e o prompt pedia
 * "entre 15% e 20%": em muitas artes o logótipo competia com o título. As
 * artes de agência da biblioteca assinam com 8 a 12%.
 *
 *  · `width` — a largura no esboço, para um logótipo deitado;
 *  · `maxHeight` — o tecto da altura, para um logótipo quase quadrado não
 *    ficar enorme com a mesma largura (e nunca acima da margem: ver
 *    `computeSketch`);
 *  · `range` — o intervalo que o prompt pede ao gerador, em % da largura.
 *
 * Módulo puro, por isso aqui: o esboço (browser) e o prompt (servidor) têm
 * de dizer o mesmo número.
 * ──────────────────────────────────────────────────────────────────────────
 */
export const LOGO_SIZE_SHARE: Record<
  LogoSize,
  { width: number; maxHeight: number; range: [number, number] }
> = {
  pequeno: { width: 0.1, maxHeight: 0.065, range: [8, 11] },
  medio: { width: 0.13, maxHeight: 0.075, range: [11, 14] },
  grande: { width: 0.17, maxHeight: 0.085, range: [14, 18] },
};

export const LOGO_SIZE_LABEL: Record<LogoSize, string> = {
  pequeno: 'Pequeno',
  medio: 'Médio',
  grande: 'Grande',
};

export function isLogoSize(value: unknown): value is LogoSize {
  return value === 'pequeno' || value === 'medio' || value === 'grande';
}

export const LOGO_PLACEMENT_LABEL: Record<LogoPlacement, string> = {
  'superior-esquerdo': 'Em cima, à esquerda',
  'superior-centro': 'Em cima, ao centro',
  'superior-direito': 'Em cima, à direita',
  'inferior-esquerdo': 'Em baixo, à esquerda',
  'inferior-centro': 'Em baixo, ao centro',
  'inferior-direito': 'Em baixo, à direita',
};
