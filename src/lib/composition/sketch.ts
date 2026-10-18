/**
 * O ESBOÇO da arte: a grelha preenchida com os textos reais.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Serve três leitores, com a mesma geometria:
 *
 *  · o CLIENTE, na revisão: vê onde fica cada coisa antes de pagar uma
 *    geração, com o título, o botão, o logótipo e os contactos verdadeiros;
 *  · o GERADOR, como imagem: um esboço cinzento, sem palavras, na proporção
 *    em que ele desenha — com a moldura da publicação ao centro, para o
 *    conteúdo ficar dentro do que a moldura deixa ver;
 *  · o PROMPT, por palavras: a mesma disposição dita zona a zona.
 *
 * As medidas estão em píxeis da publicação (1080 × 1350 no Instagram). As
 * quebras de linha vêm de `fitText`, que mede com as fontes reais.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { getFormat } from '@/lib/domain/catalog';
import type { LayoutId } from '@/lib/domain/direction';
import type { ContactsPlacement, FormatId, LogoPlacement, LogoSize } from '@/lib/domain/types';
import { CONTENT_MARGIN, hiddenFractions } from './frame';
import { LOGO_SIZE_SHARE, fitLogoPlacement, regionsFor } from './layouts';
import { fitText, measureLineWidth } from './textLayout';

export type SketchRole =
  | 'imagem'
  | 'logotipo'
  | 'etiqueta'
  | 'titulo'
  | 'apoio'
  | 'preco'
  | 'cta'
  | 'contactos';

export type SketchBlock = {
  role: SketchRole;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Só nos blocos de texto: as linhas, já quebradas. */
  lines?: string[];
  fontSize?: number;
  lineHeight?: number;
  weight?: number;
  font?: 'display' | 'body';
  align?: 'left' | 'center' | 'right';
  uppercase?: boolean;
  tracking?: number;
};

export type Sketch = {
  format: FormatId;
  layout: LayoutId;
  width: number;
  height: number;
  /** A margem do conteúdo, em píxeis da publicação. */
  margin: number;
  logoPlacement: LogoPlacement | null;
  /** Onde ficaram os contactos. `null` sem contactos. */
  contactsPlacement: ContactsPlacement | null;
  blocks: SketchBlock[];
};

export type SketchInput = {
  format: FormatId;
  layout: LayoutId;
  /** `null` sem logótipo. `ratio` é largura/altura do ficheiro. */
  logo: { placement: LogoPlacement; ratio: number; size: LogoSize } | null;
  texts: { badge: string; headline: string; subheadline: string; price: string; cta: string };
  /** Já formatados para a arte ("WhatsApp +244 …"). */
  contacts: string[];
  /** No bloco de texto, por baixo do botão, ou numa linha de rodapé. */
  contactsPlacement: ContactsPlacement;
  /** Famílias reais, como o `ctx.font` as espera. */
  fonts: { display: string; body: string };
};

/** Entre dois contactos na mesma linha. A planta da revisão parte as linhas por aqui. */
export const CONTACT_SEPARATOR = '   ·   ';

