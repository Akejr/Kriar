/**
 * Composição de uma edição por zonas.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O gerador não edita: REDESENHA. Mesmo instruído a mudar só uma zona,
 * devolve a imagem inteira refeita — com o título às vezes com uma letra
 * diferente, o logótipo com outro peso, a luz um pouco mais quente. Para o
 * cliente, que pediu para mudar uma chávena, isso é a arte aprovada a
 * estragar-se sem ele ter pedido.
 *
 * Por isso a imagem nova não substitui a antiga. Entra só DENTRO das zonas,
 * e fora delas fica a arte original, píxel a píxel:
 *
 *  1. ALINHAR. O redesenho chega por vezes ligeiramente deslocado ou
 *     ampliado. Procuramos a escala e o deslocamento que melhor encaixam a
 *     imagem nova na antiga, comparando só o que fica FORA das zonas — que
 *     é o que devia ter ficado igual.
 *  2. ACERTAR A COR. Um desvio global de exposição ou temperatura faz uma
 *     costura visível à volta da zona. Um ganho e um desvio por canal,
 *     medidos fora das zonas e com limites apertados, apagam-no.
 *  3. COMPOR com uma máscara alargada e suavizada: a zona entra inteira, e
 *     a transição faz-se fora dela, em poucos píxeis.
 *
 * Se o alinhamento falhar — o gerador recompôs a arte toda —, compor seria
 * colar um bocado de uma imagem noutra diferente. Nesse caso devolvemos a
 * imagem nova inteira e dizemo-lo (`reason: 'desalinhada'`); quem chama
 * decide se repete.
 *
 * Tudo isto também MEDE: quanto mudou dentro de cada zona. Uma zona que
 * ficou igual é um pedido que não foi feito, e isso é um facto de píxeis,
 * não uma opinião de um modelo de visão.
 * ──────────────────────────────────────────────────────────────────────────
 */
import sharp from 'sharp';

export type ZoneChange = {
  /** Fracção dos píxeis da zona que mudaram de forma visível. */
  changed: number;
  /** Diferença média de luminância dentro da zona, de 0 a 255. */
  meanDiff: number;
  /** `true` quando a zona ficou, na prática, igual ao que estava. */
  unchanged: boolean;
};

export type ComposedEdit = {
  buffer: Buffer;
  mime: 'image/jpeg';
  width: number;
  height: number;
  /** `true` quando a imagem nova só entrou dentro das zonas. */
  composited: boolean;
  /**
   * · `composta` — alinhada e composta só nas zonas;
   * · `desalinhada` — pedida a composição, mas o gerador recompôs a arte;
   * · `livre` — o cliente deixou a IA mexer à volta das zonas.
   */
  reason: 'composta' | 'desalinhada' | 'livre';
  /** Escala e deslocamento encontrados (fracções da largura e da altura). */
  alignment: { scale: number; dx: number; dy: number; error: number };
  zones: ZoneChange[];
  /** Diferença média fora das zonas, depois de alinhar e acertar a cor. */
  outside: number;
};

/** Largura da análise. Chega para alinhar ao píxel da arte final. */
const ANALYSIS_WIDTH = 320;

/**
 * Erro médio de luminância (0–255) acima do qual a imagem nova não encaixa
 * na antiga. Calibrado com edições reais: uma arte redesenhada mas no
 * mesmo enquadramento fica muito abaixo; uma recomposição fica muito acima.
 */
const ALIGN_MAX_ERROR = 22;

/** Diferença de luminância a partir da qual um píxel "mudou". */
const CHANGE_THRESHOLD = 28;

type Warp = { s: number; dx: number; dy: number };

// --- Entrada -----------------------------------------------------------------

/** Área de cada máscara, em fracção da imagem. Para rejeitar zonas vazias. */
export async function measureMasks(masks: Buffer[]): Promise<number[]> {
  return Promise.all(
    masks.map(async (mask) => {
      const plane = await decodeGrey(mask, 256, 256);
      let count = 0;
      for (let index = 0; index < plane.length; index += 1) {
        if (plane[index] > 127) count += 1;
      }
      return count / plane.length;
    }),
  );
}

