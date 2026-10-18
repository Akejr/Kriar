import { NextResponse } from 'next/server';
import { applyGuardrails } from '@/lib/ai/guardrails';
import { planDeterministically } from '@/lib/ai/deterministicPlanner';
import {
  buildDirectionSystemPrompt,
  buildDirectionUserPrompt,
} from '@/lib/ai/directionPrompt';
import {
  directionResponseSchema,
  type DirectionResponse,
  type ProposedConcept,
} from '@/lib/ai/directionSchema';
import {
  extractJsonObject,
  resolveCreativeProvider,
  resolveTextProvider,
  type TextProvider,
} from '@/lib/ai/providers/text';
import { planRequestSchema, type PlanRequest } from '@/lib/ai/schema';
import { defaultLayoutFor } from '@/lib/composition/layouts';
import { newId } from '@/lib/utils/id';
import type { CreativeDirection } from '@/lib/domain/direction';
import type { ReferenceUsage } from '@/lib/domain/references';
import { referenceUsageFor } from '@/lib/references/select';
import type { StyleId } from '@/lib/domain/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// O modelo criativo vê as imagens e raciocina antes de propor: 20 a 60
// segundos, mais a segunda tentativa com o modelo de recurso.
export const maxDuration = 180;

/**
 * Interpretação do pedido e DIRECÇÃO CRIATIVA.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Esta rota deixou de escolher um modelo. Faz quatro coisas, nesta ordem:
 *
 *  A. interpreta o pedido num briefing estruturado;
 *  B. propõe direcções criativas próprias e escolhe a melhor;
 *  C. recupera referências adequadas à direcção escolhida — no servidor e de
 *     forma determinística;
 *  D. monta o plano de aproveitamento de cada referência.
 *
 * A e B são uma chamada ao modelo de texto. C e D não envolvem IA: a
 * filtragem é por técnicas e densidade que a própria direcção declarou, e as
 * proibições vêm do cadastro. Isto é deliberado — a decisão de que
 * referência usar e do que dela se aproveita fica auditável e não custa uma
 * segunda chamada.
 *
 * A ordem também importa: a direcção é criada ANTES de existir qualquer
 * referência em jogo. Era o inverso que produzia sempre a mesma cena.
 * ──────────────────────────────────────────────────────────────────────────
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = planRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Pedido inválido.',
        details: parsed.error.issues.map((issue) => issue.path.join('.')).slice(0, 8),
      },
      { status: 400 },
    );
  }

  const planRequest = parsed.data;

  /*
    O modelo criativo primeiro; o de texto, se aquele falhar.

    A ordem é a de qualidade: uma ideia do modelo criativo, depois uma do
    modelo barato, e só no fim as regras locais. Cair logo nas regras locais
    por um tempo-limite era trocar uma ideia fraca por nenhuma ideia.
  */
  const creative = resolveCreativeProvider();
  const fallback = resolveTextProvider();
  const providers = [creative, fallback].filter(
    (entry, index, list): entry is TextProvider =>
      Boolean(entry) && list.findIndex((other) => other?.model === entry?.model) === index,
  );
  const provider = providers[0] ?? null;

  if (!provider) {
    return NextResponse.json({
      ok: true,
      ...localPlan(planRequest),
      notice:
        'Modo de demonstração: não há fornecedor de texto configurado, por isso a publicação foi preparada por regras locais a partir do teu pedido.',
    });
  }

  try {
    let data: DirectionResponse | null = null;
    let used: TextProvider = provider;
    let lastError: unknown = null;

    for (const candidate of providers) {
      try {
        data = await proposeDirections(candidate, planRequest);
        used = candidate;
        break;
      } catch (error) {
        lastError = error;
        // No registo do servidor: uma queda para o modelo de recurso não
        // pode passar despercebida, porque é a qualidade da ideia que cai.
        console.warn(
          `[plan] ${candidate.model} falhou, a tentar o seguinte:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
    if (!data) throw lastError instanceof Error ? lastError : new Error('sem resposta');

    // O índice pode vir fora de alcance mesmo com a lista válida, porque a
    // validação tolerante descarta conceitos inválidos e encurta a lista.
    let index = Math.min(data.chosen, data.concepts.length - 1);

    /*
      Um cartaz só de texto não é escolhido sem o cliente o pedir.

      Rede de segurança do prompt: se, ainda assim, a direcção escolhida for
      tipográfica e o pedido não falar disso, fica a primeira com imagem. A
      tipográfica não se perde — vai para as alternativas.
    */
    // Recriar um cartaz tipográfico é pedir um cartaz tipográfico.
    const recreating = planRequest.attachments.some((attachment) => attachment.kind === 'recriar');
    if (
      data.concepts[index].approach === 'tipografica' &&
      !asksForTextOnly(planRequest.brief) &&
      !recreating
    ) {
      const visual = data.concepts.findIndex((entry) => entry.approach !== 'tipografica');
      if (visual >= 0) index = visual;
    }
    const concept = data.concepts[index];

    /*
      O estilo efectivo.

      Quando o cliente pediu `auto`, a escolha é a que o modelo devolveu. Se
      ele não a devolveu, fica `clean` — e não o estilo com mais referências
      cadastradas, que faria de "automático" um sinónimo de "tecnológico",
      porque as nove iniciais são quase todas desse estilo.
    */
    const style: StyleId =
      planRequest.style === 'auto' ? (data.style ?? 'clean') : planRequest.style;

    const direction = toDirection(concept);
    // A mesma escolha que o browser repete quando a ideia ou a grelha mudam.
    const references = referenceUsageFor({
      direction,
      style,
      itemCount: planRequest.itemCount,
    });

    /*
      Os guardrails continuam a correr.

      Validam o que a IA escreveu contra o que o cliente afirmou: um preço
      que não esteja no pedido, um produto que a empresa não mencionou. A
      arquitectura mudou; a desconfiança do conteúdo comercial não.
    */
    const { plan, removed } = applyGuardrails(
      {
        headline: data.texts.headline,
        subheadline: data.texts.subheadline,
        cta: data.texts.cta,
        badge: data.texts.badge,
        price: data.texts.price,
        items: data.items,
        highlightedItemIndex: data.highlightedItemIndex,
        mainImageIndex: data.mainImageIndex,
        visualDirection: direction.idea,
        backgroundPrompt: '',
        missingFields: data.missingFields,
        templateId: '',
      },
      planRequest,
    );

    return NextResponse.json({
      ok: true,
      source: 'ia' as const,
      provider: `${used.id}:${used.model}`,
      plan: withoutRemoved(plan, planRequest.removedTexts),
      brief: data.brief,
      direction,
      /** As outras candidatas, para "Outra ideia" não precisar de outra chamada. */
      alternatives: data.concepts
        .filter((_, position) => position !== index)
        .map(toDirection),
      style,
      references,
      notice:
        removed.length > 0
          ? `Removemos conteúdo que não podíamos confirmar: ${removed.slice(0, 3).join('; ')}.`
          : undefined,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'erro desconhecido';
    return NextResponse.json({
      ok: true,
      ...localPlan(planRequest),
      notice: `O fornecedor de texto não devolveu uma proposta utilizável (${reason}). Preparámos a publicação com as regras locais e mantivemos o teu conteúdo.`,
    });
  }
}

/**
 * Uma chamada ao modelo: as direcções, validadas. Lança em caso de falha.
 *
 * As imagens do cliente só vão a um modelo que as veja. As notas vão
 * sempre: mesmo sem a imagem, "esta é a página onde se paga" muda a ideia.
 */
async function proposeDirections(
  provider: TextProvider,
  planRequest: PlanRequest,
): Promise<DirectionResponse> {
  const images = provider.supportsImages
    ? planRequest.attachments
        .map((attachment) => attachment.dataUrl)
        .filter((url): url is string => Boolean(url))
    : [];

  const raw = await provider.generateJson({
    system: buildDirectionSystemPrompt(),
    user: buildDirectionUserPrompt({
      brief: planRequest.brief,
      style: planRequest.style,
      format: planRequest.format,
      imageCount: planRequest.imageCount,
      itemCount: planRequest.itemCount,
      attempt: planRequest.attempt,
      brand: planRequest.brand,
      identity: planRequest.identity,
      lockedTexts: planRequest.lockedTexts,
      recentIdeas: planRequest.recentIdeas,
      currentIdea: planRequest.currentIdea ?? null,
      refinement: planRequest.refinement,
      currentTexts: planRequest.currentTexts,
      removedTexts: planRequest.removedTexts,
      seenIdeas: planRequest.seenIdeas,
      learnedStyle: planRequest.learnedStyle,
      memory: planRequest.memory,
      attachments: planRequest.attachments.map((attachment) => ({
        note: attachment.note,
        kind: attachment.kind,
        seen: provider.supportsImages && Boolean(attachment.dataUrl),
      })),
    }),
    images: images.length > 0 ? images : undefined,
    // Três direcções completas, com o raciocínio do modelo antes delas.
    maxTokens: 20_000,
    timeoutMs: 110_000,
  });

  const validated = directionResponseSchema.safeParse(extractJsonObject(raw));
  if (!validated.success) {
    throw new Error(describeInvalid(validated.error.issues.map((i) => String(i.path[0] ?? ''))));
  }
  return validated.data;
}

/**
 * Os textos que o cliente apagou ficam apagados, diga o modelo o que disser.
 *
 * O prompt já o pede; isto é a segunda barreira. O browser é a terceira:
 * um texto apagado fica protegido e vazio (`setText`).
 */
function withoutRemoved<T extends Record<string, unknown>>(plan: T, removed: string[]): T {
  if (removed.length === 0) return plan;
  const next: Record<string, unknown> = { ...plan };
  for (const role of removed) if (role in next) next[role] = '';
  return next as T;
}

/** O cliente pediu, por palavras, uma arte só de texto? */
function asksForTextOnly(brief: string): boolean {
  return /\b(s[óo]\s+(?:com\s+)?texto|apenas\s+texto|s[óo]\s+tipografia|tipogr[áa]fic[ao]|sem\s+imagens?|sem\s+fotografias?)\b/i.test(
    brief,
  );
}

/**
 * Converte um conceito proposto na direcção que o projecto guarda.
 *
 * Leva também o que a escolha das referências precisa — a grelha, o
 * protagonista, as técnicas, as densidades —, para as referências serem
 * escolhidas de novo sempre que o cliente troca de ideia ou de grelha.
 */
function toDirection(concept: ProposedConcept): CreativeDirection {
  return {
    id: newId('dir'),
    idea: concept.idea,
    approach: concept.approach,
    scene: concept.scene,
    focus: concept.focus,
    hierarchy: concept.hierarchy,
    composition: concept.composition,
    lighting: concept.lighting,
    materials: concept.materials,
    brandApplication: concept.brandApplication,
    rationale: concept.rationale,
    ...(concept.graphics ? { graphics: concept.graphics } : {}),
    layout: concept.layout ?? defaultLayoutFor(concept.approach),
    subject: concept.subject,
    techniques: concept.techniquesWanted,
    textDensity: concept.textDensity,
    elementDensity: concept.elementDensity,
  };
}

/*
  As etapas C e D — recuperar referências e definir o aproveitamento —
  passaram para `referenceUsageFor` (lib/references/select.ts), que o browser
  também chama: as referências têm de acompanhar a ideia e a grelha de cada
  vez que o cliente as troca, e não só a primeira ideia.
*/

const NOMES_DE_CAMPO: Record<string, string> = {
  brief: 'o briefing',
  concepts: 'as direcções criativas',
  texts: 'os textos',
  items: 'as opções a mostrar',
  style: 'o estilo',
  missingFields: 'os campos a preencher',
};

function describeInvalid(fields: string[]): string {
  const nomes = [
    ...new Set(
      fields.filter(Boolean).map((campo) => NOMES_DE_CAMPO[campo] ?? `o campo "${campo}"`),
    ),
  ];
  if (nomes.length === 0) return 'a resposta não seguiu o formato esperado';
  if (nomes.length === 1) return `${nomes[0]} veio em falta ou inválido`;
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]} vieram em falta ou inválidos`;
}

/**
 * Recurso sem fornecedor de texto.
 *
 * O planeador determinístico continua a produzir textos e peças; a direcção
 * criativa é montada a partir do que ele decidiu. Não há IA, e por isso não
 * há conceitos alternativos — "Outra ideia" fica sem efeito, o que é honesto.
 */
function localPlan(planRequest: PlanRequest) {
  const plan = planDeterministically(planRequest);
  const { plan: guarded } = applyGuardrails(plan, planRequest);

  const style: StyleId = planRequest.style === 'auto' ? 'clean' : planRequest.style;

  const direction: CreativeDirection = {
    id: newId('dir'),
    idea:
      guarded.visualDirection ||
      `${planRequest.brand.name}: ${guarded.headline || 'publicação'}`,
    approach: planRequest.itemCount >= 3 ? 'varios-produtos' : 'fotografia-simples',
    scene:
      guarded.backgroundPrompt ||
      'Superfície de estúdio limpa, com o produto bem iluminado e fundo neutro.',
    focus: guarded.items[0] ?? 'o produto principal',
    hierarchy: 'Título, produto, chamada para acção.',
    composition: 'Produto ao centro, texto na zona mais calma, margens generosas.',
    lighting: 'Luz suave e direccional, sombras curtas.',
    materials: 'Superfície neutra e materiais reais.',
    brandApplication: 'Cores da marca no fundo e nos realces; produtos com as cores próprias.',
    rationale: 'Proposta preparada por regras locais, sem análise de IA.',
    layout: planRequest.itemCount >= 3 ? 'titulo-centro' : 'titulo-topo',
    subject: 'produto',
  };

  return {
    plan: withoutRemoved(guarded, planRequest.removedTexts),
    source: 'deterministico' as const,
    direction,
    alternatives: [] as CreativeDirection[],
    style,
    references: [] as ReferenceUsage[],
    brief: null,
  };
}
