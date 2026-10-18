/**
 * Zonas de edição de uma arte gerada.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O cliente pinta por cima da arte as zonas que quer mudar e escreve, para
 * cada uma, o que quer lá. Este módulo é a geometria dessas zonas e o
 * material que segue para a IA.
 *
 * DUAS MOLDURAS, e a conta entre elas é a parte delicada:
 *
 *  · o cliente pinta sobre a MOLDURA do formato — o que vê no ecrã, por
 *    exemplo 1080 × 1350 numa publicação 4:5;
 *  · o gerador edita o FICHEIRO guardado, que tem a proporção que o
 *    gerador devolve — 3:4 para essa mesma publicação, com uma faixa a mais
 *    em cima e em baixo que a moldura corta.
 *
 * Os pontos guardam-se na moldura (é o que o cliente vê e é estável se a
 * janela mudar de tamanho) e convertem-se para o ficheiro só no fim, com a
 * mesma geometria que desenha a arte (`coverGeometry`). Duas contas
 * diferentes deixavam a zona editada desviada da zona pintada.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { blobToDataUrl } from '@/lib/utils/files';
import { coverGeometry } from './finishArtwork';
import { ZONE_MAP_COLORS } from './zoneConstants';

/** Um ponto na moldura, normalizado: (0, 0) é o canto superior esquerdo. */
export type ZonePoint = readonly [number, number];

/**
 * Um traço do pincel.
 *
 * `size` é o diâmetro do pincel em fracção da LARGURA da moldura. Uma
 * medida relativa sobrevive a mudanças de tamanho da janela; uma medida em
 * píxeis de ecrã não.
 */
export type ZoneStroke = { points: ZonePoint[]; size: number };

export type ZoneShape = { id: string; strokes: ZoneStroke[] };

/** Caixa normalizada na moldura. */
export type ZoneBounds = { x: number; y: number; w: number; h: number };

export { ZONE_LIMIT, ZONE_MAP_COLORS } from './zoneConstants';

/** Tamanhos do pincel, em fracção da largura da moldura. */
export const BRUSH_SIZES = [
  { id: 'fino', label: 'Fino', value: 0.03 },
  { id: 'medio', label: 'Médio', value: 0.055 },
  { id: 'largo', label: 'Largo', value: 0.09 },
] as const;

export const DEFAULT_BRUSH = BRUSH_SIZES[1].value;

// --- Geometria --------------------------------------------------------------

const round1 = (value: number) => (Math.round(value * 10) / 10).toString();

/**
 * Caminho SVG suavizado de um traço, numa caixa de `width` × `height`.
 *
 * Curvas quadráticas pelos pontos médios: o traço sai redondo mesmo com o
 * ponteiro a saltar de vários píxeis entre eventos. Um só ponto vira um
 * segmento mínimo, que as pontas redondas desenham como um círculo.
 */
export function strokePath(stroke: ZoneStroke, width: number, height: number): string {
  const points = stroke.points.map(([u, v]) => [u * width, v * height] as const);
  if (points.length === 0) return '';
  const [x0, y0] = points[0];
  if (points.length === 1) return `M${round1(x0)} ${round1(y0)}l0.01 0`;
  let d = `M${round1(x0)} ${round1(y0)}`;
  if (points.length === 2) {
    return `${d}L${round1(points[1][0])} ${round1(points[1][1])}`;
  }
  for (let index = 1; index < points.length - 1; index += 1) {
    const [x, y] = points[index];
    const [nx, ny] = points[index + 1];
    d += `Q${round1(x)} ${round1(y)} ${round1((x + nx) / 2)} ${round1((y + ny) / 2)}`;
  }
  const [lx, ly] = points[points.length - 1];
  return `${d}L${round1(lx)} ${round1(ly)}`;
}

/** O mesmo traço num canvas, com a mesma suavização do SVG. */
export function traceStroke(
  ctx: CanvasRenderingContext2D,
  stroke: ZoneStroke,
  toPixels: (point: ZonePoint) => readonly [number, number],
  lineWidth: number,
): void {
  const points = stroke.points.map(toPixels);
  if (points.length === 0) return;

  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0][0], points[0][1], lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  if (points.length === 2) {
    ctx.lineTo(points[1][0], points[1][1]);
  } else {
    for (let index = 1; index < points.length - 1; index += 1) {
      const [x, y] = points[index];
      const [nx, ny] = points[index + 1];
      ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last[0], last[1]);
  }
  ctx.stroke();
}

/**
 * Caixa de uma zona, com a espessura do pincel.
 *
 * `aspect` é altura ÷ largura da moldura: o raio do pincel é medido na
 * largura, e na vertical vale outra fracção.
 */
