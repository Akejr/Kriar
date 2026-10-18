/**
 * Motor de composição.
 *
 * Transforma `modelo + composição + recursos` numa lista plana de camadas com
 * coordenadas absolutas em píxeis do formato escolhido (1080×1350, 1080×1080
 * ou 1080×1920). Essa lista é consumida por:
 *
 *   · `Stage.tsx`      → prévia em DOM, interactiva
 *   · `renderCanvas.ts` → PNG exportado
 *
 * Os dois recebem exactamente as mesmas camadas, com as mesmas quebras de
 * linha e os mesmos rectângulos de desenho. É isso que garante que o
 * ficheiro exportado corresponde ao que o utilizador aprovou.
 *
 * Ordem de desenho
 * ----------------
 *  1. cor base
 *  2. fundo gerado (IA ou procedimental) e o seu véu
 *  3. formas do modelo
 *  4. bases e fotografias
 *  5. gradientes do modelo (véus POR CIMA das fotografias)
 *  6. logótipo
 *  7. cápsulas e texto
 */
import { TEXT_ROLE_LABELS, formatContactForArt, getFormat } from '@/lib/domain/catalog';
import { resolveFontFamily } from '@/lib/fontCatalog';
import { getTemplateForFormat } from '@/lib/templates';
import type {
  Align,
  NBox,
  Template,
  TemplateGradient,
  TemplateImageSlot,
  TemplateItemSlot,
  TemplateStack,
  TemplateTextSlot,
} from '@/lib/templates/types';
import type {
  Brand,
  Composition,
  CompositionItem,
  LayerOverride,
  TextRole,
} from '@/lib/domain/types';
import { isLight, withAlpha } from '@/lib/utils/color';
import { resolveArtPalette, type ArtPalette, type ColorToken } from './palette';
import { fitText, type FitResult } from './textLayout';

// --- Camadas resolvidas -----------------------------------------------------

type Base = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  selectable: boolean;
  /** Nome mostrado no editor. Obrigatório nas camadas selectionáveis. */
  label?: string;
};

/**
 * Sombra de uma camada, em píxeis do espaço de desenho.
 *
 * Os valores são calculados aqui, uma vez, e aplicados tal e qual nos dois
 * renderizadores. O `blur` do CSS e o `shadowBlur` do canvas usam o mesmo
 * desvio-padrão, por isso o número passa directo e a sombra é a mesma na
 * prévia e no ficheiro exportado.
 */
export type LayerShadow = { blur: number; offsetY: number; color: string };

export type ResolvedRect = Base & {
  kind: 'rect';
  fill: string;
  radius: number;
  opacity: number;
  shadow?: LayerShadow | null;
};

export type ResolvedEllipse = Base & {
  kind: 'ellipse';
  fill: string;
  opacity: number;
  shadow?: LayerShadow | null;
};

/**
 * Forma de vértices livres. Existe para as peças triangulares do modelo 02.
 * Os pontos são fracções (0..1) da própria caixa, o que mantém a forma
 * correcta quando a peça é escalada ou realçada.
 */
export type ResolvedPolygon = Base & {
  kind: 'polygon';
  points: Array<{ x: number; y: number }>;
  fill: string;
  opacity: number;
  shadow?: LayerShadow | null;
};

export type ResolvedGradient = Base & {
  kind: 'gradient';
  direction: 'to-bottom' | 'to-top' | 'to-right' | 'to-left';
  from: string;
  to: string;
};

export type ResolvedImage = Base & {
  kind: 'image';
  assetId: string;
  src: string;
  radius: number;
  shape: 'rect' | 'ellipse';
  /** Rectângulo de desenho absoluto, sempre com as proporções originais. */
  draw: { dx: number; dy: number; dw: number; dh: number };
  /**
   * Se a caixa da camada recorta o desenho.
   *
   * Em `contain` sem cantos arredondados o desenho já cabe dentro da caixa,
   * e desligar o recorte é o que permite que a sombra siga o contorno real da
   * fotografia — igual em DOM (`drop-shadow`) e em canvas (`shadowBlur`).
   */
  clip: boolean;
  shadow: boolean;
  label: string;
  /**
   * `produto` e `peca` podem ser substituídos pelo utilizador; `logo` e
   * `fundo` não. `peca` entra na superfície de uma das opções, por isso
   * traz também o `itemId` para o editor saber o que actualizar.
   */
  role: ImageRole;
  slotId: string;
  itemId?: string;
};

export type ImageRole = 'produto' | 'logo' | 'fundo' | 'peca';

export type ResolvedPlaceholder = Base & {
  kind: 'placeholder';
  radius: number;
  shape: 'rect' | 'ellipse';
  label: string;
  fill: string;
  stroke: string;
  slotId: string;
  role: ImageRole;
  itemId?: string;
};

/**
 * O que a edição em linha altera quando este texto é confirmado.
 *
 * Um papel do modelo (`headline`, `price`, …) escreve em
 * `composition.texts`; o nome de uma peça escreve em `composition.items`.
 * Sem esta distinção, editar o nome de uma peça na prévia iria sobrepor-se
 * ao título.
 */
export type TextTarget =
  | { kind: 'role'; role: TextRole }
  | { kind: 'item'; itemId: string };

