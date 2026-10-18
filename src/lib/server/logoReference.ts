/**
 * Preparação do logótipo para enviar a um gerador de imagem.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O logótipo chegava ao gerador tal como o cliente o carregou: um PNG com
 * fundo transparente, margens vazias à volta e, muitas vezes, poucos píxeis.
 *
 * Cada uma dessas três coisas trabalha contra a fidelidade:
 *
 *  · TRANSPARÊNCIA. Um modelo de imagem não tem um "fundo transparente": tem
 *    de decidir uma cor para esses píxeis, e é comum assumir preto. O logótipo
 *    da DOT é azul-marinho muito escuro — sobre preto, fica praticamente
 *    invisível, e o gerador reconstrói as letras de memória. É a explicação
 *    mais provável para o logótipo espelhado: não estava a copiar uma forma,
 *    estava a adivinhá-la;
 *  · MARGENS VAZIAS. Um logótipo pequeno no meio de um quadro transparente
 *    desperdiça a resolução da referência em vazio;
 *  · POUCOS PÍXEIS. Um ficheiro de 300 px dá ao gerador letras com bordos
 *    serrilhados, e ele "corrige-os" redesenhando.
 *
 * O que fazemos: recortar o vazio, assentar o logótipo sobre um fundo sólido
 * que CONTRASTA com ele, dar-lhe uma margem uniforme e ampliá-lo até 1024 px.
 * O resultado é uma referência limpa e inequívoca — exactamente as mesmas
 * formas e cores, apresentadas de forma que não deixa nada por adivinhar.
 *
 * O ficheiro guardado do cliente nunca é tocado. Isto produz uma cópia só
 * para a chamada de geração.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { createHash } from 'node:crypto';
import sharp from 'sharp';

export type LogoTone = 'claro' | 'escuro';

export type PreparedLogo = {
  /** PNG pronto a enviar como referência. */
  dataUrl: string;
  /** Tom dos píxeis do logótipo, não do fundo. */
  tone: LogoTone;
  /** Identifica o ficheiro de origem. Chave das caches. */
  hash: string;
};

/** Lado maior da referência, margem incluída. O máximo útil para estes modelos. */
const TARGET = 1024;
/** Margem à volta do logótipo, em fracção do lado maior do logótipo. */
const PADDING = 0.14;
/** Lado maior a que um SVG é rasterizado antes do recorte. */
const RASTER = 2048;

const cache = new Map<string, PreparedLogo>();