export function computeSketch(input: SketchInput): Sketch {
  const spec = getFormat(input.format);
  const W = spec.width;
  const H = spec.height;
  const base = Math.min(W, H);
  // A mesma margem que o prompt pede ao gerador (`safeMargins`).
  const margin = Math.round(base * CONTENT_MARGIN);
  /*
    Story e Reels: a aplicação tapa o topo e a base com o nome da conta, a
    legenda e os botões. O conteúdo fica mais para dentro.
  */
  const tall = input.format === 'story' || input.format === 'reels';
  const top = margin + (tall ? Math.round(H * 0.06) : 0);
  const bottom = H - margin - (tall ? Math.round(H * 0.09) : 0);
  const left = margin;
  const right = W - margin;
  const gap = Math.round(base * 0.022);

  const blocks: SketchBlock[] = [];
  const regions = regionsFor(input.layout, input.format);

  // --- Logótipo --------------------------------------------------------
  let logo: SketchBlock | null = null;
  let placement: LogoPlacement | null = null;
  if (input.logo) {
    placement = fitLogoPlacement(input.layout, input.format, input.logo.placement);
    const ratio = input.logo.ratio > 0 ? input.logo.ratio : 3;
    // Uma assinatura, não um título: ver `LOGO_SIZE_SHARE`.
    const share = LOGO_SIZE_SHARE[input.logo.size] ?? LOGO_SIZE_SHARE.pequeno;
    let lw = Math.round(base * share.width);
    let lh = lw / ratio;
    /*
      Nunca mais alto do que a margem. O verificador chama "encostado" a um
      logótipo com menos espaço até à aresta do que a altura dele: um
      logótipo quase quadrado a 11% do lado falhava essa regra no próprio
      esboço que o gerador copia.
    */
    const maxH = Math.min(base * share.maxHeight, margin);
    if (lh > maxH) {
      lh = maxH;
      lw = lh * ratio;
    }
    const atTop = placement.startsWith('superior');
    const x = placement.endsWith('centro')
      ? (W - lw) / 2
      : placement.endsWith('direito')
        ? right - lw
        : left;
    const y = atTop ? top : bottom - lh;
    logo = { role: 'logotipo', x, y, w: lw, h: lh };
    blocks.push(logo);
  }
  const logoTop = Boolean(logo && placement?.startsWith('superior'));
  const logoBottom = Boolean(logo && placement?.startsWith('inferior'));

  /*
    ──────────────────────────────────────────────────────────────────────────
    OS CONTACTOS VÃO NO BLOCO DE TEXTO, por baixo do botão — por omissão.

    Medido em três gerações reais: o gerador segue a posição do título, do
    botão e de um logótipo em cima, mas DESCE a linha do rodapé para a aresta
    de baixo da imagem dele, diga o esboço o que disser — e a moldura 4:5
    corta mais 4%. Numa saiu o logótipo cortado; noutra, os três contactos
    desapareceram por inteiro. Subir a linha no esboço (5% a mais) não mudou
    nada: o gerador desceu-a na mesma.

    Por baixo do botão, os contactos são a última linha do texto, que o
    gerador põe onde o esboço manda. É também como se lê uma arte de
    encomendas: "Encomenda já", e logo por baixo o número para onde ligar.

    O rodapé continua a existir como ESCOLHA do cliente (`contactsPlacement`),
    para quem quer o texto limpo: uma linha própria em baixo, ao lado do
    logótipo quando ele também vai em baixo. O prompt avisa o gerador do
    erro que ele costuma cometer ali.
    ──────────────────────────────────────────────────────────────────────────
  */
  const footer =
    input.contactsPlacement === 'rodape' && input.contacts.length > 0
      ? layoutFooter(input, { W, left, right, bottom, base, gap }, logo, placement)
      : null;
  if (footer) blocks.push(footer);

  // --- Área de conteúdo -------------------------------------------------
  const contentTop = logoTop && logo ? logo.y + logo.h + gap * 1.5 : top;
  const floor = Math.min(
    logoBottom && logo ? logo.y : Number.POSITIVE_INFINITY,
    footer ? footer.y : Number.POSITIVE_INFINITY,
  );
  const contentBottom = Number.isFinite(floor) ? floor - gap * 1.5 : bottom;
  const cw = right - left;
  const ch = Math.max(1, contentBottom - contentTop);
  const area = (region: { x: number; y: number; w: number; h: number }) => ({
    x: left + region.x * cw,
    y: contentTop + region.y * ch,
    w: region.w * cw,
    h: region.h * ch,
  });

  // --- Texto ------------------------------------------------------------
  const textBox = area(regions.text);
  const textBlocks = layoutText(input, textBox, base, gap);

  // --- Imagem protagonista: a sua região, sem tocar no texto -------------
  /*
    A região da grelha é a de omissão; o texto real decide o resto. Com
    etiqueta, título, apoio, preço e botão, o bloco de texto descia por cima
    da imagem e o botão ficava em cima do produto — no esboço do cliente e
    no que o gerador recebe.
  */
  const subject = clearOf(area(regions.subject), textBlocks, gap * 2);
  blocks.unshift({ role: 'imagem', ...subject });
  blocks.push(...textBlocks);

  return {
    format: input.format,
    layout: input.layout,
    width: W,
    height: H,
    margin,
    logoPlacement: placement,
    contactsPlacement: input.contacts.length > 0 ? input.contactsPlacement : null,
    blocks,
  };
}