export type ResolvedText = Base & {
  kind: 'text';
  target: TextTarget;
  lines: string[];
  fontSize: number;
  lineHeightPx: number;
  fontFamily: string;
  fontWeight: number;
  /** `display` ou `body`: diz qual fonte da marca este texto usa. */
  fontRole: 'display' | 'body';
  tracking: number;
  align: Align;
  color: string;
  locked: boolean;
  label: string;
  overflow: boolean;
  /** Texto cru (sem maiúsculas forçadas), para a edição em linha. */
  rawValue: string;
  uppercase: boolean;
};

export type ResolvedLayer =
  | ResolvedRect
  | ResolvedEllipse
  | ResolvedPolygon
  | ResolvedGradient
  | ResolvedImage
  | ResolvedPlaceholder
  | ResolvedText;

export type ResolvedWarning = {
  id: string;
  level: 'aviso' | 'erro';
  layerId?: string;
  message: string;
};

export type ResolvedArtwork = {
  width: number;
  height: number;
  layers: ResolvedLayer[];
  warnings: ResolvedWarning[];
  palette: ArtPalette;
  safeArea: { x: number; y: number; w: number; h: number };
  template: Template;
  /** Compartimentos de imagem por ordem de prioridade, para o editor. */
  imageSlots: Array<{ slotId: string; label: string; assetId: string | null }>;
  /**
   * Peças efectivamente desenhadas, na ordem em que foram distribuídas.
   * Compartimentos sem conteúdo não aparecem aqui: a arte final nunca
   * inventa opções para preencher espaço.
   */
  items: Array<{
    slotId: string;
    itemId: string;
    role: TemplateItemSlot['role'];
    highlighted: boolean;
  }>;
};

export type ResolvedAsset = {
  url: string;
  width: number | null;
  height: number | null;
};

export type ResolveInput = {
  composition: Composition;
  brand: Brand;
  assets: Record<string, ResolvedAsset | undefined>;
  /**
   * `rascunho` mostra marcadores neutros para o que ainda não existe.
   * `final` omite-os, para que o PNG nunca contenha indicações de edição.
   */
  mode?: 'rascunho' | 'final';
};

// --- Auxiliares -------------------------------------------------------------

const DEFAULT_OVERRIDE: LayerOverride = { dx: 0, dy: 0, scale: 1 };

function overrideFor(composition: Composition, layerId: string): LayerOverride {
  return composition.overrides[layerId] ?? DEFAULT_OVERRIDE;
}

function boxToPx(box: NBox, W: number, H: number) {
  return { x: box.x * W, y: box.y * H, w: box.w * W, h: box.h * H };
}

type PxBox = { x: number; y: number; w: number; h: number };

/**
 * Caixa interior, em fracções da caixa que a contém.
 *
 * Convenção diferente da `NBox`: aqui tanto `x`/`w` como `y`/`h` são
 * fracções do PAI, não da arte. Serve para posicionar a imagem e o nome
 * dentro de uma peça, que pode ser escalada ou realçada.
 */
type FracBox = { x: number; y: number; w: number; h: number };

function insetBox(parent: PxBox, frac: FracBox): PxBox {
  return {
    x: parent.x + frac.x * parent.w,
    y: parent.y + frac.y * parent.h,
    w: frac.w * parent.w,
    h: frac.h * parent.h,
  };
}

function gradientStops(
  gradient: TemplateGradient,
  palette: ArtPalette,
): { from: string; to: string } {
  const from = palette[gradient.from];
  const to = palette[gradient.to];
  return {
    from: gradient.fromAlpha === undefined ? from : withAlpha(from, gradient.fromAlpha),
    to: gradient.toAlpha === undefined ? to : withAlpha(to, gradient.toAlpha),
  };
}