export function zoneBounds(zone: ZoneShape, aspect: number): ZoneBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const stroke of zone.strokes) {
    const rx = stroke.size / 2;
    const ry = stroke.size / 2 / aspect;
    for (const [u, v] of stroke.points) {
      minX = Math.min(minX, u - rx);
      minY = Math.min(minY, v - ry);
      maxX = Math.max(maxX, u + rx);
      maxY = Math.max(maxY, v + ry);
    }
  }
  if (!Number.isFinite(minX)) return null;

  const x = Math.max(0, minX);
  const y = Math.max(0, minY);
  return { x, y, w: Math.min(1, maxX) - x, h: Math.min(1, maxY) - y };
}

/**
 * Um ponto cai em cima de uma zona (ou encostado a ela)?
 *
 * Decide se um traço novo estende uma zona que já existe ou abre outra:
 * pintar junto a uma marcação é continuar a mesma marcação.
 */
export function zoneHit(
  zone: ZoneShape,
  point: ZonePoint,
  radius: number,
  aspect: number,
): boolean {
  for (const stroke of zone.strokes) {
    const reach = stroke.size / 2 + radius;
    const reach2 = reach * reach;
    for (const [u, v] of stroke.points) {
      const dx = u - point[0];
      const dy = (v - point[1]) * aspect;
      if (dx * dx + dy * dy <= reach2) return true;
    }
  }
  return false;
}

/**
 * Onde fica uma zona, em palavras.
 *
 * Vai no prompt ao lado do mapa — duas fontes a apontar o mesmo sítio — e
 * no cartão da zona, para o cliente confirmar que pintou o que queria.
 */
export function describeZonePosition(bounds: ZoneBounds): string {
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  const column = cx < 0.36 ? 'esquerda' : cx > 0.64 ? 'direita' : 'centro';
  const row = cy < 0.36 ? 'cima' : cy > 0.64 ? 'baixo' : 'meio';

  let where: string;
  if (bounds.w > 0.7 && bounds.h > 0.7) {
    where = 'em quase toda a arte';
  } else if (bounds.w > 0.7) {
    where =
      row === 'cima'
        ? 'na faixa de cima'
        : row === 'baixo'
          ? 'na faixa de baixo'
          : 'numa faixa a meio da altura';
  } else if (bounds.h > 0.7) {
    where =
      column === 'esquerda'
        ? 'na coluna da esquerda'
        : column === 'direita'
          ? 'na coluna da direita'
          : 'numa coluna ao centro';
  } else if (row === 'meio' && column === 'centro') {
    where = 'no centro da arte';
  } else if (row === 'meio') {
    where = `a meio da altura, à ${column}`;
  } else if (column === 'centro') {
    where = row === 'cima' ? 'em cima, ao centro' : 'em baixo, ao centro';
  } else {
    where = `no canto ${row === 'cima' ? 'superior' : 'inferior'} ${
      column === 'esquerda' ? 'esquerdo' : 'direito'
    }`;
  }

  const pct = (value: number) => Math.max(1, Math.round(value * 100));
  return `${where} (cerca de ${pct(bounds.w)}% da largura e ${pct(bounds.h)}% da altura)`;
}

/**
 * Converte a moldura que o cliente vê no ficheiro que o gerador edita.
 *
 * É `coverGeometry` ao contrário: um ponto da moldura volta para o
 * rectângulo do ficheiro de onde foi lido.
 */
export function frameToAsset(
  frame: { width: number; height: number },
  asset: { width: number; height: number },
): {
  point: (point: ZonePoint) => readonly [number, number];
  /** Diâmetro do pincel, de fracção da moldura para píxeis do ficheiro. */
  lineWidth: (size: number) => number;
} {
  const g = coverGeometry(asset.width, asset.height, frame.width, frame.height);
  // Píxeis do ficheiro por píxel da moldura. A escala é uniforme.
  const k = g.sw / g.dw;
  return {
    point: ([u, v]) => [
      (g.sx + (u * frame.width - g.dx) * k) / asset.width,
      (g.sy + (v * frame.height - g.dy) * k) / asset.height,
    ],
    lineWidth: (size) => size * frame.width * k,
  };
}

// --- Material para a IA (só no browser) -------------------------------------

/**
 * Prepara o pedido de edição: a arte, uma máscara por zona e o mapa.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  · A ARTE segue tal como está guardada. É a imagem 1 do pedido, a que o
 *    gerador preserva com mais fidelidade.
 *  · As MÁSCARAS (branco na zona, preto no resto) não vão ao gerador: são
 *    para o servidor, que no fim só deixa entrar a imagem nova dentro das
 *    zonas — é isso que garante que o resto da arte fica igual ao píxel.
 *  · O MAPA é a arte com cada zona pintada de uma cor e numerada. É assim
 *    que o gerador sabe onde mexer: uma frase "no canto superior direito"
 *    é ambígua, uma mancha magenta com o número 1 não é.
 * ──────────────────────────────────────────────────────────────────────────
 */