type Box = { x: number; y: number; w: number; h: number };

/**
 * A linha de contactos no rodapé.
 *
 *  · logótipo num canto de baixo — na mesma linha, do lado oposto;
 *  · logótipo em baixo ao centro — logo por cima dele, centrada;
 *  · logótipo em cima (ou nenhum) — sozinha, assente na margem de baixo,
 *    com o alinhamento do texto.
 */
function layoutFooter(
  input: SketchInput,
  frame: { W: number; left: number; right: number; bottom: number; base: number; gap: number },
  logo: SketchBlock | null,
  placement: LogoPlacement | null,
): SketchBlock {
  const { W, left, right, bottom, base, gap } = frame;
  const logoBelow = Boolean(logo && placement?.startsWith('inferior'));
  const beside = logoBelow && !placement?.endsWith('centro');
  const available = beside && logo ? right - left - logo.w - gap * 2 : right - left;
  const family = input.fonts.body;
  const { lines, fontSize } = contactRows(
    input.contacts,
    available,
    family,
    Math.round(base * 0.024),
    Math.round(base * 0.019),
  );
  const lineHeight = 1.35;
  const h = Math.round(lines.length * fontSize * lineHeight);
  const w = Math.min(
    available,
    Math.max(...lines.map((line) => measureLineWidth(line, family, 500, fontSize))),
  );

  let align: 'left' | 'center' | 'right';
  let x: number;
  let y: number;
  if (beside && logo && placement) {
    const logoLeft = placement.endsWith('esquerdo');
    align = logoLeft ? 'right' : 'left';
    x = logoLeft ? right - w : left;
    // Ao meio da altura do logótipo; mais alta do que ele, assenta na margem.
    y = Math.min(bottom - h, logo.y + (logo.h - h) / 2);
  } else if (logoBelow && logo) {
    align = 'center';
    x = (W - w) / 2;
    y = logo.y - gap - h;
  } else {
    align = regionsFor(input.layout, input.format).text.align;
    x = align === 'center' ? (W - w) / 2 : left;
    y = bottom - h;
  }

  return {
    role: 'contactos',
    x,
    y,
    w,
    h,
    lines,
    fontSize,
    lineHeight,
    weight: 500,
    font: 'body',
    align,
  };
}

/**
 * Os contactos em linhas, sem partir nenhum ao meio.
 *
 * Todos numa linha, se couberem acima do tamanho mínimo; senão repartidos
 * por duas, e assim por diante. Partido pela quebra de linha, "WhatsApp
 * +244" ficava numa e "923 000 000" na outra — e já não se lia como número.
 */
function contactRows(
  contacts: string[],
  maxWidth: number,
  family: string,
  idealSize: number,
  minSize: number,
): { lines: string[]; fontSize: number } {
  let lines = [contacts.join(CONTACT_SEPARATOR)];
  for (let rows = 1; rows <= contacts.length; rows += 1) {
    const perRow = Math.ceil(contacts.length / rows);
    lines = [];
    for (let index = 0; index < contacts.length; index += perRow) {
      lines.push(contacts.slice(index, index + perRow).join(CONTACT_SEPARATOR));
    }
    const widest = Math.max(
      ...lines.map((line) => measureLineWidth(line, family, 500, idealSize)),
    );
    const fontSize = widest <= maxWidth ? idealSize : Math.floor((idealSize * maxWidth) / widest);
    if (fontSize >= minSize) return { lines, fontSize };
  }
  return { lines, fontSize: minSize };
}

/**
 * A região da imagem, encolhida para não tocar no bloco de texto.
 *
 * Corta pelo lado em que o texto está — por cima, por baixo, à esquerda ou
 * à direita —, ficando com o pedaço maior. Se o corte deixar só uma tira, a
 * região fica como estava: uma sobreposição lê-se melhor do que uma imagem
 * de dois dedos.
 */
