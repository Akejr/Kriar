import { stableHash } from '@/lib/utils/id';
import type { FormatId, SegmentId, StyleId } from '@/lib/domain/types';
import { modelo02ProximaJogada } from './modelo02';
import {
  applyFormatOverride,
  applyVariant,
  type CommunicationGoal,
  type Template,
} from './types';

/**
 * Biblioteca de modelos.
 *
 * É INTERNA. O cliente não escolhe modelos numa galeria: descreve o que quer
 * e o sistema escolhe. Cada modelo é uma referência criativa acompanhada de
 * regras — não um ficheiro com camadas nem um fundo fixo.
 *
 * As referências contêm a identidade Kriar como conteúdo de demonstração e
 * nunca são servidas ao browser nem copiadas para as artes dos clientes.
 *
 * Os modelos geométricos da primeira versão foram removidos: a direcção
 * passou a ser artes profissionais a partir de referências reais.
 */
export const TEMPLATES: Template[] = [modelo02ProximaJogada];

const byId = new Map(TEMPLATES.map((t) => [t.id, t]));

export const DEFAULT_TEMPLATE_ID = modelo02ProximaJogada.id;

export function getTemplate(id: string | undefined | null): Template {
  return byId.get(id ?? '') ?? byId.get(DEFAULT_TEMPLATE_ID) ?? TEMPLATES[0];
}

export function templateExists(id: unknown): boolean {
  return typeof id === 'string' && byId.has(id);
}

/**
 * Modelo pronto a resolver: variação de disposição primeiro, depois os
 * ajustes do formato. A ordem importa — a variação mexe nas mesmas caixas que
 * o formato depois afina.
 */
export function getTemplateForFormat(
  id: string | undefined | null,
  format: FormatId,
  variantId: string | null = null,
): Template {
  return applyFormatOverride(applyVariant(getTemplate(id), variantId), format);
}

export type TemplateQuery = {
  segment?: SegmentId;
  style?: StyleId;
  format?: FormatId;
  /** Quantidade de peças ou produtos disponíveis. */
  itemCount?: number;
  /** Objectivo de comunicação, quando conhecido. */
  goal?: CommunicationGoal;
};

function predicates(query: TemplateQuery) {
  const { segment, style, format, itemCount, goal } = query;
  return {
    supportsFormat: (t: Template) => !format || t.formats.includes(format),
    matchesSegment: (t: Template) => !segment || t.segments.includes(segment),
    matchesStyle: (t: Template) => !style || t.styles.includes(style),
    matchesGoal: (t: Template) => !goal || t.goals.includes(goal),
    fitsItems: (t: Template) => {
      if (itemCount === undefined || itemCount === 0) return true;
      // Acima do máximo não serve: o modelo declara quantas peças comporta.
      return itemCount <= t.itemRange.max;
    },
  };
}

/** Correspondências fortes: servem formato, segmento, estilo e objectivo. */
export function strongMatches(query: TemplateQuery): Template[] {
  const p = predicates(query);
  return TEMPLATES.filter(
    (t) =>
      p.supportsFormat(t) &&
      p.matchesSegment(t) &&
      p.matchesStyle(t) &&
      p.matchesGoal(t) &&
      p.fitsItems(t),
  );
}

export function candidateTemplates(query: TemplateQuery): Template[] {
  const p = predicates(query);

  const tiers: Array<(t: Template) => boolean> = [
    (t) =>
      p.supportsFormat(t) &&
      p.matchesSegment(t) &&
      p.matchesStyle(t) &&
      p.matchesGoal(t) &&
      p.fitsItems(t),
    (t) => p.supportsFormat(t) && p.matchesSegment(t) && p.matchesGoal(t) && p.fitsItems(t),
    (t) => p.supportsFormat(t) && p.matchesGoal(t) && p.fitsItems(t),
    (t) => p.supportsFormat(t) && p.fitsItems(t),
    p.supportsFormat,
  ];

  const seen = new Set<string>();
  const ordered: Template[] = [];
  for (const tier of tiers) {
    for (const template of TEMPLATES) {
      if (seen.has(template.id)) continue;
      if (!tier(template)) continue;
      seen.add(template.id);
      ordered.push(template);
    }
  }
  return ordered.length > 0 ? ordered : TEMPLATES.slice();
}

/**
 * Modelos que podem ser propostos para um pedido.
 *
 * É esta a lista enviada ao fornecedor de texto E a lista contra a qual a
 * resposta é validada. Usar a mesma função nos dois lados evita oferecer à IA
 * modelos inadequados e depois aceitar a escolha sem reparar.
 */
export function allowedTemplatesFor(query: TemplateQuery): Template[] {
  const strong = strongMatches(query);
  return strong.length > 0 ? strong : candidateTemplates(query);
}

export function pickTemplate(query: TemplateQuery, seed: string, attempt = 0): Template {
  const pool = allowedTemplatesFor(query);
  const offset = stableHash(seed) % pool.length;
  return pool[(offset + attempt) % pool.length];
}

/**
 * Próxima disposição a propor.
 *
 * Com uma biblioteca pequena, "Outra composição" percorre as VARIAÇÕES do
 * modelo actual antes de considerar outro modelo. Reorganizar o conceito é
 * mais útil do que trocá-lo por um que serve pior o pedido.
 */
export function nextArrangement(
  query: TemplateQuery,
  current: { templateId: string; variantId: string | null },
): { templateId: string; variantId: string | null } {
  const template = getTemplate(current.templateId);
  const variants = template.variants;

  if (variants.length > 1) {
    const index = variants.findIndex((v) => v.id === current.variantId);
    const next = variants[(index + 1) % variants.length];
    // Depois de percorrer todas as variações, passa ao modelo seguinte.
    if (index !== -1 && index < variants.length - 1) {
      return { templateId: template.id, variantId: next.id };
    }
    if (index === -1) {
      return { templateId: template.id, variantId: variants[0].id };
    }
  }

  const pool = allowedTemplatesFor(query);
  const position = pool.findIndex((t) => t.id === current.templateId);
  const seguinte = pool[(position + 1) % pool.length] ?? template;
  return {
    templateId: seguinte.id,
    variantId: seguinte.variants[0]?.id ?? null,
  };
}

/** Identificadores aceites pelo validador do plano da IA. */
export function templateIdList(): string[] {
  return TEMPLATES.map((t) => t.id);
}

export { applyFormatOverride, applyVariant };
export type { Template, CommunicationGoal };