export async function composeEdit(args: {
  /** A arte antes da edição, como estava guardada. */
  base: Buffer;
  /** O que o gerador devolveu. */
  output: Buffer;
  /** Uma máscara por zona: branco na zona, preto no resto. */
  masks: Buffer[];
  /** `false` quando o cliente deixou a IA mexer à volta das zonas. */
  preserveOutside: boolean;
}): Promise<ComposedEdit> {
  const meta = await sharp(args.base).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new Error('Não foi possível ler a arte original.');

  // A imagem nova vai às medidas da antiga, em `cover`: o gerador devolve
  // a mesma proporção, mas não necessariamente os mesmos píxeis.
  const baseRgb = await decodeRgb(args.base, width, height, 'fill');
  const outRgb = await decodeRgb(args.output, width, height, 'cover');

  const fullMasks = await Promise.all(args.masks.map((mask) => decodeGrey(mask, width, height)));
  const union = new Uint8Array(width * height);
  for (const mask of fullMasks) {
    for (let index = 0; index < union.length; index += 1) {
      if (mask[index] > union[index]) union[index] = mask[index];
    }
  }

  // --- Análise em baixa resolução -------------------------------------------
  const w = ANALYSIS_WIDTH;
  const h = Math.max(1, Math.round((height * w) / width));
  const baseSmall = await resizeRaw(baseRgb, width, height, 3, w, h);
  const outSmall = await resizeRaw(outRgb, width, height, 3, w, h);
  const baseLuma = luma(baseSmall);
  const outLuma = luma(outSmall);

  const zoneSmall = await Promise.all(args.masks.map((mask) => decodeGrey(mask, w, h)));
  const unionSmall = new Uint8Array(w * h);
  for (const mask of zoneSmall) {
    for (let index = 0; index < unionSmall.length; index += 1) {
      if (mask[index] > 127) unionSmall[index] = 1;
    }
  }

  /*
    O que conta para alinhar: FORA das zonas, com folga, e longe das
    arestas. A folga (4% da largura) afasta a comparação do que o gerador
    mudou de propósito; as arestas mudam com frequência por razões que não
    interessam — uma tira de cor de um ou dois píxeis.
  */
  const excluded = dilateBinary(unionSmall, w, h, Math.round(w * 0.04));
  const border = Math.round(w * 0.02);
  const valid = new Uint8Array(w * h);
  for (let y = border; y < h - border; y += 1) {
    for (let x = border; x < w - border; x += 1) {
      const index = y * w + x;
      if (!excluded[index]) valid[index] = 1;
    }
  }

  // O passo largo percorre três mil candidatos: amostras de 6 em 6 chegam
  // para o pôr no sítio certo, e o passo fino acerta o resto.
  const coarse = samplesOf(valid, w, h, 6);
  const fine = samplesOf(valid, w, h, 2);
  let warp: Warp = { s: 1, dx: 0, dy: 0 };
  let error = Infinity;

  if (fine.length >= 200) {
    const meanBase = meanAt(baseLuma, coarse);
    const meanOut = meanAt(outLuma, coarse);

    /*
      Passo largo: ±10% de escala, ±5% de deslocamento.

      Começou em ±4%, e a primeira edição real encostou à beira: o gerador
      devolveu a arte 5% mais pequena. Um alcance curto não falha com
      estrondo — encontra o melhor DENTRO do alcance, que é um encaixe
      errado com costuras à volta da zona.
    */
    const wide: Warp[] = [];
    for (let s = 0.9; s <= 1.1001; s += 0.02) {
      for (let dx = -16; dx <= 16; dx += 2) {
        for (let dy = -16; dy <= 16; dy += 2) wide.push({ s, dx, dy });
      }
    }
    const first = bestWarp(baseLuma, outLuma, w, h, coarse, wide, meanBase, meanOut);

    // Passo fino, à volta do melhor.
    const narrow: Warp[] = [];
    for (const ds of [-0.01, -0.005, 0, 0.005, 0.01]) {
      for (let ddx = -2; ddx <= 2; ddx += 0.5) {
        for (let ddy = -2; ddy <= 2; ddy += 0.5) {
          narrow.push({ s: first.warp.s + ds, dx: first.warp.dx + ddx, dy: first.warp.dy + ddy });
        }
      }
    }
    const second = bestWarp(baseLuma, outLuma, w, h, fine, narrow, meanBase, meanOut);

    // Acabamento: um quarto de píxel da análise, menos de um píxel na arte.
    const finest: Warp[] = [];
    for (const ds of [-0.0025, 0, 0.0025]) {
      for (const ddx of [-0.25, 0, 0.25]) {
        for (const ddy of [-0.25, 0, 0.25]) {
          finest.push({ s: second.warp.s + ds, dx: second.warp.dx + ddx, dy: second.warp.dy + ddy });
        }
      }
    }
    warp = bestWarp(baseLuma, outLuma, w, h, fine, finest, meanBase, meanOut).warp;
  }

  const color = colorMatch(baseSmall, outSmall, w, h, fine, warp);
  error = fine.length >= 200 ? correctedError(baseSmall, outSmall, w, h, fine, warp, color) : Infinity;

  const zones = zoneSmall.map((mask) =>
    zoneChange(mask, baseSmall, outSmall, w, h, warp, color),
  );

  const alignment = {
    scale: round(warp.s, 4),
    dx: round(warp.dx / w, 4),
    dy: round(warp.dy / h, 4),
    error: round(error, 2),
  };

  const aligned = Number.isFinite(error) && error <= ALIGN_MAX_ERROR;

  if (!args.preserveOutside || !aligned) {
    return {
      buffer: await encodeJpeg(outRgb, width, height),
      mime: 'image/jpeg',
      width,
      height,
      composited: false,
      reason: args.preserveOutside ? 'desalinhada' : 'livre',
      alignment,
      zones,
      outside: alignment.error,
    };
  }

  // --- Composição em resolução total ----------------------------------------

  /*
    A zona CRESCE com o que é novo e lhe toca.

    A primeira edição real mostrou o caso: o cliente marcou uma chávena e
    pediu um copo alto. O copo saiu mais alto do que a marcação, e a
    composição cortou-lhe o topo — que ficou a desvanecer-se por cima do
    portátil. A marcação é um gesto à mão; o objecto novo não tem de caber
    nela ao píxel.

    Por isso a máscara final inclui o que mudou de forma clara, LIGADO à
    zona e até 8% da largura para fora dela. O que mudou longe da zona — um
    texto redesenhado do outro lado da arte — continua a ficar de fora: não
    está ligado a nada que o cliente tenha pedido.
  */
  const changedMap = changeMap(baseSmall, outSmall, w, h, warp, color);
  const grown = growRegion(unionSmall, changedMap, w, h, Math.round(w * 0.08));
  const grownFull = await resizeRaw(
    Uint8Array.from(grown, (value) => (value ? 255 : 0)),
    w,
    h,
    1,
    width,
    height,
  );
  for (let index = 0; index < union.length; index += 1) {
    if (grownFull[index] > union[index]) union[index] = grownFull[index];
  }

  const alpha = await featherMask(union, width, height);
  const composed = blend({
    base: baseRgb,
    output: outRgb,
    alpha,
    width,
    height,
    warp: { s: warp.s, dx: (warp.dx / w) * width, dy: (warp.dy / h) * height },
    color,
  });

  return {
    buffer: await encodeJpeg(composed, width, height),
    mime: 'image/jpeg',
    width,
    height,
    composited: true,
    reason: 'composta',
    alignment,
    zones,
    outside: alignment.error,
  };
}