function clearOf(region: Box, text: SketchBlock[], gap: number): Box {
  if (text.length === 0) return region;
  const tx0 = Math.min(...text.map((block) => block.x)) - gap;
  const ty0 = Math.min(...text.map((block) => block.y)) - gap;
  const tx1 = Math.max(...text.map((block) => block.x + block.w)) + gap;
  const ty1 = Math.max(...text.map((block) => block.y + block.h)) + gap;
  const rx1 = region.x + region.w;
  const ry1 = region.y + region.h;
  if (tx1 <= region.x || tx0 >= rx1 || ty1 <= region.y || ty0 >= ry1) return region;

  const pieces: Box[] = [
    // O texto por cima: a imagem começa por baixo dele.
    { x: region.x, y: Math.max(region.y, ty1), w: region.w, h: ry1 - Math.max(region.y, ty1) },
    // O texto por baixo: a imagem acaba antes dele.
    { x: region.x, y: region.y, w: region.w, h: Math.min(ry1, ty0) - region.y },
    // O texto à esquerda: a imagem começa depois dele.
    { x: Math.max(region.x, tx1), y: region.y, w: rx1 - Math.max(region.x, tx1), h: region.h },
    // O texto à direita: a imagem acaba antes dele.
    { x: region.x, y: region.y, w: Math.min(rx1, tx0) - region.x, h: region.h },
  ].filter((piece) => piece.w > 0 && piece.h > 0);

  const best = pieces.sort((a, b) => b.w * b.h - a.w * a.h)[0];
  return best && best.w * best.h >= region.w * region.h * 0.3 ? best : region;
}

