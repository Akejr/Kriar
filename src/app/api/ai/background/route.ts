import { NextResponse } from 'next/server';
import { buildImagePrompt } from '@/lib/ai/prompt';
import { resolveImageProvider } from '@/lib/ai/providers/image';
import { backgroundRequestSchema } from '@/lib/ai/schema';
import { stripForbiddenBackgroundTerms } from '@/lib/ai/guardrails';
import { recipeFor } from '@/lib/composition/backgrounds';
import { getTemplate } from '@/lib/templates';
import { generationReferences } from '@/lib/server/templateReference';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Acabamento visual: gera APENAS o fundo.
 *
 * Os textos, o logótipo, os contactos, o preço e as fotografias aprovadas
 * continuam em camadas controladas pela aplicação. É por isso que corrigir o
 * preço depois de gerar não obriga a refazer o fundo: o recurso de fundo
 * mantém-se e só as camadas de texto são redesenhadas.
 *
 * Sem fornecedor de imagem configurado, devolvemos uma receita determinística
 * que o browser desenha localmente. A interface identifica-a como fundo local
 * de demonstração — nunca como geração por IA.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = backgroundRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Pedido inválido.' }, { status: 400 });
  }

  const input = parsed.data;
  const provider = resolveImageProvider();

  if (!provider) {
    return NextResponse.json({
      ok: true,
      mode: 'local' as const,
      recipe: recipeFor(input.style, input.colors, input.seed || input.prompt, input.attempt),
      notice:
        'Modo de demonstração: fundo desenhado localmente a partir das cores desta publicação.',
    });
  }

  try {
    // As regras de geração vêm do modelo: é ele que descreve o cenário da
    // referência e o que não pode aparecer na imagem.
    const template = getTemplate(input.templateId);
    const prompt = buildImagePrompt(
      stripForbiddenBackgroundTerms(input.prompt),
      template,
    );

    const references = provider.acceptsReferences
      ? (await generationReferences(template)).map((reference) => reference.dataUrl)
      : [];

    const image = await provider.generate({ prompt, format: input.format, references });

    return NextResponse.json({
      ok: true,
      mode: 'ia' as const,
      provider: `${provider.id}:${provider.model}`,
      usedReferences: references.length,
      dataUrl: `data:${image.mime};base64,${image.base64}`,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'erro desconhecido';
    // Mantemos o rascunho intacto: devolvemos a alternativa local e explicamos.
    return NextResponse.json({
      ok: true,
      mode: 'local' as const,
      recipe: recipeFor(input.style, input.colors, input.seed || input.prompt, input.attempt),
      notice: `A geração de fundo falhou (${reason}). Desenhámos um fundo local para não perderes o trabalho.`,
    });
  }
}
