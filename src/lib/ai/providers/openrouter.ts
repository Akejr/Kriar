/**
 * OpenRouter — partilhado pelos fornecedores de texto e de imagem.
 *
 * É o fornecedor principal do projecto. Uma chave, uma conta, duas APIs
 * distintas: `/chat/completions` para o planeamento e `/images` para os
 * fundos. Mesmo assim mantemos as duas interfaces separadas no código, para
 * poder trocar um lado sem tocar no outro.
 *
 * Referência: https://openrouter.ai/docs
 */

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/** Modelos por omissão. Os identificadores mudam: confirma em /models. */
export const OPENROUTER_DEFAULTS = {
  text: 'openai/gpt-4o-mini',
  /**
   * Análise de identidade: tarefa pesada, com imagem e um esquema grande.
   * Corre uma ou duas vezes por conta — vale um modelo melhor.
   */
  identity: 'openai/gpt-5.4',
  /**
   * Geração da arte.
   *
   * ────────────────────────────────────────────────────────────────────────
   * `gpt-5.4-image-2` combina o GPT-5.4 com o GPT Image 2: raciocina sobre
   * a instrução antes de gerar, e é isso que compramos aqui — obediência,
   * não estética.
   *
   * Medido no mesmo prompt contra `gpt-image-2.5-sunburst`: este respeitou a
   * margem de 8% nos quatro lados e devolveu o logótipo completo; o outro
   * cortou um dos produtos pela aresta esquerda. Margens e elementos
   * cortados eram exactamente a queixa.
   *
   * O preço está declarado: cerca de 0,20 USD por arte contra 0,05, e 86
   * segundos contra 40. Quatro vezes mais caro por uma arte que não precisa
   * de ser refeita é barato; uma arte com o logótipo cortado custa uma
   * geração nova e a confiança do cliente.
   * ────────────────────────────────────────────────────────────────────────
   */
  image: 'openai/gpt-5.4-image-2',
  /**
   * Patamar de resolução do fundo.
   *
   * `1K` de propósito: a arte tem 1080 px de largura, e `2K` devolvia
   * 1856×2304 — oito megabytes para desenhar um fundo desfocado. Num mercado
   * onde os dados móveis custam, isso é desperdício sem ganho visível.
   * Sobe para `2K` se precisares de fundos com detalhe fino.
   */
  imageResolution: '1K',
} as const;

export function openrouterKey(): string | null {
  return process.env.OPENROUTER_API_KEY?.trim() || null;
}

/**
 * Cabeçalhos de atribuição.
 *
 * O OpenRouter usa-os para identificar a aplicação no painel de consumo.
 * São opcionais, mas sem eles o consumo aparece sem origem.
 */
export function openrouterHeaders(key: string): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${key}`,
  };
  const site = process.env.OPENROUTER_SITE_URL?.trim();
  const title = process.env.OPENROUTER_APP_NAME?.trim();
  if (site) headers['HTTP-Referer'] = site;
  if (title) headers['X-Title'] = title;
  return headers;
}

type OpenRouterErrorBody = { error?: { code?: number; message?: string } };

/**
 * Converte um erro do OpenRouter numa mensagem útil.
 *
 * Distinguimos os casos que o utilizador pode resolver (sem saldo, modelo
 * errado, limite atingido) dos que são falhas transitórias.
 */
export async function describeOpenRouterError(
  response: Response,
  what: 'texto' | 'imagem',
): Promise<string> {
  let detail = '';
  try {
    const body = (await response.json()) as OpenRouterErrorBody;
    detail = body.error?.message?.trim() ?? '';
  } catch {
    // Corpo não-JSON: ficamos só com o código de estado.
  }

  const suffix = detail ? ` (${detail})` : '';

  switch (response.status) {
    case 401:
      return `A chave do OpenRouter foi recusada. Confirma OPENROUTER_API_KEY${suffix}.`;
    case 402:
      return `A conta do OpenRouter não tem saldo suficiente para gerar ${what}${suffix}.`;
    case 403:
      return `O OpenRouter bloqueou o pedido: limite de despesa ou chave desactivada${suffix}.`;
    case 404:
      return `Modelo de ${what} desconhecido. Escolhe um identificador actual em openrouter.ai/models${suffix}.`;
    case 413:
      return `O pedido de ${what} é demasiado grande${suffix}.`;
    case 429:
      return `O OpenRouter está a limitar os pedidos. Tenta dentro de alguns segundos${suffix}.`;
    case 502:
      return `O modelo de ${what} falhou do lado do fornecedor. Gerações falhadas não são cobradas${suffix}.`;
    default:
      return `O OpenRouter respondeu ${response.status} ao gerar ${what}${suffix}.`;
  }
}