/** O bloco de texto: etiqueta, título, apoio, preço, botão e contactos, empilhados. */
function layoutText(input: SketchInput, box: Box, base: number, gap: number): SketchBlock[] {
  const regions = regionsFor(input.layout, input.format);
  const align = regions.text.align;
  const typographic = input.layout === 'tipografica';
  const { badge, headline, subheadline, price, cta } = input.texts;

  /*
    Primeiro encolhe o título, até ao mínimo; depois o resto, até três
    quartos. O título continua a ser o maior texto da arte: o preço nunca
    passa de quatro quintos dele (saía maior do que o título encolhido).
  */
  let titleIdeal = base * (typographic ? 0.11 : 0.078);
  const titleMin = base * 0.05;
  let rest = 1;
  const attempts = 24;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const stack: Array<SketchBlock & { gapBefore: number }> = [];
    let titleSize = titleIdeal;

    if (badge.trim()) {
      const fit = fitText({
        text: badge,
        maxWidth: box.w,
        fontFamily: input.fonts.body,
        fontWeight: 700,
        idealSize: Math.round(base * 0.024 * rest),
        minSize: Math.round(base * 0.02 * rest),
        maxLines: 1,
        lineHeight: 1.2,
        tracking: 0.08,
        uppercase: true,
      });
      stack.push({
        role: 'etiqueta',
        x: 0,
        y: 0,
        w: fit.width,
        h: fit.height,
        lines: fit.lines,
        fontSize: fit.fontSize,
        lineHeight: 1.2,
        weight: 700,
        font: 'body',
        uppercase: true,
        tracking: 0.08,
        gapBefore: 0,
      });
    }

    if (headline.trim()) {
      const fit = fitText({
        text: headline,
        maxWidth: box.w,
        fontFamily: input.fonts.display,
        fontWeight: 700,
        idealSize: titleIdeal,
        minSize: titleMin,
        maxLines: typographic ? 5 : 4,
        lineHeight: 1.04,
      });
      titleSize = fit.fontSize;
      stack.push({
        role: 'titulo',
        x: 0,
        y: 0,
        w: fit.width,
        h: fit.height,
        lines: fit.lines,
        fontSize: fit.fontSize,
        lineHeight: 1.04,
        weight: 700,
        font: 'display',
        gapBefore: stack.length > 0 ? gap * 0.7 : 0,
      });
    }

    if (subheadline.trim()) {
      const fit = fitText({
        text: subheadline,
        maxWidth: Math.min(box.w, base * 0.62),
        fontFamily: input.fonts.body,
        fontWeight: 400,
        idealSize: Math.round(base * 0.034 * rest),
        minSize: Math.round(base * 0.026 * rest),
        maxLines: 3,
        lineHeight: 1.3,
      });
      stack.push({
        role: 'apoio',
        x: 0,
        y: 0,
        w: fit.width,
        h: fit.height,
        lines: fit.lines,
        fontSize: fit.fontSize,
        lineHeight: 1.3,
        weight: 400,
        font: 'body',
        gapBefore: stack.length > 0 ? gap : 0,
      });
    }

    if (price.trim()) {
      const ideal = Math.round(Math.min(base * 0.056 * rest, titleSize * 0.8));
      const fit = fitText({
        text: price,
        maxWidth: box.w,
        fontFamily: input.fonts.display,
        fontWeight: 700,
        idealSize: ideal,
        minSize: Math.min(ideal, Math.round(base * 0.04 * rest)),
        maxLines: 1,
        lineHeight: 1.1,
      });
      stack.push({
        role: 'preco',
        x: 0,
        y: 0,
        w: fit.width,
        h: fit.height,
        lines: fit.lines,
        fontSize: fit.fontSize,
        lineHeight: 1.1,
        weight: 700,
        font: 'display',
        gapBefore: stack.length > 0 ? gap : 0,
      });
    }

    if (cta.trim()) {
      const fontSize = Math.round(base * 0.03 * Math.max(rest, 0.85));
      const textWidth = measureLineWidth(cta, input.fonts.body, 600, fontSize);
      const w = Math.min(box.w, textWidth + fontSize * 2.6);
      stack.push({
        role: 'cta',
        x: 0,
        y: 0,
        w,
        h: Math.round(fontSize * 2.3),
        lines: [cta],
        fontSize,
        lineHeight: 1,
        weight: 600,
        font: 'body',
        gapBefore: stack.length > 0 ? gap * 1.4 : 0,
      });
    }

    /*
      Os contactos, a última linha do bloco (ver `computeSketch`).

      Numa linha quando cabem; senão, um por linha — partidos a meio pela
      quebra de linha, "WhatsApp +244" ficava numa e "923 000 000" na outra.
      Nunca abaixo do mínimo legível num telemóvel.
    */
    if (input.contacts.length > 0 && input.contactsPlacement !== 'rodape') {
      const minSize = Math.round(base * 0.02);
      let fontSize = Math.round(base * 0.025 * Math.max(rest, 0.85));
      const joined = input.contacts.join(CONTACT_SEPARATOR);
      let lines = [joined];
      if (measureLineWidth(joined, input.fonts.body, 500, fontSize) > box.w) {
        lines = input.contacts;
        const widest = Math.max(
          ...lines.map((line) => measureLineWidth(line, input.fonts.body, 500, fontSize)),
        );
        if (widest > box.w) fontSize = Math.max(minSize, Math.floor((fontSize * box.w) / widest));
      }
      const w = Math.min(
        box.w,
        Math.max(...lines.map((line) => measureLineWidth(line, input.fonts.body, 500, fontSize))),
      );
      stack.push({
        role: 'contactos',
        x: 0,
        y: 0,
        w,
        h: Math.round(lines.length * fontSize * 1.35),
        lines,
        fontSize,
        lineHeight: 1.35,
        weight: 500,
        font: 'body',
        gapBefore: stack.length > 0 ? gap * 1.2 : 0,
      });
    }

    const total = stack.reduce((sum, entry) => sum + entry.gapBefore + entry.h, 0);
    if (total > box.h && attempt < attempts - 1) {
      if (titleIdeal > titleMin + 0.5) {
        titleIdeal = Math.max(titleMin, titleIdeal * 0.92);
        continue;
      }
      if (rest > 0.76) {
        rest = Math.max(0.75, rest - 0.05);
        continue;
      }
    }

    const anchor = regions.text.anchor;
    let y =
      anchor === 'top'
        ? box.y
        : anchor === 'bottom'
          ? box.y + box.h - total
          : box.y + (box.h - total) / 2;
    return stack.map(({ gapBefore, ...entry }) => {
      y += gapBefore;
      const x = align === 'center' ? box.x + (box.w - entry.w) / 2 : box.x;
      const placed: SketchBlock = { ...entry, x, y, align };
      y += entry.h;
      return placed;
    });
  }
  return [];
}