// --- Descodificação ----------------------------------------------------------

async function decodeRgb(
  input: Buffer,
  width: number,
  height: number,
  fit: 'cover' | 'fill',
): Promise<Uint8Array> {
  const { data, info } = await sharp(input)
    .resize(width, height, { fit, position: 'centre', kernel: 'lanczos3' })
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });
  return pickChannels(data, info.channels, 3, width * height);
}

async function decodeGrey(input: Buffer, width: number, height: number): Promise<Uint8Array> {
  const { data, info } = await sharp(input)
    .resize(width, height, { fit: 'fill' })
    .removeAlpha()
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return pickChannels(data, info.channels, 1, width * height);
}

async function resizeRaw(
  data: Uint8Array,
  width: number,
  height: number,
  channels: 1 | 3,
  toWidth: number,
  toHeight: number,
): Promise<Uint8Array> {
  const { data: out, info } = await sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), {
    raw: { width, height, channels },
  })
    .resize(toWidth, toHeight, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return pickChannels(out, info.channels, channels, toWidth * toHeight);
}

/** Garante o número de canais pedido, seja o que for que o sharp devolveu. */
function pickChannels(
  data: Buffer,
  have: number,
  want: 1 | 3,
  pixels: number,
): Uint8Array {
  if (have === want) return new Uint8Array(data.buffer, data.byteOffset, data.length);
  const out = new Uint8Array(pixels * want);
  for (let index = 0; index < pixels; index += 1) {
    for (let channel = 0; channel < want; channel += 1) {
      out[index * want + channel] = data[index * have + Math.min(channel, have - 1)];
    }
  }
  return out;
}