/** Rectângulo de desenho que preserva sempre as proporções da fotografia. */
function imageDrawRect(
  box: { x: number; y: number; w: number; h: number },
  natural: { width: number; height: number },
  fit: 'cover' | 'contain',
  focal: { x: number; y: number },
) {
  const ratio = natural.width / natural.height;
  const boxRatio = box.w / box.h;
  let dw: number;
  let dh: number;

  if (fit === 'contain' ? ratio > boxRatio : ratio < boxRatio) {
    dw = box.w;
    dh = box.w / ratio;
  } else {
    dh = box.h;
    dw = box.h * ratio;
  }

  if (fit === 'contain') {
    return { dx: box.x + (box.w - dw) / 2, dy: box.y + (box.h - dh) / 2, dw, dh };
  }
  // `cover`: posiciona pelo ponto focal, sem sair da caixa.
  const maxShiftX = Math.max(0, dw - box.w);
  const maxShiftY = Math.max(0, dh - box.h);
  const dx = box.x - maxShiftX * clamp01(focal.x);
  const dy = box.y - maxShiftY * clamp01(focal.y);
  return { dx, dy, dw, dh };
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function scaleBox(box: PxBox, scale: number): PxBox {
  if (scale === 1) return box;
  const w = box.w * scale;
  const h = box.h * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

function alignX(align: Align, x: number, w: number, contentWidth: number): number {
  if (align === 'center') return x + (w - contentWidth) / 2;
  if (align === 'right') return x + w - contentWidth;
  return x;
}

// --- Texto dos contactos ----------------------------------------------------

function buildContactsText(composition: Composition, singleLine: boolean): string {
  const parts = composition.contacts
    .map((contact) => formatContactForArt(contact.type, contact.value))
    .filter(Boolean);
  if (parts.length === 0) return '';
  return singleLine ? parts.join('  ·  ') : parts.join('\n');
}

// --- Resolução --------------------------------------------------------------

export function resolveComposition(input: ResolveInput): ResolvedArtwork {
  const { composition, brand, assets } = input;
  const mode = input.mode ?? 'rascunho';

  const format = getFormat(composition.format);
  const W = format.width;
  const H = format.height;

  const template = getTemplateForFormat(
    composition.templateId,
    composition.format,
    composition.variantId,
  );
  const palette = resolveArtPalette(composition.colors, template.scheme);
  const layers: ResolvedLayer[] = [];
  const warnings: ResolvedWarning[] = [];

  const familyDisplay = resolveFontFamily(composition.fontDisplay);
  const familyBody = resolveFontFamily(composition.fontBody);
  const familyOf = (font: 'display' | 'body') =>
    font === 'display' ? familyDisplay : familyBody;

  // 1. Cor base ------------------------------------------------------------
  layers.push({
    kind: 'rect',
    id: 'bg',
    x: 0,
    y: 0,
    w: W,
    h: H,
    radius: 0,
    opacity: 1,
    fill: palette[template.background.base],
    selectable: false,
  });

  // 2. Fundo gerado --------------------------------------------------------
  const generated = template.background.generated;
  if (generated) {
    const box = boxToPx(generated.box, W, H);
    const asset = composition.background.assetId
      ? assets[composition.background.assetId]
      : undefined;

    if (composition.background.mode === 'gerado' && asset?.url) {
      const natural = {
        width: asset.width ?? box.w,
        height: asset.height ?? box.h,
      };
      layers.push({
        kind: 'image',
        id: 'bg.generated',
        ...box,
        assetId: composition.background.assetId!,
        src: asset.url,
        radius: 0,
        shape: 'rect',
        draw: imageDrawRect(box, natural, 'cover', { x: 0.5, y: 0.5 }),
        clip: true,
        shadow: false,
        label: 'Fundo gerado',
        role: 'fundo',
        slotId: 'background',
        selectable: false,
      });
      if (generated.scrim) {
        const scrimBox = boxToPx(generated.scrim.box, W, H);
        const stops = gradientStops(generated.scrim, palette);
        layers.push({
          kind: 'gradient',
          id: 'bg.generated.scrim',
          ...scrimBox,
          direction: generated.scrim.direction,
          from: stops.from,
          to: stops.to,
          selectable: false,
        });
      }
    } else if (mode === 'rascunho' && composition.background.mode === 'gerado') {
      // Pedido de fundo gerado sem recurso disponível: marcador neutro.
      layers.push({
        kind: 'placeholder',
        id: 'bg.generated',
        ...box,
        radius: 0,
        shape: 'rect',
        label: 'Fundo por gerar',
        fill: withAlpha(palette.onBg, 0.05),
        stroke: withAlpha(palette.onBg, 0.16),
        slotId: 'background',
        role: 'fundo',
        selectable: false,
      });
    }
  }

  // 3. Formas do modelo ----------------------------------------------------
  template.background.shapes?.forEach((shape, index) => {
    const box = boxToPx(shape.box, W, H);
    if (shape.type === 'ellipse') {
      layers.push({
        kind: 'ellipse',
        id: `bg.shape.${shape.id ?? index}`,
        ...box,
        fill: palette[shape.color],
        opacity: shape.opacity ?? 1,
        selectable: false,
      });
    } else {
      layers.push({
        kind: 'rect',
        id: `bg.shape.${shape.id ?? index}`,
        ...box,
        fill: palette[shape.color],
        opacity: shape.opacity ?? 1,
        radius: (shape.radius ?? 0) * W,
        selectable: false,
      });
    }
  });

  // 4. Fotografias ---------------------------------------------------------
  const slotAssignments = assignImages(template, composition);
  const imageSlotsReport: ResolvedArtwork['imageSlots'] = [];

  for (const { slot, assetId } of slotAssignments) {
    const override = overrideFor(composition, `img.${slot.id}`);
    const rawBox = boxToPx(slot.box, W, H);
    const box = scaleBox(rawBox, override.scale);
    box.x += override.dx * W;
    box.y += override.dy * H;

    imageSlotsReport.push({ slotId: slot.id, label: slot.label, assetId });

    // A base só é desenhada se o compartimento tiver fotografia. Na arte
    // final, um painel vazio pareceria um erro de composição.
    if (slot.plate && (assetId || mode === 'rascunho')) {
      const inset = (slot.plate.inset ?? 0) * W;
      layers.push({
        kind: 'rect',
        id: `img.${slot.id}.plate`,
        x: box.x - inset,
        y: box.y - inset,
        w: box.w + inset * 2,
        h: box.h + inset * 2,
        fill: palette[slot.plate.color],
        opacity: 1,
        radius: (slot.plate.radius ?? slot.radius ?? 0) * W,
        selectable: false,
      });
    }

    const asset = assetId ? assets[assetId] : undefined;
    if (asset?.url && asset.width && asset.height) {
      const image = composition.images.find((i) => i.assetId === assetId);
      const radius = (slot.radius ?? 0) * W;
      const shape = slot.shape ?? 'rect';
      layers.push({
        kind: 'image',
        id: `img.${slot.id}`,
        ...box,
        assetId: assetId!,
        src: asset.url,
        radius,
        shape,
        draw: imageDrawRect(
          box,
          { width: asset.width, height: asset.height },
          slot.fit,
          image?.focal ?? { x: 0.5, y: 0.5 },
        ),
        clip: slot.fit === 'cover' || shape === 'ellipse' || radius > 0,
        shadow: slot.shadow ?? false,
        label: slot.label,
        role: 'produto',
        slotId: slot.id,
        selectable: true,
      });
    } else if (mode === 'rascunho') {
      layers.push({
        kind: 'placeholder',
        id: `img.${slot.id}`,
        ...box,
        radius: (slot.radius ?? 0) * W,
        shape: slot.shape ?? 'rect',
        label: assetId ? 'A carregar fotografia' : slot.label,
        fill: withAlpha(palette.onBg, 0.05),
        stroke: withAlpha(palette.onBg, 0.2),
        slotId: slot.id,
        role: 'produto',
        selectable: true,
      });
    }
  }

  const usedAssetIds = new Set(
    slotAssignments.map((a) => a.assetId).filter((id): id is string => Boolean(id)),
  );
  const unused = composition.images.filter((img) => !usedAssetIds.has(img.assetId));
  if (unused.length > 0) {
    warnings.push({
      id: 'imagens-nao-usadas',
      level: 'aviso',
      message:
        unused.length === 1
          ? '1 fotografia não está a ser usada neste modelo. Escolhe outra composição para a incluir.'
          : `${unused.length} fotografias não estão a ser usadas neste modelo. Escolhe outra composição para as incluir.`,
    });
  }

  // 5. Peças -------------------------------------------------------------
  const itemsResult = layoutItems({
    template,
    composition,
    assets,
    palette,
    familyOf,
    W,
    H,
    mode,
  });
  layers.push(...itemsResult.layers);
  warnings.push(...itemsResult.warnings);

  // 6. Gradientes do modelo (por cima das fotografias) ---------------------
  template.background.gradients?.forEach((gradient, index) => {
    const box = boxToPx(gradient.box, W, H);
    const stops = gradientStops(gradient, palette);
    layers.push({
      kind: 'gradient',
      id: `bg.gradient.${gradient.id ?? index}`,
      ...box,
      direction: gradient.direction,
      from: stops.from,
      to: stops.to,
      selectable: false,
    });
  });

  // 7. Logótipo ------------------------------------------------------------
  if (composition.logo.show) {
    const logoLayer = resolveLogo({ template, composition, brand, assets, palette, W, H, mode });
    if (logoLayer) layers.push(logoLayer);
    else if (mode === 'rascunho' && !brand.identity.logoAssetId) {
      warnings.push({
        id: 'sem-logotipo',
        level: 'aviso',
        message: 'Ainda não carregaste um logótipo. Podes fazê-lo na área Marca.',
      });
    }
  }

  // 8. Texto ---------------------------------------------------------------
  for (const stack of template.stacks) {
    const result = layoutStack({
      stack,
      template,
      composition,
      palette,
      familyOf,
      W,
      H,
    });
    layers.push(...result.layers);
    warnings.push(...result.warnings);
  }

  return {
    width: W,
    height: H,
    layers,
    warnings,
    palette,
    safeArea: {
      x: template.safeMargin.x * W,
      y: template.safeMargin.y * H,
      w: W * (1 - template.safeMargin.x * 2),
      h: H * (1 - template.safeMargin.y * 2),
    },
    template,
    imageSlots: imageSlotsReport,
    items: itemsResult.report,
  };
}

// --- Distribuição das fotografias ------------------------------------------

function assignImages(
  template: Template,
  composition: Composition,
): Array<{ slot: TemplateImageSlot; assetId: string | null }> {
  const slots = [...template.imageSlots].sort((a, b) => a.priority - b.priority);
  const images = composition.images;
  if (images.length === 0) return slots.map((slot) => ({ slot, assetId: null }));

  const mainIndex = Math.min(Math.max(composition.mainImageIndex, 0), images.length - 1);
  const ordered = [images[mainIndex], ...images.filter((_, i) => i !== mainIndex)];

  return slots.map((slot, index) => ({
    slot,
    assetId: ordered[index]?.assetId ?? null,
  }));
}

// --- Peças ------------------------------------------------------------------

/**
 * Geometria interna de cada forma de peça, em fracções da caixa da peça.
 *
 * `content` é onde a imagem do cliente assenta; `label` é a faixa do nome.
 * O triângulo tem valores mais apertados porque a largura útil diminui à
 * medida que se sobe — centrar o nome na caixa deixaria-o a sair pelos lados
 * inclinados.
 *
 * A imagem assenta DENTRO desta zona e nunca é recortada pela silhueta da
 * peça. É uma escolha: recortar uma fotografia de produto num triângulo
 * estragaria o produto, que é precisamente o que o cliente quer mostrar.
 */
const ITEM_SHAPE: Record<
  TemplateItemSlot['shape'],
  { content: FracBox; label: FracBox; points?: Array<{ x: number; y: number }> }
> = {
  quadrado: {
    content: { x: 0.13, y: 0.11, w: 0.74, h: 0.53 },
    label: { x: 0.08, y: 0.69, w: 0.84, h: 0.21 },
  },
  circulo: {
    content: { x: 0.2, y: 0.16, w: 0.6, h: 0.45 },
    label: { x: 0.13, y: 0.64, w: 0.74, h: 0.2 },
  },
  triangulo: {
    content: { x: 0.3, y: 0.33, w: 0.4, h: 0.31 },
    label: { x: 0.17, y: 0.69, w: 0.66, h: 0.19 },
    points: [
      { x: 0.5, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
  },
};

/**
 * Distribuição das peças pelos compartimentos.
 *
 * A peça em destaque ocupa o compartimento `principal`; as restantes seguem
 * a ordem em que o utilizador as escreveu. Compartimentos a mais ficam
 * VAZIOS — repetir conteúdo para encher a composição faria a arte afirmar
 * que a empresa tem mais opções do que indicou.
 */
function assignItems(
  template: Template,
  composition: Composition,
): Array<{ slot: TemplateItemSlot; item: CompositionItem | null; highlighted: boolean }> {
  const slots = [...template.itemSlots].sort(
    (a, b) => (a.role === 'principal' ? 0 : 1) - (b.role === 'principal' ? 0 : 1),
  );
  const items = composition.items;
  if (items.length === 0) {
    return slots.map((slot) => ({ slot, item: null, highlighted: false }));
  }

  const index = Math.min(Math.max(composition.highlightedItemIndex, 0), items.length - 1);
  const ordered = [items[index], ...items.filter((_, position) => position !== index)];

  return slots.map((slot, position) => ({
    slot,
    item: ordered[position] ?? null,
    highlighted: position === 0,
  }));
}

function layoutItems(args: {
  template: Template;
  composition: Composition;
  assets: Record<string, ResolvedAsset | undefined>;
  palette: ArtPalette;
  familyOf: (font: 'display' | 'body') => string;
  W: number;
  H: number;
  mode: 'rascunho' | 'final';
}): {
  layers: ResolvedLayer[];
  report: ResolvedArtwork['items'];
  warnings: ResolvedWarning[];
} {
  const { template, composition, assets, palette, familyOf, W, H, mode } = args;
  const layers: ResolvedLayer[] = [];
  const report: ResolvedArtwork['items'] = [];
  const warnings: ResolvedWarning[] = [];

  if (template.itemSlots.length === 0) return { layers, report, warnings };

  const assignments = assignItems(template, composition);
  // A ordem de desenho é a do modelo (`z`), não a da distribuição: é o que
  // dá a sobreposição correcta entre peças vizinhas.
  const drawOrder = [...assignments].sort((a, b) => a.slot.z - b.slot.z);

  let unnamed = 0;

  for (const { slot, item, highlighted } of drawOrder) {
    const rawBox = boxToPx(slot.box, W, H);

    if (!item) {
      // Lugar vago. Só no rascunho: na arte final um contorno tracejado
      // pareceria um erro de composição.
      if (mode === 'rascunho') {
        layers.push({
          kind: 'placeholder',
          id: `item.${slot.id}`,
          ...rawBox,
          radius: (slot.radius ?? 0) * W,
          shape: slot.shape === 'circulo' ? 'ellipse' : 'rect',
          label: 'Opção livre',
          fill: withAlpha(palette.onBg, 0.04),
          stroke: withAlpha(palette.onBg, 0.18),
          slotId: slot.id,
          role: 'peca',
          selectable: false,
        });
      }
      continue;
    }

    const geometry = ITEM_SHAPE[slot.shape];
    const name = item.name.trim();
    if (!name) unnamed += 1;

    /**
     * Realce da peça escolhida: fica maior, sobe o equivalente ao que
     * cresceu e projecta sombra mais longa. Substitui a mão da referência,
     * que não está implementada (ver `assembly.missing`).
     */
    const emphasis = highlighted ? (slot.lift ?? 1) : 1;
    const lifted = scaleBox(rawBox, emphasis);
    lifted.y -= (emphasis - 1) * rawBox.h;

    const override = overrideFor(composition, `item.${slot.id}`);
    const box = scaleBox(lifted, override.scale);
    box.x += override.dx * W;
    box.y += override.dy * H;

    const spread = 1 + (emphasis - 1) * 4;
    const shadow: LayerShadow = {
      blur: W * 0.026 * spread,
      offsetY: W * 0.011 * spread,
      color: withAlpha('#000000', 0.34),
    };

    const editorLabel = name || (highlighted ? 'Opção em destaque' : 'Opção');
    const surface = palette[slot.surface];

    if (geometry.points) {
      layers.push({
        kind: 'polygon',
        id: `item.${slot.id}`,
        ...box,
        points: geometry.points,
        fill: surface,
        opacity: 1,
        shadow,
        label: editorLabel,
        selectable: true,
      });
    } else if (slot.shape === 'circulo') {
      layers.push({
        kind: 'ellipse',
        id: `item.${slot.id}`,
        ...box,
        fill: surface,
        opacity: 1,
        shadow,
        label: editorLabel,
        selectable: true,
      });
    } else {
      layers.push({
        kind: 'rect',
        id: `item.${slot.id}`,
        ...box,
        fill: surface,
        opacity: 1,
        radius: (slot.radius ?? 0) * W,
        shadow,
        label: editorLabel,
        selectable: true,
      });
    }

    // Imagem da peça -------------------------------------------------------
    const content = insetBox(box, geometry.content);
    const asset = item.assetId ? assets[item.assetId] : undefined;

    if (asset?.url && asset.width && asset.height) {
      layers.push({
        kind: 'image',
        id: `item.${slot.id}.image`,
        ...content,
        assetId: item.assetId!,
        src: asset.url,
        radius: 0,
        shape: 'rect',
        draw: imageDrawRect(
          content,
          { width: asset.width, height: asset.height },
          'contain',
          { x: 0.5, y: 0.5 },
        ),
        clip: false,
        shadow: false,
        label: `Imagem de ${editorLabel}`,
        role: 'peca',
        slotId: slot.id,
        itemId: item.id,
        selectable: true,
      });
    } else if (mode === 'rascunho') {
      layers.push({
        kind: 'placeholder',
        id: `item.${slot.id}.image`,
        ...content,
        radius: W * 0.008,
        shape: 'rect',
        label: 'Imagem',
        fill: withAlpha(palette[slot.onSurface], 0.08),
        stroke: withAlpha(palette[slot.onSurface], 0.3),
        slotId: slot.id,
        role: 'peca',
        itemId: item.id,
        selectable: true,
      });
    }

    // Nome da peça ---------------------------------------------------------
    if (name) {
      const labelRect = insetBox(box, geometry.label);
      const fit = fitText({
        text: name,
        maxWidth: labelRect.w,
        maxHeight: labelRect.h,
        fontFamily: familyOf('display'),
        fontWeight: 600,
        idealSize: slot.labelSize * W * emphasis,
        minSize: slot.labelSize * W * 0.62,
        maxLines: 2,
        lineHeight: 1.12,
      });

      if (fit.lines.length > 0) {
        layers.push({
          kind: 'text',
          id: `item.${slot.id}.label`,
          x: labelRect.x,
          y: labelRect.y + (labelRect.h - fit.height) / 2,
          w: labelRect.w,
          h: fit.height,
          target: { kind: 'item', itemId: item.id },
          lines: fit.lines,
          fontSize: fit.fontSize,
          lineHeightPx: fit.lineHeightPx,
          fontFamily: familyOf('display'),
          fontWeight: 600,
          fontRole: 'display',
          tracking: 0,
          align: 'center',
          color: palette[slot.onSurface],
          locked: item.locked,
          label: 'Nome da opção',
          overflow: fit.overflow,
          rawValue: item.name,
          uppercase: false,
          selectable: true,
        });

        if (fit.overflow) {
          warnings.push({
            id: `corte-peca-${slot.id}`,
            level: 'aviso',
            layerId: `item.${slot.id}.label`,
            message: `O nome "${name}" não cabe na peça. Usa uma palavra mais curta.`,
          });
        }
      }
    }

    report.push({ slotId: slot.id, itemId: item.id, role: slot.role, highlighted });
  }

  // Avisos sobre a quantidade de opções ----------------------------------
  const total = composition.items.length;
  const capacity = template.itemSlots.length;

  if (total > capacity) {
    warnings.push({
      id: 'pecas-a-mais',
      level: 'aviso',
      message:
        total - capacity === 1
          ? '1 opção não cabe neste modelo. Remove-a ou escolhe outra composição.'
          : `${total - capacity} opções não cabem neste modelo. Remove algumas ou escolhe outra composição.`,
    });
  }

  if (total > 0 && total < template.itemRange.min) {
    warnings.push({
      id: 'pecas-a-menos',
      level: 'aviso',
      message: `Este modelo foi pensado para ${template.itemRange.min} a ${template.itemRange.max} opções. Com ${total} a composição fica vazia de um lado.`,
    });
  }

  if (unnamed > 0) {
    warnings.push({
      id: 'pecas-sem-nome',
      level: 'aviso',
      message:
        unnamed === 1
          ? 'Uma das opções ainda não tem nome. Sem nome, a peça sai sem texto.'
          : `${unnamed} opções ainda não têm nome. Sem nome, as peças saem sem texto.`,
    });
  }

  return { layers, report, warnings };
}

// --- Logótipo ---------------------------------------------------------------

function resolveLogo(args: {
  template: Template;
  composition: Composition;
  brand: Brand;
  assets: Record<string, ResolvedAsset | undefined>;
  palette: ArtPalette;
  W: number;
  H: number;
  mode: 'rascunho' | 'final';
}): ResolvedLayer | null {
  const { template, composition, brand, assets, palette, W, H, mode } = args;
  const slot = template.logo;

  const backgroundBehind = palette[slot.over as ColorToken] ?? palette.bg;
  const behindIsLight = isLight(stripAlpha(backgroundBehind, palette));

  const identity = brand.identity;
  let assetId: string | null = null;
  switch (composition.logo.variant) {
    case 'fundo-claro':
      assetId = identity.logoForLightBgAssetId ?? identity.logoAssetId;
      break;
    case 'fundo-escuro':
      assetId = identity.logoForDarkBgAssetId ?? identity.logoAssetId;
      break;
    case 'principal':
      assetId = identity.logoAssetId;
      break;
    case 'auto':
    default:
      assetId = behindIsLight
        ? (identity.logoForLightBgAssetId ?? identity.logoAssetId)
        : (identity.logoForDarkBgAssetId ?? identity.logoAssetId);
      break;
  }

  // Caixa: a altura é fracção da LARGURA, para o logótipo manter o mesmo
  // tamanho absoluto em todos os formatos.
  const boxW = slot.w * W;
  const boxH = slot.h * W;
  const override = overrideFor(composition, 'logo');

  // `slot.x` é a posição da âncora; `align` diz de que lado a caixa cresce.
  const anchorX = slot.x * W;
  const x =
    slot.align === 'center' ? anchorX - boxW / 2 : slot.align === 'right' ? anchorX - boxW : anchorX;
  const yTop =
    slot.vAlign === 'bottom'
      ? H - slot.y * H - boxH
      : slot.vAlign === 'middle'
        ? slot.y * H - boxH / 2
        : slot.y * H;

  const rawBox = { x, y: yTop, w: boxW, h: boxH };
  const box = scaleBox(rawBox, override.scale);
  box.x += override.dx * W;
  box.y += override.dy * H;

  const asset = assetId ? assets[assetId] : undefined;
  if (asset?.url && asset.width && asset.height) {
    return {
      kind: 'image',
      id: 'logo',
      ...box,
      assetId: assetId!,
      src: asset.url,
      radius: 0,
      shape: 'rect',
      // `contain` garante que o logótipo original nunca é esticado nem cortado.
      draw: imageDrawRect(box, { width: asset.width, height: asset.height }, 'contain', {
        x: 0.5,
        y: 0.5,
      }),
      clip: false,
      shadow: false,
      label: 'Logótipo',
      role: 'logo',
      slotId: 'logo',
      selectable: true,
    };
  }

  if (mode === 'rascunho') {
    return {
      kind: 'placeholder',
      id: 'logo',
      ...box,
      radius: 4,
      shape: 'rect',
      label: 'Logótipo',
      fill: withAlpha(palette.onBg, 0.04),
      stroke: withAlpha(palette.onBg, 0.22),
      slotId: 'logo',
      role: 'logo',
      selectable: false,
    };
  }
  return null;
}

/** Os véus são `rgba(...)`: para medir a luminosidade usamos a cor de fundo. */
function stripAlpha(color: string, palette: ArtPalette): string {
  return color.startsWith('rgba') ? palette.bg : color;
}

// --- Grupos de fluxo --------------------------------------------------------

type StackLayoutArgs = {
  stack: TemplateStack;
  template: Template;
  composition: Composition;
  palette: ArtPalette;
  familyOf: (font: 'display' | 'body') => string;
  W: number;
  H: number;
};

type MeasuredItem =
  | {
      kind: 'text';
      slot: TemplateTextSlot;
      fit: FitResult;
      rawValue: string;
      height: number;
      pillHeight: number;
      pillWidth: number;
      locked: boolean;
    }
  | { kind: 'rule'; color: ColorToken; thickness: number; width: number; height: number }
  | { kind: 'space'; height: number };

function layoutStack(args: StackLayoutArgs): {
  layers: ResolvedLayer[];
  warnings: ResolvedWarning[];
} {
  const { stack, template, composition, palette, familyOf, W, H } = args;
  const layers: ResolvedLayer[] = [];
  const warnings: ResolvedWarning[] = [];

  const colX = stack.x * W;
  const colW = stack.w * W;
  const gap = stack.gap * W;

  const measure = (maxHeights?: Map<TextRole, number>): MeasuredItem[] => {
    const out: MeasuredItem[] = [];
    for (const item of stack.items) {
      if (item.kind === 'space') {
        out.push({ kind: 'space', height: item.size * W });
        continue;
      }
      if (item.kind === 'rule') {
        out.push({
          kind: 'rule',
          color: item.color,
          thickness: item.thickness * W,
          width: item.width * W,
          height: item.thickness * W,
        });
        continue;
      }

      const slot = item.slot;
      const rawValue = textValueFor(slot, composition);
      if (!rawValue) continue;

      const override = overrideFor(composition, `text.${slot.role}`);
      const padX = (slot.pill?.padX ?? 0) * W;
      const padY = (slot.pill?.padY ?? 0) * W;
      const available = Math.max(16, colW - padX * 2);

      const fit = fitText({
        text: rawValue,
        maxWidth: available,
        maxHeight: maxHeights?.get(slot.role),
        fontFamily: familyOf(slot.font),
        fontWeight: slot.weight,
        idealSize: slot.size * W * override.scale,
        minSize: Math.min(slot.minSize * W, slot.size * W * override.scale),
        maxLines: slot.maxLines,
        lineHeight: slot.lineHeight,
        tracking: slot.tracking,
        uppercase: slot.uppercase,
      });

      if (fit.lines.length === 0) continue;

      const pillHeight = slot.pill ? fit.height + padY * 2 : fit.height;
      const pillWidth = slot.pill ? Math.min(colW, fit.width + padX * 2) : fit.width;

      out.push({
        kind: 'text',
        slot,
        fit,
        rawValue,
        height: pillHeight,
        pillHeight,
        pillWidth,
        locked: composition.texts[slot.role]?.locked ?? false,
      });
    }
    return out;
  };

  let items = measure();
  if (items.length === 0) return { layers, warnings };
  // Um grupo sem nenhum texto com conteúdo não deve deixar réguas soltas.
  if (!items.some((item) => item.kind === 'text')) return { layers, warnings };

  const totalOf = (list: MeasuredItem[]) =>
    list.reduce((sum, item) => sum + item.height, 0) + gap * Math.max(0, list.length - 1);

  let total = totalOf(items);
  const available = availableHeight(stack, template, H);

  // Se não cabe, reparte a altura disponível pelos blocos de texto na
  // proporção do que cada um pediria, e volta a ajustar. É monótono: nunca
  // provoca sobreposição.
  if (total > available) {
    const textItems = items.filter((i): i is Extract<MeasuredItem, { kind: 'text' }> => i.kind === 'text');
    const fixed = items
      .filter((i) => i.kind !== 'text')
      .reduce((sum, item) => sum + item.height, 0);
    const budget = available - fixed - gap * Math.max(0, items.length - 1);
    const requested = textItems.reduce((sum, item) => sum + item.height, 0);

    if (budget > 0 && requested > 0) {
      const ratio = budget / requested;
      const maxHeights = new Map<TextRole, number>();
      for (const item of textItems) {
        const padY = (item.slot.pill?.padY ?? 0) * W;
        maxHeights.set(item.slot.role, Math.max(item.fit.lineHeightPx, item.height * ratio - padY * 2));
      }
      items = measure(maxHeights);
      total = totalOf(items);
    }

    if (total > available + 1) {
      warnings.push({
        id: `espaco-${stack.id}`,
        level: 'aviso',
        message:
          'O conteúdo não cabe com folga neste espaço. Reduz o texto ou experimenta outra composição.',
      });
    }
  }

  const top = anchorTop(stack, total, H);

  let cursor = top;
  for (const item of items) {
    if (item.kind === 'space') {
      cursor += item.height + gap;
      continue;
    }

    if (item.kind === 'rule') {
      layers.push({
        kind: 'rect',
        id: `rule.${stack.id}.${Math.round(cursor)}`,
        x: alignX(stack.align, colX, colW, item.width),
        y: cursor,
        w: item.width,
        h: Math.max(1, item.thickness),
        fill: palette[item.color],
        opacity: 1,
        radius: item.thickness / 2,
        selectable: false,
      });
      cursor += item.height + gap;
      continue;
    }

    const slot = item.slot;
    const override = overrideFor(composition, `text.${slot.role}`);
    const align = override.align ?? slot.align ?? stack.align;
    const offsetX = override.dx * W;
    const offsetY = override.dy * H;

    let textX = colX;
    let textW = colW;

    const padY = (slot.pill?.padY ?? 0) * W;

    if (slot.pill) {
      const pillX = alignX(align, colX, colW, item.pillWidth);
      layers.push({
        kind: 'rect',
        id: `text.${slot.role}.pill`,
        x: pillX + offsetX,
        y: cursor + offsetY,
        w: item.pillWidth,
        h: item.pillHeight,
        fill: palette[slot.pill.color],
        opacity: 1,
        radius: Math.min(item.pillHeight * slot.pill.radius, item.pillWidth / 2),
        selectable: false,
      });
      textX = pillX;
      textW = item.pillWidth;
      cursor += padY;
    }

    layers.push({
      kind: 'text',
      id: `text.${slot.role}`,
      x: textX + offsetX,
      y: cursor + offsetY,
      w: textW,
      h: item.fit.height,
      target: { kind: 'role', role: slot.role },
      lines: item.fit.lines,
      fontSize: item.fit.fontSize,
      lineHeightPx: item.fit.lineHeightPx,
      fontFamily: familyOf(slot.font),
      fontWeight: override.weight ?? slot.weight,
      /** Papel tipográfico, para o editor saber que fonte da marca alterar. */
      fontRole: slot.font,
      tracking: (slot.tracking ?? 0) * item.fit.fontSize,
      align: slot.pill ? 'center' : align,
      color: palette[slot.color],
      locked: item.locked,
      label: TEXT_ROLE_LABELS[slot.role],
      overflow: item.fit.overflow,
      rawValue: item.rawValue,
      uppercase: slot.uppercase ?? false,
      selectable: true,
    });

    if (item.fit.overflow) {
      warnings.push({
        id: `corte-${slot.role}`,
        level: 'aviso',
        layerId: `text.${slot.role}`,
        message: `O texto de "${TEXT_ROLE_LABELS[slot.role]}" teve de ser cortado. Reduz o conteúdo para caber.`,
      });
    }

    cursor += item.fit.height + padY + gap;
  }

  return { layers, warnings };
}

function textValueFor(slot: TemplateTextSlot, composition: Composition): string {
  if (slot.role === 'contacts') {
    return buildContactsText(composition, slot.maxLines === 1);
  }
  return composition.texts[slot.role]?.value?.trim() ?? '';
}

function availableHeight(stack: TemplateStack, template: Template, H: number): number {
  const safeY = template.safeMargin.y * H;
  if (stack.anchor.edge === 'top') {
    const top = stack.anchor.at * H;
    const bottomBoundary =
      stack.limit?.edge === 'bottom' ? H - stack.limit.at * H : H - safeY;
    return Math.max(40, bottomBoundary - top);
  }
  if (stack.anchor.edge === 'bottom') {
    const bottom = H - stack.anchor.at * H;
    const topBoundary = stack.limit?.edge === 'top' ? stack.limit.at * H : safeY;
    return Math.max(40, bottom - topBoundary);
  }
  return Math.max(40, H - safeY * 2);
}

function anchorTop(stack: TemplateStack, totalHeight: number, H: number): number {
  if (stack.anchor.edge === 'top') return stack.anchor.at * H;
  if (stack.anchor.edge === 'bottom') return H - stack.anchor.at * H - totalHeight;
  return stack.anchor.at * H - totalHeight / 2;
}

// --- Selecção ---------------------------------------------------------------

/** Camadas que o utilizador pode seleccionar, da mais acima para a mais abaixo. */
export function selectableLayers(artwork: ResolvedArtwork): ResolvedLayer[] {
  return artwork.layers.filter((layer) => layer.selectable).reverse();
}

export function findLayer(artwork: ResolvedArtwork, id: string): ResolvedLayer | undefined {
  return artwork.layers.find((layer) => layer.id === id);
}