// --- Por palavras, para o prompt ----------------------------------------

function horizontal(block: SketchBlock, W: number): string {
  /*
    Um bloco de texto diz-se pela aresta em que alinha, não pelo centro: o
    título alinhado à esquerda e com 80% da largura tem o centro a meio, e
    saía "ao centro, alinhado à esquerda".
  */
  if (block.align === 'center') return 'ao centro';
  if (block.align === 'left') {
    const start = block.x / W;
    return start < 0.3 ? 'à esquerda' : start < 0.42 ? 'ao centro' : 'na metade direita';
  }
  if (block.align === 'right') {
    const end = (block.x + block.w) / W;
    return end > 0.7 ? 'à direita' : end > 0.58 ? 'ao centro' : 'na metade esquerda';
  }
  if (block.w > W * 0.8) return 'a toda a largura';
  const center = (block.x + block.w / 2) / W;
  return center < 0.4 ? 'à esquerda' : center > 0.6 ? 'à direita' : 'ao centro';
}

function vertical(block: SketchBlock, H: number): string {
  if (block.h > H * 0.75) return 'de cima a baixo';
  const center = (block.y + block.h / 2) / H;
  return center < 0.36 ? 'em cima' : center > 0.64 ? 'em baixo' : 'a meio da altura';
}

const PLACEMENT_WORDS: Record<LogoPlacement, string> = {
  'superior-esquerdo': 'no canto de cima, à esquerda',
  'superior-centro': 'em cima, ao centro',
  'superior-direito': 'no canto de cima, à direita',
  'inferior-esquerdo': 'no canto de baixo, à esquerda',
  'inferior-centro': 'em baixo, ao centro',
  'inferior-direito': 'no canto de baixo, à direita',
};

/**
 * A disposição, zona a zona. É o que o prompt diz ao lado do esboço.
 *
 * Com `outputRatio`, acaba com as distâncias às arestas medidas na imagem
 * que o GERADOR desenha — a que ele vê —, e não na publicação. Numa arte
 * real, o gerador pôs o logótipo e os contactos a 3% da aresta de baixo da
 * imagem dele; a moldura 4:5 corta 4%, e o logótipo saiu cortado.
 */