function luma(rgb: Uint8Array): Float32Array {
  const out = new Float32Array(rgb.length / 3);
  for (let index = 0; index < out.length; index += 1) {
    const p = index * 3;
    out[index] = 0.299 * rgb[p] + 0.587 * rgb[p + 1] + 0.114 * rgb[p + 2];
  }
  return out;
}

// --- Alinhamento -------------------------------------------------------------

/** Índices dos píxeis válidos, de `step` em `step`. */
function samplesOf(valid: Uint8Array, w: number, h: number, step: number): Int32Array {
  const list: number[] = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const index = y * w + x;
      if (valid[index]) list.push(index);
    }
  }
  return Int32Array.from(list);
}

function meanAt(plane: Float32Array, samples: Int32Array): number {
  let sum = 0;
  for (let k = 0; k < samples.length; k += 1) sum += plane[samples[k]];
  return samples.length > 0 ? sum / samples.length : 0;
}

/** Amostra bilinear de um plano de um canal, com as coordenadas presas à imagem. */
function bilinear(plane: Float32Array, w: number, h: number, x: number, y: number): number {
  const xc = x < 0 ? 0 : x > w - 1 ? w - 1 : x;
  const yc = y < 0 ? 0 : y > h - 1 ? h - 1 : y;
  const x0 = Math.floor(xc);
  const y0 = Math.floor(yc);
  const x1 = x0 + 1 < w ? x0 + 1 : x0;
  const y1 = y0 + 1 < h ? y0 + 1 : y0;
  const fx = xc - x0;
  const fy = yc - y0;
  const a = plane[y0 * w + x0];
  const b = plane[y0 * w + x1];
  const c = plane[y1 * w + x0];
  const d = plane[y1 * w + x1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/**
 * O melhor encaixe entre os candidatos.
 *
 * O erro é a diferença média de luminância depois de tirar a média a cada
 * imagem: um desvio global de exposição não pode empurrar o alinhamento
 * para o sítio errado.
 */
function bestWarp(
  base: Float32Array,
  out: Float32Array,
  w: number,
  h: number,
  samples: Int32Array,
  candidates: Warp[],
  meanBase: number,
  meanOut: number,
): { warp: Warp; error: number } {
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  let best: Warp = { s: 1, dx: 0, dy: 0 };
  let bestError = Infinity;
  // Um encaixe que deixa metade das amostras fora da imagem não conta.
  const minimum = samples.length * 0.6;

  for (const candidate of candidates) {
    let sum = 0;
    let count = 0;
    for (let k = 0; k < samples.length; k += 1) {
      const index = samples[k];
      const x = index % w;
      const y = (index - x) / w;
      const xo = cx + (x - cx) * candidate.s + candidate.dx;
      const yo = cy + (y - cy) * candidate.s + candidate.dy;
      if (xo < 0 || yo < 0 || xo > w - 1 || yo > h - 1) continue;
      sum += Math.abs(base[index] - meanBase - (bilinear(out, w, h, xo, yo) - meanOut));
      count += 1;
    }
    if (count < minimum) continue;
    const error = sum / count;
    if (error < bestError) {
      bestError = error;
      best = candidate;
    }
  }
  return { warp: best, error: bestError };
}

type ColorFix = { gain: [number, number, number]; offset: [number, number, number] };

/** Amostra bilinear de um canal de uma imagem RGB intercalada. */
function bilinearRgb(
  rgb: Uint8Array,
  w: number,
  h: number,
  x: number,
  y: number,
  channel: number,
): number {
  const xc = x < 0 ? 0 : x > w - 1 ? w - 1 : x;
  const yc = y < 0 ? 0 : y > h - 1 ? h - 1 : y;
  const x0 = Math.floor(xc);
  const y0 = Math.floor(yc);
  const x1 = x0 + 1 < w ? x0 + 1 : x0;
  const y1 = y0 + 1 < h ? y0 + 1 : y0;
  const fx = xc - x0;
  const fy = yc - y0;
  const a = rgb[(y0 * w + x0) * 3 + channel];
  const b = rgb[(y0 * w + x1) * 3 + channel];
  const c = rgb[(y1 * w + x0) * 3 + channel];
  const d = rgb[(y1 * w + x1) * 3 + channel];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/**
 * Ganho e desvio por canal, medidos fora das zonas.
 *
 * Limites apertados de propósito: isto corrige um desvio global pequeno,
 * não uma imagem diferente. Um ganho livre, numa arte recomposta, pintava
 * a zona nova com a cor errada para a fazer "bater" com a antiga.
 */
function colorMatch(
  base: Uint8Array,
  out: Uint8Array,
  w: number,
  h: number,
  samples: Int32Array,
  warp: Warp,
): ColorFix {
  const fix: ColorFix = { gain: [1, 1, 1], offset: [0, 0, 0] };
  if (samples.length < 200) return fix;

  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  for (let channel = 0; channel < 3; channel += 1) {
    let sb = 0;
    let so = 0;
    let sbb = 0;
    let soo = 0;
    let n = 0;
    for (let k = 0; k < samples.length; k += 1) {
      const index = samples[k];
      const x = index % w;
      const y = (index - x) / w;
      const b = base[index * 3 + channel];
      const o = bilinearRgb(out, w, h, cx + (x - cx) * warp.s + warp.dx, cy + (y - cy) * warp.s + warp.dy, channel);
      sb += b;
      so += o;
      sbb += b * b;
      soo += o * o;
      n += 1;
    }
    const meanB = sb / n;
    const meanO = so / n;
    const stdB = Math.sqrt(Math.max(0, sbb / n - meanB * meanB));
    const stdO = Math.sqrt(Math.max(0, soo / n - meanO * meanO));
    const gain = stdO > 1 ? clamp(stdB / stdO, 0.85, 1.18) : 1;
    fix.gain[channel] = gain;
    fix.offset[channel] = clamp(meanB - gain * meanO, -25, 25);
  }
  return fix;
}

/** Erro de luminância depois do alinhamento e da correcção de cor. */
function correctedError(
  base: Uint8Array,
  out: Uint8Array,
  w: number,
  h: number,
  samples: Int32Array,
  warp: Warp,
  color: ColorFix,
): number {
  let sum = 0;
  for (let k = 0; k < samples.length; k += 1) {
    const index = samples[k];
    sum += Math.abs(lumaAt(base, index) - warpedLuma(out, w, h, index, warp, color));
  }
  return samples.length > 0 ? sum / samples.length : Infinity;
}

function lumaAt(rgb: Uint8Array, index: number): number {
  const p = index * 3;
  return 0.299 * rgb[p] + 0.587 * rgb[p + 1] + 0.114 * rgb[p + 2];
}

function warpedLuma(
  out: Uint8Array,
  w: number,
  h: number,
  index: number,
  warp: Warp,
  color: ColorFix,
): number {
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const x = index % w;
  const y = (index - x) / w;
  const xo = cx + (x - cx) * warp.s + warp.dx;
  const yo = cy + (y - cy) * warp.s + warp.dy;
  const weights = [0.299, 0.587, 0.114];
  let value = 0;
  for (let channel = 0; channel < 3; channel += 1) {
    const raw = bilinearRgb(out, w, h, xo, yo, channel);
    value += weights[channel] * clamp(color.gain[channel] * raw + color.offset[channel], 0, 255);
  }
  return value;
}

/** Quanto mudou dentro de uma zona. */
function zoneChange(
  mask: Uint8Array,
  base: Uint8Array,
  out: Uint8Array,
  w: number,
  h: number,
  warp: Warp,
  color: ColorFix,
): ZoneChange {
  let total = 0;
  let changed = 0;
  let sum = 0;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] <= 127) continue;
    const diff = Math.abs(lumaAt(base, index) - warpedLuma(out, w, h, index, warp, color));
    sum += diff;
    if (diff > CHANGE_THRESHOLD) changed += 1;
    total += 1;
  }
  if (total === 0) return { changed: 0, meanDiff: 0, unchanged: true };
  const fraction = changed / total;
  const meanDiff = sum / total;
  /*
    "Ficou igual" é deliberadamente estrito. Mudar um preço de 15.000 para
    12.000 altera poucos píxeis de uma zona larga — um limite folgado
    chamaria a isso "nada mudou" e repetia uma edição bem feita.
  */
  return {
    changed: round(fraction, 4),
    meanDiff: round(meanDiff, 2),
    unchanged: fraction < 0.006 && meanDiff < 5,
  };
}

