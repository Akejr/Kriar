import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { z } from 'zod';
import { buildPhotoEditPrompt } from '@/lib/ai/photoPrompt';
import { resolveImageProvider } from '@/lib/ai/providers/image';
import { formatEnum } from '@/lib/ai/schema';
import { ZONE_LIMIT, ZONE_MAP_COLORS } from '@/lib/composition/zoneConstants';
import { composeEdit, measureMasks } from '@/lib/server/artComposite';
import { validateUploadBytes } from '@/lib/server/validateUpload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Uma edição é uma geração completa mais a composição. O limite da arte.
export const maxDuration = 300;

/**
 * Edição por zonas de uma FOTOGRAFIA do cliente.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * A mesma mecânica de `/api/ai/edit-art`, sobre outro material. Recebe a
 * fotografia, o mapa das zonas e uma máscara e um pedido por zona; devolve
 * a fotografia editada, com a imagem nova composta só dentro das zonas
 * quando o cliente assim o quis.
 *
 * O que justifica uma rota própria e não um parâmetro na outra:
 *
 *  · o PROMPT é outro. `buildEditPrompt` fala de uma publicação aprovada,
 *    de cores de marca, de textos letra a letra e de um logótipo. Numa
 *    fotografia nada disso existe, e o que existe — "continua a parecer uma
 *    fotografia" — não faz sentido numa arte gerada;
 *  · a ENTRADA é outra. Não há `company`, `colors`, `texts`, `contacts` nem
 *    `logo`; há um ficheiro que veio de fora e tem de ser validado nos
 *    bytes (`validateUploadBytes`), coisa que uma arte da própria aplicação
 *    não precisa.
 *
 * O que é partilhado é o que dá as garantias: `measureMasks` rejeita zonas
 * vazias antes de se pagar uma geração, e `composeEdit` alinha o resultado
 * e deixa-o entrar apenas dentro das zonas — fora delas, a fotografia fica
 * igual ao píxel.
 * ──────────────────────────────────────────────────────────────────────────
 */

const dataUrl = (max: number) => z.string().max(max).regex(/^data:image\/[a-z0-9+.-]+;base64,/i);

const requestSchema = z.object({
  /** A fotografia, já reduzida pelo browser. */
  photo: dataUrl(14_000_000),
  /** A fotografia com as zonas pintadas e numeradas. */
  map: dataUrl(8_000_000),
  /**
   * Só decide a proporção pedida ao gerador.
   *
   * O cliente não a escolhe: vem da própria fotografia (`closestFormat`).
   * `composeEdit` traz o resultado de volta às medidas exactas da
   * fotografia, por isso isto é um pedido de enquadramento, não o formato
   * do ficheiro que sai.
   */
  format: formatEnum,
  zones: z
    .array(
      z.object({
        request: z.string().trim().min(3).max(400),
        position: z.string().max(160).default(''),
        mask: dataUrl(4_000_000),
        /** Material opcional para a zona: "põe aqui este produto". */
        image: dataUrl(8_000_000).nullable().default(null),
      }),
    )
    .min(1)
    .max(ZONE_LIMIT),
  preserveOutside: z.boolean().default(true),
  correction: z.array(z.string().max(400)).max(6).default([]),
});

function bufferOf(value: string): Buffer {
  return Buffer.from(value.slice(value.indexOf(',') + 1), 'base64');
}

/**
 * Fotografias pequenas de mais não valem uma geração.
 *
 * Um ícone ou uma miniatura puxada de uma conversa não têm informação para
 * o gerador trabalhar, e o que volta é uma imagem inventada com o aspecto
 * da original. Mais vale dizê-lo antes de cobrar.
 */
const MIN_EDGE = 320;

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

  const photo = bufferOf(input.photo);
  const valid = validateUploadBytes(new Uint8Array(photo), 'image');
  if (!valid.ok) {
    return NextResponse.json({ ok: false, error: valid.reason }, { status: 400 });
  }

  const source = await sharp(photo)
    .metadata()
    .catch(() => null);
  if (!source?.width || !source.height) {
    return NextResponse.json(
      { ok: false, error: 'Não foi possível ler esta fotografia. Tenta outro ficheiro.' },
      { status: 400 },
    );
  }
  if (Math.min(source.width, source.height) < MIN_EDGE) {
    return NextResponse.json(
      {
        ok: false,
        error: `Esta fotografia tem ${source.width}×${source.height} e é pequena de mais para editar com qualidade. Envia uma com pelo menos ${MIN_EDGE} píxeis no lado mais curto.`,
      },
      { status: 400 },
    );
  }

  // Zonas vazias param aqui, antes de se pagar uma geração: um traço que
  // saiu da fotografia dá uma máscara sem nada.
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
      {
        ok: false,
        error: `A zona ${empty + 1} está vazia. Pinta-a de novo por cima da fotografia.`,
      },
      { status: 400 },
    );
  }

  /*
    O fornecedor tem de aceitar imagens de entrada.

    A mesma exigência da edição de artes: editar é gerar COM a fotografia
    como referência. Um fornecedor só de texto devolveria uma imagem nova
    sem nunca ter visto a do cliente — pior do que falhar.
  */
  const provider = resolveImageProvider();
  if (!provider || !provider.acceptsReferences) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Editar fotografias precisa de um gerador que receba imagens. Configura OPENROUTER_API_KEY nas Definições.',
      },
      { status: 503 },
    );
  }

  // Imagem 1: a fotografia. Imagem 2: o mapa. Depois o material das zonas.
  const references: string[] = [input.photo, input.map];
  const imageIndexes = input.zones.map((zone) => {
    if (!zone.image) return null;
    references.push(zone.image);
    return references.length;
  });

  const prompt = buildPhotoEditPrompt({
    zones: input.zones.map((zone, index) => ({
      number: index + 1,
      request: zone.request,
      position: zone.position || 'na zona marcada',
      colorName: ZONE_MAP_COLORS[index % ZONE_MAP_COLORS.length].name,
      imageIndex: imageIndexes[index],
    })),
    preserveOutside: input.preserveOutside,
    correction: input.correction,
  });

  try {
    const image = await provider.generate({ prompt, format: input.format, references });

    const composed = await composeEdit({
      base: photo,
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
      // Diagnóstico: encaixou? quanto mudou em cada zona?
      alignment: composed.alignment,
      zones: composed.zones.map((zone, index) => ({ number: index + 1, ...zone })),
      outside: composed.outside,
      prompt,
      costUsd: image.costUsd ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'A edição falhou. A tua fotografia ficou intacta.',
      },
      { status: 502 },
    );
  }
}