export function describeSketch(sketch: Sketch, outputRatio?: number): string[] {
  const { width: W, height: H } = sketch;
  const out: string[] = [];
  const find = (role: SketchRole) => sketch.blocks.find((block) => block.role === role);
  const pct = (value: number, total: number) => Math.round((value / total) * 100);

  const image = find('imagem');
  if (image) {
    out.push(
      `Imagem protagonista: ${horizontal(image, W)}, ${vertical(image, H)} — cerca de ${pct(image.w, W)}% da largura e ${pct(image.h, H)}% da altura da arte.`,
    );
  }
  const title = find('titulo');
  if (title) {
    out.push(
      `Título: ${horizontal(title, W)}, ${vertical(title, H)}, ${title.align === 'center' ? 'centrado' : 'alinhado à esquerda'}, em ${title.lines?.length ?? 1} ${title.lines?.length === 1 ? 'linha' : 'linhas'}. É o maior texto da arte.`,
    );
  }
  if (find('etiqueta')) out.push('Etiqueta: pequena, logo por cima do título.');
  if (find('apoio')) out.push('Texto de apoio: logo por baixo do título, com o mesmo alinhamento.');
  if (find('preco')) out.push('Preço: por baixo do texto de apoio, destacado.');
  if (find('cta')) out.push('Botão: por baixo do texto, com o mesmo alinhamento.');

  const logo = find('logotipo');
  if (logo && sketch.logoPlacement) {
    out.push(
      `Logótipo: ${PLACEMENT_WORDS[sketch.logoPlacement]}, com cerca de ${pct(logo.w, W)}% da largura — uma assinatura discreta, nunca maior do que isso — e com folga às arestas: pelo menos ${pct(sketch.margin, W)}% da largura até cada aresta. Nunca encostado a uma aresta.`,
    );
  }
  const contacts = find('contactos');
  if (contacts) {
    const lines = contacts.lines?.length ?? 1;
    if (sketch.contactsPlacement === 'rodape') {
      const beside =
        Boolean(logo) &&
        Boolean(sketch.logoPlacement?.startsWith('inferior')) &&
        !sketch.logoPlacement?.endsWith('centro');
      const aboveLogo = Boolean(logo) && sketch.logoPlacement === 'inferior-centro';
      const where = beside
        ? 'na mesma linha do logótipo, do lado oposto'
        : aboveLogo
          ? 'logo por cima do logótipo, centrados'
          : horizontal(contacts, W);
      out.push(
        `Contactos: numa linha própria no rodapé, ${where}, ${lines > 1 ? `em ${lines} linhas` : 'numa linha'}, separados por um ponto médio, em letra pequena mas legível. Ficam acima da margem de baixo, com a mesma folga que o logótipo — não descem para a aresta da imagem.`,
      );
    } else {
      // Sem botão (retirado pelo cliente), os contactos seguem o último texto.
      const after = find('cta') ? 'do botão' : 'do último texto';
      out.push(
        `Contactos: por baixo ${after}, no mesmo bloco e com o mesmo alinhamento do texto, ${lines > 1 ? `um por linha (${lines} linhas)` : 'numa linha'}, em letra pequena mas legível. Não descem para a aresta de baixo: são a última linha do texto, logo a seguir ${find('cta') ? 'ao botão' : 'ao texto'}.`,
      );
    }
  }

  const content = sketch.blocks.filter((block) => block.role !== 'imagem');
  if (outputRatio && content.length > 0) {
    // Da publicação para a imagem do gerador, com a moldura ao centro.
    const hidden = hiddenFractions(outputRatio, W / H);
    const toY = (y: number) => hidden.y + (y / H) * (1 - hidden.y * 2);
    const toX = (x: number) => hidden.x + (x / W) * (1 - hidden.x * 2);
    const top = Math.round(toY(Math.min(...content.map((block) => block.y))) * 100);
    const lowestBlock = content.reduce((low, block) =>
      block.y + block.h > low.y + low.h ? block : low,
    );
    const bottom = Math.round((1 - toY(lowestBlock.y + lowestBlock.h)) * 100);
    const left = toX(Math.min(...content.map((block) => block.x)));
    const right = 1 - toX(Math.max(...content.map((block) => block.x + block.w)));
    const sides = Math.round(Math.min(left, right) * 100);
    /*
      A distância de baixo só quando há alguma coisa perto da aresta de
      baixo. Com o texto em cima, "a base do último texto fica a 48% acima
      da aresta" é verdade e não ajuda nada.
    */
    const nearBottom = lowestBlock.y + lowestBlock.h > H * 0.7;
    const lowest =
      lowestBlock.role === 'logotipo'
        ? 'a base do logótipo'
        : lowestBlock.role === 'contactos' && sketch.contactsPlacement === 'rodape'
          ? 'a base da linha dos contactos'
          : 'a base da última linha de texto';
    out.push(
      `Distâncias às arestas DA IMAGEM QUE DESENHAS: o primeiro texto começa a ${top}% da altura, a contar da aresta de cima;${nearBottom ? ` ${lowest} fica a ${bottom}% da altura acima da aresta de baixo;` : ''} nenhum texto fica a menos de ${sides}% da largura das arestas dos lados. Daí até às arestas continua só a cena, sem nada escrito por cima.`,
    );
  }
  return out;
}

// --- Como imagem, para o gerador ----------------------------------------