/**
 * Onde a imagem nova difere claramente da antiga, depois de alinhada.
 *
 * Por canal e não só pela luminância: trocar uma chávena castanha por um
 * sumo cor de laranja muda pouco a luminância e muito a cor.
 */
function changeMap(
  base: Uint8Array,
  out: Uint8Array,
  w: number,
  h: number,
  warp: Warp,
  color: ColorFix,
): Uint8Array {
  const map = new Uint8Array(w * h);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  for (let index = 0; index < map.length; index += 1) {
    const x = index % w;
    const y = (index - x) / w;
    const xo = cx + (x - cx) * warp.s + warp.dx;
    const yo = cy + (y - cy) * warp.s + warp.dy;
    let worst = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      const raw = bilinearRgb(out, w, h, xo, yo, channel);
      const fixed = clamp(color.gain[channel] * raw + color.offset[channel], 0, 255);
      const diff = Math.abs(base[index * 3 + channel] - fixed);
      if (diff > worst) worst = diff;
    }
    if (worst > 34) map[index] = 1;
  }
  return map;
}

/**
 * A zona mais o que mudou e lhe está ligado, dentro de uma faixa.
 *
 * Um preenchimento a partir da zona, pelos vizinhos (8 direcções) que
 * mudaram e estão a menos de `band` píxeis dela.
 */
