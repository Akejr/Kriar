/**
 * Planos e preços apresentados na página pública.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * ESTÁ VAZIO DE PROPÓSITO. A aplicação ainda não tem planos, preços nem
 * pagamentos, e a página pública não inventa nenhum: enquanto `PLANS` for
 * uma lista vazia, a secção "Planos" mostra só o que é verdade hoje sobre
 * uma geração (uma arte por geração, a verificação automática, os formatos,
 * o PNG e as várias empresas por conta) e diz que os planos em kwanzas são
 * anunciados em breve. A pergunta "Como posso pagar?" nem aparece.
 *
 * COMO PREENCHER
 * --------------
 * 1. Acrescenta um objecto por plano a `PLANS`, pela ordem em que devem
 *    aparecer (do mais pequeno para o maior). Exemplo de forma — os valores
 *    abaixo são marcadores, não uma proposta:
 *
 *      {
 *        id: 'essencial',
 *        name: 'Essencial',
 *        audience: 'Para quem publica uma ou duas vezes por semana.',
 *        priceKz: 0,              // em kwanzas, sem pontos: 15000 → "15.000 Kz"
 *        period: 'mês',
 *        generations: 0,          // gerações incluídas por mês
 *        brands: 1,               // empresas por conta
 *        formats: 'Todos os formatos',
 *        exportQuality: 'PNG nas medidas de cada rede',
 *      }
 *
 *    `null` num número quer dizer "ainda por definir": a linha correspondente
 *    não aparece no cartão (e um preço `null` aparece como "Preço por
 *    anunciar"). Nunca escrevas "ilimitado" sem o sistema o garantir.
 *
 * 2. Para destacar um plano, usa `recommended: true` e explica PARA QUEM é
 *    em `recommendedReason` — por exemplo "Para empresas que publicam todas
 *    as semanas". Nunca "Mais popular": não há dados que o sustentem, e um
 *    destaque pela adequação ajuda mais quem está a escolher.
 *
 * 3. Preenche `PLAN_RULES` com frases completas, em português de Portugal
 *    com a grafia anterior ao acordo (o resto da página usa-a):
 *     · `retries`      — como contam as repetições e a correcção automática;
 *     · `limitReached` — o que acontece quando a empresa chega ao limite;
 *     · `payment`      — como se paga (só com este preenchido é que a
 *                        pergunta "Como posso pagar?" aparece);
 *     · `contact`      — a quem perguntar (opcional).
 *
 * CUSTO MEDIDO, PARA AJUDAR A FIXAR O PREÇO
 * -----------------------------------------
 * Com o modelo de imagem actual, em qualidade alta:
 *  · cerca de 0,25 USD por imagem gerada;
 *  · cerca de 0,50 USD quando a verificação automática reprova a primeira
 *    tentativa e a Kriar gera a correcção (acontece no máximo uma vez por
 *    geração);
 *  · as chamadas de texto (a ideia e os textos da proposta, "Outra ideia")
 *    e a verificação por visão custam à parte e NÃO foram medidas com
 *    precisão — conta com uma margem por cima dos valores acima;
 *  · a edição por zonas também passa pelo modelo de imagem e pela
 *    verificação, e não foi medida à parte.
 * Converte para kwanzas ao câmbio do dia em que fixares os preços e revê-os
 * quando o modelo ou a qualidade mudarem.
 * ──────────────────────────────────────────────────────────────────────────
 */

export type Plan = {
  /** Identificador estável, em minúsculas e sem espaços. */
  id: string;
  /** Nome do plano, como aparece no cartão. */
  name: string;
  /** Para quem é, numa frase curta. */
  audience: string;
  /** Preço por período, em kwanzas. `null` = preço por anunciar. */
  priceKz: number | null;
  period: 'mês';
  /** Gerações incluídas por período. `null` = por definir (a linha não aparece). */
  generations: number | null;
  /** Empresas (marcas) que a conta pode ter. `null` = por definir. */
  brands: number | null;
  /** Que formatos inclui, numa frase curta. */
  formats: string;
  /** Como se descarrega, numa frase curta. */
  exportQuality: string;
  /** Destaque pela adequação, nunca pela popularidade. */
  recommended?: boolean;
  /** Obrigatório quando `recommended`: diz para quem é o destaque. */
  recommendedReason?: string;
};

export type PlanRules = {
  /** Como funcionam as repetições e a correcção automática. */
  retries: string | null;
  /** O que acontece quando se chega ao limite de gerações. */
  limitReached: string | null;
  /** Como se paga. Sem isto, a pergunta sobre pagamento não aparece. */
  payment: string | null;
  /** A quem perguntar sobre planos. */
  contact: string | null;
};

export const PLANS: Plan[] = [];

export const PLAN_RULES: PlanRules = {
  retries: null,
  limitReached: null,
  payment: null,
  contact: null,
};

/** Há planos publicados? Um só sítio para a pergunta, para as secções não divergirem. */
export function hasPublishedPlans(): boolean {
  return PLANS.length > 0;
}
