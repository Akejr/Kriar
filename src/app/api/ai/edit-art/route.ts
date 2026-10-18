import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildEditPrompt } from '@/lib/ai/editPrompt';
import { resolveImageProvider } from '@/lib/ai/providers/image';
import { formatEnum } from '@/lib/ai/schema';
import { ZONE_LIMIT, ZONE_MAP_COLORS } from '@/lib/composition/zoneConstants';
import { composeEdit, measureMasks } from '@/lib/server/artComposite';
import { prepareLogoReference } from '@/lib/server/logoReference';
import { readLogo } from '@/lib/server/logoReading';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Uma edição é uma geração completa (perto de 90 segundos) mais a
// composição. O mesmo limite da rota da arte.
export const maxDuration = 300;

/**
 * Edição de uma arte gerada, por zonas.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Recebe a arte guardada, uma máscara e um pedido por zona, e o mapa das
 * zonas. Devolve a arte editada — com a imagem nova composta só dentro das
 * zonas quando o cliente assim o quis — e o que mudou em cada uma.
 *
 * As máscaras nunca vão ao gerador. São do servidor: é com elas que a
 * composição garante que o resto da arte fica exactamente como estava.
 * ──────────────────────────────────────────────────────────────────────────
 */

const dataUrl = (max: number) => z.string().max(max).regex(/^data:image\/[a-z0-9+.-]+;base64,/i);

const requestSchema = z.object({
  /** A arte actual, tal como está guardada. */
  art: dataUrl(14_000_000),
  /** A arte com as zonas pintadas e numeradas. */
  map: dataUrl(8_000_000),
  format: formatEnum,
  zones: z
    .array(
      z.object({
        request: z.string().trim().min(3).max(400),
        position: z.string().max(160).default(''),
        mask: dataUrl(4_000_000),
        /** Material opcional para a zona: "troca por este produto". */
        image: dataUrl(8_000_000).nullable().default(null),
      }),
    )
    .min(1)
    .max(ZONE_LIMIT),
  preserveOutside: z.boolean().default(true),
  company: z.string().max(120).default(''),
  colors: z.object({
    primary: z.string().max(9),
    secondary: z.string().max(9),
    accent: z.string().max(9).nullable().optional(),
  }),
  texts: z.array(z.string().max(240)).max(8).default([]),
  // Sete canais de contacto possíveis; oito dá folga.
  contacts: z.array(z.string().max(160)).max(8).default([]),
  /** O logótipo, quando a arte o leva. */
  logo: dataUrl(8_000_000).nullable().default(null),
  correction: z.array(z.string().max(400)).max(6).default([]),
});

function bufferOf(value: string): Buffer {
  return Buffer.from(value.slice(value.indexOf(',') + 1), 'base64');
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Pedido de edição inválido.',
        details: parsed.error.issues.map((issue) => issue.path.join('.')).slice(0, 8),
      },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const provider = resolveImageProvider();
  if (!provider || !provider.acceptsReferences) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'A edição por zonas precisa de um gerador que receba imagens. Configura OPENROUTER_API_KEY nas Definições.',
      },
      { status: 503 },
    );
  }

  /*
    Zonas vazias param aqui, antes de se pagar uma geração.

    Um traço que saiu da arte (pintado na margem do ecrã, por exemplo) dá
    uma máscara sem nada, e o gerador recebia um pedido para uma zona que
    não existe no mapa.
  */
  const masks = input.zones.map((zone) => bufferOf(zone.mask));
  const areas = await measureMasks(masks).catch(() => null);
  if (!areas) {
    return NextResponse.json(
      { ok: false, error: 'Não foi possível ler as zonas marcadas.' },
      { status: 400 },
    );
  }
  const empty = areas.findIndex((area) => area < 0.0003);
  if (empty >= 0) {
    return NextResponse.json(
      { ok: false, error: `A zona ${empty + 1} está vazia. Pinta-a de novo por cima da arte.` },
      { status: 400 },
    );
  }

  /*
    O logótipo, preparado e transcrito como na geração.

    Só serve se uma alteração lhe tocar — mas é exactamente aí que um
    gerador o redesenha, e a referência limpa e a leitura soletrada são as
    mesmas defesas que funcionaram na geração.
  */
  const preparedLogo = input.logo ? await prepareLogoReference(input.logo) : null;
  const logoReading = preparedLogo ? await readLogo(preparedLogo) : null;

  // Imagem 1: a arte. Imagem 2: o mapa. Depois o logótipo e o material das zonas.
  const references: string[] = [input.art, input.map];
  let logoIndex: number | null = null;
  if (preparedLogo) {
    references.push(preparedLogo.dataUrl);
    logoIndex = references.length;
  }
  const imageIndexes = input.zones.map((zone) => {
    if (!zone.image) return null;
    references.push(zone.image);
    return references.length;
  });

  const prompt = buildEditPrompt({
    company: input.company,
    zones: input.zones.map((zone, index) => ({
      number: index + 1,
      request: zone.request,
      position: zone.position || 'na zona marcada',
      colorName: ZONE_MAP_COLORS[index % ZONE_MAP_COLORS.length].name,
      imageIndex: imageIndexes[index],
    })),
    preserveOutside: input.preserveOutside,
    logo:
      logoIndex && logoReading
        ? {
            index: logoIndex,
            text: logoReading.text,
            letters: logoReading.letters,
            symbols: logoReading.symbols,
          }
        : logoIndex
          ? { index: logoIndex, text: '', letters: [], symbols: '' }
          : null,
    colors: input.colors,
    texts: input.texts,
    contacts: input.contacts,
    correction: input.correction,
  });

  /*
    Diagnóstico, só em desenvolvimento: devolve também a imagem crua do
    gerador. É o que permite afinar a composição sem pagar uma geração por
    cada tentativa. Em produção não existe.
  */
  const debug =
    process.env.NODE_ENV !== 'production' &&
    typeof body === 'object' &&
    body !== null &&
    (body as { debug?: unknown }).debug === true;

  try {
    const image = await provider.generate({ prompt, format: input.format, references });

    const composed = await composeEdit({
      base: bufferOf(input.art),
      output: Buffer.from(image.base64, 'base64'),
      masks,
      preserveOutside: input.preserveOutside,
    });

    return NextResponse.json({
      ok: true,
      provider: `${provider.id}:${provider.model}`,
      dataUrl: `data:${composed.mime};base64,${composed.buffer.toString('base64')}`,
      width: composed.width,
      height: composed.height,
      composited: composed.composited,
      reason: composed.reason,
      // Diagnóstico: quando uma edição sai estranha, é isto que se olha
      // primeiro — encaixou? quanto mudou em cada zona?
      alignment: composed.alignment,
      zones: composed.zones.map((zone, index) => ({ number: index + 1, ...zone })),
      outside: composed.outside,
      prompt,
      costUsd: image.costUsd ?? null,
      ...(debug ? { raw: `data:${image.mime};base64,${image.base64}` } : {}),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'A edição falhou. A arte que tinhas ficou intacta.',
      },
      { status: 502 },
    );
  }
}