export async function prepareZoneEdit(args: {
  artUrl: string;
  /**
   * A moldura sobre a qual o cliente pintou.
   *
   * Numa publicação são as medidas do FORMATO (`getFormat(...)`), que
   * cortam o ficheiro do gerador. Numa fotografia são as medidas da própria
   * fotografia — a moldura e o ficheiro são a mesma coisa, e a conversão
   * `frameToAsset` sai idêntica.
   *
   * Era um `FormatId`. Passou a ser a moldura em si para a edição por zonas
   * poder trabalhar sobre uma fotografia que o cliente carregou, que não
   * tem formato de publicação nenhum.
   */
  frame: { width: number; height: number };
  zones: ZoneShape[];
}): Promise<{ art: string; map: string; masks: string[]; width: number; height: number }> {
  const blob = await fetch(args.artUrl).then((response) => response.blob());
  const bitmap = await createImageBitmap(blob);
  const width = bitmap.width;
  const height = bitmap.height;
  const transform = frameToAsset(args.frame, { width, height });

  try {
    // Máscaras até 1024 px: o servidor amplia-as para o tamanho da arte e
    // suaviza a aresta, por isso não precisam de mais resolução.
    const maskWidth = Math.min(width, 1024);
    const maskHeight = Math.round((height * maskWidth) / width);
    const maskScale = maskWidth / width;

    const masks = args.zones.map((zone) => {
      const canvas = makeCanvas(maskWidth, maskHeight);
      const ctx = context2d(canvas);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, maskWidth, maskHeight);
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
      for (const stroke of zone.strokes) {
        traceStroke(
          ctx,
          stroke,
          (point) => {
            const [ua, va] = transform.point(point);
            return [ua * maskWidth, va * maskHeight];
          },
          transform.lineWidth(stroke.size) * maskScale,
        );
      }
      return canvas.toDataURL('image/png');
    });

    const map = renderMap({ bitmap, width, height, zones: args.zones, transform });
    const art = await blobToDataUrl(blob);
    return { art, map, masks, width, height };
  } finally {
    bitmap.close();
  }
}

function renderMap(args: {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  zones: ZoneShape[];
  transform: ReturnType<typeof frameToAsset>;
}): string {
  const mapWidth = Math.min(args.width, 1024);
  const mapHeight = Math.round((args.height * mapWidth) / args.width);
  const scale = mapWidth / args.width;

  const canvas = makeCanvas(mapWidth, mapHeight);
  const ctx = context2d(canvas);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(args.bitmap, 0, 0, mapWidth, mapHeight);

  const toPixels = (point: ZonePoint) => {
    const [ua, va] = args.transform.point(point);
    return [ua * mapWidth, va * mapHeight] as const;
  };
  const ring = Math.max(2, Math.round(mapWidth * 0.004));

  args.zones.forEach((zone, index) => {
    const color = ZONE_MAP_COLORS[index % ZONE_MAP_COLORS.length].hex;

    // Corpo translúcido: o gerador continua a ver o que está por baixo.
    const body = makeCanvas(mapWidth, mapHeight);
    const bodyCtx = context2d(body);
    bodyCtx.strokeStyle = color;
    bodyCtx.fillStyle = color;
    for (const stroke of zone.strokes) {
      traceStroke(bodyCtx, stroke, toPixels, args.transform.lineWidth(stroke.size) * scale);
    }
    ctx.globalAlpha = 0.45;
    ctx.drawImage(body, 0, 0);
    ctx.globalAlpha = 1;

    // Contorno sólido: o traço mais largo, menos o traço — sobra o anel.
    const outline = makeCanvas(mapWidth, mapHeight);
    const outlineCtx = context2d(outline);
    outlineCtx.strokeStyle = color;
    outlineCtx.fillStyle = color;
    for (const stroke of zone.strokes) {
      traceStroke(
        outlineCtx,
        stroke,
        toPixels,
        args.transform.lineWidth(stroke.size) * scale + ring * 2,
      );
    }
    outlineCtx.globalCompositeOperation = 'destination-out';
    for (const stroke of zone.strokes) {
      traceStroke(outlineCtx, stroke, toPixels, args.transform.lineWidth(stroke.size) * scale);
    }
    ctx.drawImage(outline, 0, 0);

    // O número, no canto superior esquerdo da zona.
    let minX = Infinity;
    let minY = Infinity;
    for (const stroke of zone.strokes) {
      const radius = (args.transform.lineWidth(stroke.size) * scale) / 2;
      for (const point of stroke.points) {
        const [x, y] = toPixels(point);
        minX = Math.min(minX, x - radius);
        minY = Math.min(minY, y - radius);
      }
    }
    if (!Number.isFinite(minX)) return;

    const r = Math.max(12, Math.round(mapWidth * 0.024));
    const bx = Math.min(mapWidth - r - 4, Math.max(r + 4, minX));
    const by = Math.min(mapHeight - r - 4, Math.max(r + 4, minY));
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.18);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(r * 1.15)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1), bx, by + r * 0.05);
  });

  return canvas.toDataURL('image/jpeg', 0.9);
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('O browser não disponibilizou um contexto 2D.');
  return ctx;
}