export async function prepareLogoReference(dataUrl: string): Promise<PreparedLogo | null> {
  const match = /^data:(image\/[a-z0-9+.-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;

  const input = Buffer.from(match[2], 'base64');
  const hash = createHash('sha256').update(input).digest('hex').slice(0, 24);

  const cached = cache.get(hash);
  if (cached) return cached;

  try {
    /*
      SVG rasterizado com a resolução de que precisamos, e não mais.

      Com uma densidade fixa de 300, um SVG declarado com 2000 px ficava com
      mais de 8000 px de lado — 160 MB de memória para uma referência de
      1024. A densidade calcula-se para o lado maior dar cerca de duas vezes
      o tamanho final: folga para o recorte, sem desperdício.
    */
    const probe = await sharp(input).metadata();
    const declared = Math.max(probe.width ?? RASTER, probe.height ?? RASTER);
    const density =
      probe.format === 'svg'
        ? Math.min(2400, Math.max(72, Math.round((72 * RASTER) / declared)))
        : undefined;

    const source = sharp(input, density ? { density } : {}).ensureAlpha();
    const base = await source.png().toBuffer();

    /*
      Recorte do vazio.

      `trim` usa a cor do canto superior esquerdo como fundo. Num PNG
      transparente isso é transparência; num JPG com fundo branco, é branco.
      Falha quando a imagem é toda da mesma cor — e aí ficamos com o original.
    */
    const trimmed = await sharp(base)
      .trim({ threshold: 12 })
      .png()
      .toBuffer()
      .catch(() => base);

    const analysis = await analyse(trimmed);

    /*
      O fundo da referência contrasta com o LOGÓTIPO.

      Logótipo escuro sobre branco, logótipo claro sobre quase-preto. Não é
      uma sugestão de onde o pôr na arte — é só a forma de o gerador o ver
      bem. Num ficheiro sem transparência mantemos o fundo que ele já tem:
      faz parte do que o cliente nos deu.
    */
    const background = analysis.transparent
      ? analysis.tone === 'escuro'
        ? { r: 255, g: 255, b: 255, alpha: 1 }
        : { r: 20, g: 20, b: 20, alpha: 1 }
      : { ...analysis.corner, alpha: 1 };

    /*
      Em DOIS passos, e a ordem importa.

      O sharp aplica sempre o `resize` antes do `extend`, seja qual for a
      ordem das chamadas. Numa só cadeia, a margem era calculada sobre o
      tamanho original e somada DEPOIS da redução: a referência saía com
      1370 px em vez de 1024, e um SVG grande ficava com o logótipo pequeno
      no meio de 60% de margem por lado — exactamente o desperdício que este
      passo existe para evitar.

      Primeiro o logótipo vai ao tamanho que, somado à margem, dá 1024 de
      lado maior. Depois assenta no fundo e ganha a margem.
    */
    const inner = Math.round(TARGET / (1 + 2 * PADDING));
    const sized = await sharp(trimmed)
      // Ampliar é intencional: um logótipo de 300 px chega com letras
      // serrilhadas, e o gerador "corrige-as" redesenhando.
      .resize({
        width: inner,
        height: inner,
        fit: 'inside',
        withoutEnlargement: false,
        kernel: 'lanczos3',
      })
      .png()
      .toBuffer();

    const meta = await sharp(sized).metadata();
    const longest = Math.max(meta.width ?? inner, meta.height ?? inner);
    const pad = Math.round(longest * PADDING);

    const output = await sharp(sized)
      .flatten({ background })
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background })
      .png()
      .toBuffer();

    const prepared: PreparedLogo = {
      dataUrl: `data:image/png;base64,${output.toString('base64')}`,
      tone: analysis.tone,
      hash,
    };
    cache.set(hash, prepared);
    return prepared;
  } catch {
    // Um ficheiro que o sharp não lê não impede a geração: segue o original.
    return null;
  }
}

/**
 * Tom do logótipo e se o ficheiro tem transparência.
 *
 * O tom mede-se nos píxeis do LOGÓTIPO. Num ficheiro transparente, são os
 * opacos; num ficheiro com fundo próprio, são os que diferem da cor do canto.
 * Medir a imagem inteira dava "claro" a qualquer logótipo escuro sobre
 * branco, porque o branco é a maioria dos píxeis.
 */
async function analyse(buffer: Buffer): Promise<{
  tone: LogoTone;
  transparent: boolean;
  corner: { r: number; g: number; b: number };
}> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    // Reduzir antes de contar: o tom não precisa de todos os píxeis.
    .resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const corner = { r: data[0], g: data[1], b: data[2] };

  let transparentCount = 0;
  for (let i = 3; i < data.length; i += channels) {
    if (data[i] < 128) transparentCount += 1;
  }
  const total = data.length / channels;
  const transparent = transparentCount / total > 0.02;

  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += channels) {
    const alpha = data[i + 3];
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const isLogoPixel = transparent
      ? alpha >= 128
      : Math.abs(r - corner.r) + Math.abs(g - corner.g) + Math.abs(b - corner.b) > 60;
    if (!isLogoPixel) continue;

    sum += luminance(r, g, b);
    count += 1;
  }

  const mean = count > 0 ? sum / count : 0;
  return { tone: mean > 0.45 ? 'claro' : 'escuro', transparent, corner };
}

/** Luminância relativa WCAG de um píxel. */
function luminance(r: number, g: number, b: number): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
