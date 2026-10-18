import { NextResponse } from 'next/server';
import { z } from 'zod';
import { extractJsonObject, resolveIdentityProvider } from '@/lib/ai/providers/text';
import {
  buildStyleLearningSystemPrompt,
  buildStyleLearningUserPrompt,
  LEARN_IMAGE_LIMIT,
  styleLearningResponseSchema,
} from '@/lib/ai/styleLearningPrompt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Doze imagens lidas de uma vez por um modelo de visão. Ver `timeoutMs`.
export const maxDuration = 150;

/**
 * Aprende o estilo da marca a partir das artes que ela já publicou.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Recebe até doze artes, já reduzidas no browser, e devolve o perfil do
 * estilo e as duas que melhor o representam. Não guarda nada: quem chama
 * guarda as duas escolhidas e o perfil na marca.
 *
 * As imagens não ficam no servidor. Só as duas escolhidas voltam a subir,
 * pelo armazenamento normal dos ficheiros da conta.
 * ──────────────────────────────────────────────────────────────────────────
 */

const requestSchema = z.object({
  company: z
    .object({
      name: z.string().max(120).default(''),
      segment: z.enum(['restaurantes', 'beleza', 'lojas', 'servicos', 'outro']).default('outro'),
      description: z.string().max(600).default(''),
    })
    .default({}),
  images: z
    .array(z.string().max(4_000_000).regex(/^data:image\/[a-z0-9+.-]+;base64,/i))
    .min(1)
    .max(LEARN_IMAGE_LIMIT),
  /**
   * Quantas das primeiras imagens podem ser escolhidas como referência.
   *
   * As restantes já estão na biblioteca da marca: entram na leitura, para o
   * perfil contar com elas, mas não voltam a ser guardadas. Zero quando a
   * leitura serve só para actualizar o perfil — uma arte aprovada entra na
   * biblioteca pelo botão, não pela escolha do modelo.
   */
  pickable: z.number().int().min(0).max(LEARN_IMAGE_LIMIT).optional(),
  /**
   * O perfil anterior, em texto. Contexto, não autoridade: foi lido também
   * de artes que podem já não estar guardadas.
   */
  previous: z.string().max(1200).default(''),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: `Pedido inválido. Envia entre 1 e ${LEARN_IMAGE_LIMIT} imagens.`,
        details: parsed.error.issues.map((issue) => issue.path.join('.')).slice(0, 6),
      },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const provider = resolveIdentityProvider();
  if (!provider?.supportsImages) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Aprender o estilo precisa de um modelo que veja imagens. Configura OPENROUTER_API_KEY nas Definições.',
      },
      { status: 503 },
    );
  }

  try {
    const raw = await provider.generateJson({
      system: buildStyleLearningSystemPrompt(),
      user: buildStyleLearningUserPrompt({
        company: input.company,
        imageCount: input.images.length,
        pickable: Math.min(input.pickable ?? input.images.length, input.images.length),
        previous: input.previous,
      }),
      images: input.images,
      // Uma leitura: a mesma pasta de artes tem de dar o mesmo perfil.
      temperature: 0.2,
      timeoutMs: 130_000,
      // Doze imagens descritas por extenso, com o raciocínio do modelo antes.
      maxTokens: 20_000,
    });

    const answer = styleLearningResponseSchema.safeParse(extractJsonObject(raw));
    if (!answer.success || !answer.data.summary) {
      throw new Error('a leitura voltou sem um perfil utilizável');
    }
    const data = answer.data;

    /*
      As escolhidas, validadas.

      O modelo numera a partir de 1 e às vezes repete uma, aponta para uma
      que não existe ou devolve só uma. Ficam as válidas, sem repetidos, e
      completa-se pela ordem de chegada — o cliente enviou-as todas como
      artes da marca, qualquer uma serve melhor do que nenhuma.
    */
    // Só entre as novas; as outras já estão guardadas. TODAS as novas, pela
    // ordem da leitura (a melhor primeiro) — eram só as duas primeiras.
    const pickable = Math.min(input.pickable ?? input.images.length, input.images.length);
    const wanted = pickable;
    const picks: Array<{ index: number; why: string; content: string; topics: string[] }> = [];
    for (const pick of data.picks) {
      const index = pick.index - 1;
      if (index < 0 || index >= pickable) continue;
      if (picks.some((entry) => entry.index === index)) continue;
      picks.push({ index, why: pick.why, content: pick.content, topics: pick.topics });
      if (picks.length === wanted) break;
    }
    for (let index = 0; picks.length < wanted && index < pickable; index += 1) {
      if (!picks.some((entry) => entry.index === index)) {
        picks.push({ index, why: '', content: '', topics: [] });
      }
    }

    return NextResponse.json({
      ok: true,
      provider: `${provider.id}:${provider.model}`,
      analysedCount: input.images.length,
      profile: {
        summary: data.summary,
        composition: data.composition,
        typography: data.typography,
        color: data.color,
        imagery: data.imagery,
        graphics: data.graphics,
        copy: data.copy,
        logo: data.logo,
        recurring: data.recurring,
      },
      consistency: data.consistency,
      picks,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: `Não foi possível ler o estilo das artes (${
          error instanceof Error ? error.message : 'erro desconhecido'
        }). As tuas imagens não foram guardadas — podes tentar de novo.`,
      },
      { status: 502 },
    );
  }
}