/**
 * O esboço em cinzentos, na proporção em que o gerador desenha.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * A moldura da publicação fica ao centro, com o mesmo recorte que a
 * aplicação aplica depois (`hiddenFractions`): o que o esboço põe dentro
 * dela fica dentro do que o cliente vê. Fora dela, o fundo continua — é a
 * faixa que a moldura corta, e o gerador tem de a preencher de cena.
 *
 * Sem palavras, de propósito: um esboço com "TÍTULO" escrito fazia o gerador
 * escrever "TÍTULO". As linhas de texto são barras do tamanho real, o
 * logótipo é um rectângulo do tamanho real, o protagonista é uma mancha de
 * contornos suaves (uma caixa era lida como um painel).
 * ──────────────────────────────────────────────────────────────────────────
 */
export function paintGeneratorSketch(
  sketch: Sketch,
  outputRatio: number,
  fonts: { display: string; body: string },
): string {
  const longSide = 1024;
  const cw = outputRatio >= 1 ? longSide : Math.round(longSide * outputRatio);
  const ch = outputRatio >= 1 ? Math.round(longSide / outputRatio) : longSide;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('O browser não disponibilizou um contexto 2D.');

  const hidden = hiddenFractions(outputRatio, sketch.width / sketch.height);
  const fx = hidden.x * cw;
  const fy = hidden.y * ch;
  const scale = (cw - fx * 2) / sketch.width;
  const X = (value: number) => fx + value * scale;
  const Y = (value: number) => fy + value * scale;

  ctx.fillStyle = '#d9d9d9';
  ctx.fillRect(0, 0, cw, ch);

  for (const block of sketch.blocks) {
    const x = X(block.x);
    const y = Y(block.y);
    const w = block.w * scale;
    const h = block.h * scale;

    if (block.role === 'imagem') {
      /*
        Uma MANCHA de contornos suaves, não uma caixa.

        Era um rectângulo cinzento de arestas duras, com uma cruz. Numa
        geração real o gerador leu-o como um painel: a arte saiu partida em
        duas — o texto sobre um fundo creme em cima, uma fotografia
        emoldurada em baixo. A mancha diz "o protagonista fica aqui" sem
        desenhar fronteira nenhuma, e a cena continua por trás de tudo.
      */
      const radius = Math.max(w, h) / 2;
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(w / (radius * 2), h / (radius * 2));
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      glow.addColorStop(0, '#a3a3a3');
      glow.addColorStop(0.55, '#b9b9b9');
      // A mesma cor do fundo, transparente: a mancha dissolve-se nele.
      glow.addColorStop(1, 'rgba(217, 217, 217, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      ctx.restore();
      continue;
    }

    if (block.role === 'logotipo') {
      ctx.fillStyle = '#4d4d4d';
      roundRect(ctx, x, y, w, h, Math.min(8, h / 3));
      ctx.fill();
      continue;
    }

    if (block.role === 'cta') {
      ctx.fillStyle = '#3a3a3a';
      roundRect(ctx, x, y, w, h, h / 2.6);
      ctx.fill();
      continue;
    }

    // Texto: uma barra por linha, da largura da linha e da altura das letras.
    const fontSize = block.fontSize ?? 20;
    const lineHeight = (block.lineHeight ?? 1.2) * fontSize;
    const family = block.font === 'display' ? fonts.display : fonts.body;
    ctx.fillStyle = block.role === 'contactos' || block.role === 'apoio' ? '#5c5c5c' : '#333333';
    (block.lines ?? []).forEach((line, index) => {
      const text = block.uppercase ? line.toLocaleUpperCase('pt-PT') : line;
      const lineWidth =
        measureLineWidth(text, family, block.weight ?? 400, fontSize, block.tracking ?? 0) * scale;
      const barHeight = Math.max(3, fontSize * 0.62 * scale);
      const lineX =
        block.align === 'center'
          ? x + (w - lineWidth) / 2
          : block.align === 'right'
            ? x + w - lineWidth
            : x;
      const lineY = y + index * lineHeight * scale + (lineHeight * scale - barHeight) / 2;
      roundRect(ctx, lineX, lineY, lineWidth, barHeight, barHeight / 2);
      ctx.fill();
    });
  }

  return canvas.toDataURL('image/png');
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
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