function growRegion(
  zone: Uint8Array,
  changed: Uint8Array,
  w: number,
  h: number,
  band: number,
): Uint8Array {
  const allowed = dilateBinary(zone, w, h, band);
  const out = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  for (let index = 0; index < zone.length; index += 1) {
    if (zone[index]) {
      out[index] = 1;
      queue[tail] = index;
      tail += 1;
    }
  }
  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % w;
    const y = (index - x) / w;
    for (let dy = -1; dy <= 1; dy += 1) {
      const ny = y + dy;
      if (ny < 0 || ny >= h) continue;
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx;
        if (nx < 0 || nx >= w || (dx === 0 && dy === 0)) continue;
        const next = ny * w + nx;
        if (out[next] || !allowed[next] || !changed[next]) continue;
        out[next] = 1;
        queue[tail] = next;
        tail += 1;
      }
    }
  }
  // Fecha os buracos de um píxel que o limiar deixa no meio do objecto novo.
  return dilateBinary(out, w, h, 1);
}

// --- Máscara e composição ----------------------------------------------------

/**
 * Dilatação binária com uma janela quadrada de raio `radius`.
 *
 * Por somas acumuladas, em duas passagens: o custo não depende do raio.
 */
function dilateBinary(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  if (radius <= 0) return mask.slice();
  const horizontal = new Uint8Array(w * h);
  const prefix = new Int32Array(Math.max(w, h) + 1);

  for (let y = 0; y < h; y += 1) {
    prefix[0] = 0;
    for (let x = 0; x < w; x += 1) prefix[x + 1] = prefix[x] + (mask[y * w + x] ? 1 : 0);
    for (let x = 0; x < w; x += 1) {
      const from = Math.max(0, x - radius);
      const to = Math.min(w, x + radius + 1);
      horizontal[y * w + x] = prefix[to] - prefix[from] > 0 ? 1 : 0;
    }
  }

  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x += 1) {
    prefix[0] = 0;
    for (let y = 0; y < h; y += 1) prefix[y + 1] = prefix[y] + horizontal[y * w + x];
    for (let y = 0; y < h; y += 1) {
      const from = Math.max(0, y - radius);
      const to = Math.min(h, y + radius + 1);
      out[y * w + x] = prefix[to] - prefix[from] > 0 ? 1 : 0;
    }
  }
  return out;
}

/**
 * A máscara da composição: a união das zonas, alargada e suavizada.
 *
 * Alargada em 1,2% da largura — a marcação do cliente é um gesto à mão, e
 * o que ele quer mudar costuma tocar-lhe a aresta. Suavizada depois, para
 * a transição não ser uma linha: fica fora da zona, e a zona em si entra
 * inteira.
 *
 * O alargamento é um desfoque seguido de um corte baixo. Numa aresta
 * recta, o desfoque gaussiano de σ passa por 20/255 a cerca de 1,42σ para
 * fora — daí a divisão.
 */
async function featherMask(union: Uint8Array, width: number, height: number): Promise<Uint8Array> {
  const grow = Math.max(4, Math.round(width * 0.012));
  const spread = await blurGrey(union, width, height, grow / 1.42);
  const dilated = new Uint8Array(spread.length);
  for (let index = 0; index < spread.length; index += 1) {
    dilated[index] = spread[index] > 20 ? 255 : 0;
  }
  return blurGrey(dilated, width, height, Math.max(0.6, width * 0.006));
}

async function blurGrey(
  plane: Uint8Array,
  width: number,
  height: number,
  sigma: number,
): Promise<Uint8Array> {
  const { data, info } = await sharp(Buffer.from(plane.buffer, plane.byteOffset, plane.byteLength), {
    raw: { width, height, channels: 1 },
  })
    .blur(Math.max(0.3, sigma))
    .raw()
    .toBuffer({ resolveWithObject: true });
  return pickChannels(data, info.channels, 1, width * height);
}

/** Mistura a imagem nova, alinhada e com a cor acertada, dentro da máscara. */
function blend(args: {
  base: Uint8Array;
  output: Uint8Array;
  alpha: Uint8Array;
  width: number;
  height: number;
  warp: Warp;
  color: ColorFix;
}): Uint8Array {
  const { base, output, alpha, width, height, warp, color } = args;
  const result = new Uint8Array(base.length);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const p = index * 3;
      const a = alpha[index];
      if (a === 0) {
        result[p] = base[p];
        result[p + 1] = base[p + 1];
        result[p + 2] = base[p + 2];
        continue;
      }
      const t = a / 255;
      const xo = cx + (x - cx) * warp.s + warp.dx;
      const yo = cy + (y - cy) * warp.s + warp.dy;
      for (let channel = 0; channel < 3; channel += 1) {
        const raw = bilinearRgb(output, width, height, xo, yo, channel);
        const fixed = clamp(color.gain[channel] * raw + color.offset[channel], 0, 255);
        result[p + channel] = Math.round(base[p + channel] * (1 - t) + fixed * t);
      }
    }
  }
  return result;
}

/**
 * JPEG a 93, sem subamostragem de cor: o texto da arte fica nítido nas
 * arestas, que é onde a subamostragem 4:2:0 deixa franjas.
 */
async function encodeJpeg(rgb: Uint8Array, width: number, height: number): Promise<Buffer> {
  return sharp(Buffer.from(rgb.buffer, rgb.byteOffset, rgb.byteLength), {
    raw: { width, height, channels: 3 },
  })
    .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function round(value: number, digits: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
