/**
 * Planeador determinístico.
 *
 * É o que corre quando não há fornecedor de texto configurado, e também a
 * rede de segurança quando a resposta da IA não passa a validação.
 *
 * Não finge ser IA. Reorganiza o que o utilizador escreveu:
 *
 *   · separa as frases de CONTEÚDO ("estes perfumes") das frases de
 *     INSTRUÇÃO ("usa um estilo elegante"), e só as primeiras viram texto da
 *     arte;
 *   · retira do título o fragmento do preço, que passa para o seu próprio
 *     bloco;
 *   · constrói a chamada para acção a partir dos canais que a empresa tem
 *     realmente guardados;
 *   · escolhe o modelo por uma função estável do pedido, de modo que "Outra
 *     composição" percorra alternativas sem repetir.
 */
import { detectPrices, formatKz, stripPriceFragments } from '@/lib/utils/money';
import { describeColor } from '@/lib/composition/palette';
import { describeRecipe, recipeFor } from '@/lib/composition/backgrounds';
import { getTemplate, pickTemplate } from '@/lib/templates';
import { textSlotsOf, type Template } from '@/lib/templates/types';
import type { ContactType, StyleId } from '@/lib/domain/types';
import type { Plan, PlanRequest } from './schema';

// --- Análise do pedido ------------------------------------------------------

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const DIRECTIVE_START =
  /^(usa|use|usar|utiliza|utilize|faz|faça|fazer|cria|crie|criar|destaca|destaque|coloca|coloque|p[õo]e|ponha|mostra|mostre|inclui|inclua|incluir|escreve|escreva|acrescenta|adiciona|aplica|aplique|evita|evite|n[ãa]o|deixa|deixe|quero que|preciso que|gostaria que|tenta|tente)\b/i;

function isDirective(sentence: string): boolean {
  return DIRECTIVE_START.test(sentence.trim());
}

const LEAD_IN =
  /^(?:quero|queria|gostaria de|pretendo|preciso de|preciso|vou|vamos|ajuda-me a|ajuda a)?\s*(?:anunciar|divulgar|promover|publicar|mostrar|apresentar|vender|lan[çc]ar|criar(?:\s+uma)?(?:\s+arte|\s+publica[çc][ãa]o)?|fazer(?:\s+uma)?(?:\s+arte|\s+publica[çc][ãa]o)?)\s*(?:para|de|da|do|os|as|o|a)?\s*/i;

const DEMONSTRATIVES = /^(?:est[ea]s?|aquel[ea]s?|ess[ea]s?|o|a|os|as|um|uma|uns|umas|meu|minha|nosso|nossa|nossos|nossas)\s+/i;

/**
 * Retira o arranque do pedido ("quero anunciar…").
 *
 * NÃO retira o determinante. No título, "os nossos serviços" tem de chegar
 * como "nossos serviços" e não como "serviços": o possessivo é o que faz a
 * frase soar a empresa a falar e não a uma etiqueta de categoria.
 */
function stripLeadIn(sentence: string): string {
  return sentence.replace(LEAD_IN, '').trim();
}

/** Retira o determinante. Serve os nomes das peças: "estes perfumes" → "perfumes". */
function stripArticle(text: string): string {
  return text.replace(DEMONSTRATIVES, '').trim();
}

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toLocaleUpperCase('pt-PT') + text.slice(1);
}

/** Corta por palavras, nunca a meio de uma. */
function truncateWords(text: string, maxChars: number): string {
  const trimmed = text.replace(/[\s.,;:]+$/, '');
  if (trimmed.length <= maxChars) return trimmed;
  const words = trimmed.split(/\s+/);
  let out = '';
  for (const word of words) {
    const candidate = out ? `${out} ${word}` : word;
    if (candidate.length > maxChars) break;
    out = candidate;
  }
  return out || trimmed.slice(0, maxChars);
}

// --- Chamada para acção -----------------------------------------------------

/**
 * A ordem importa: a primeira regra que combinar é a escolhida.
 *
 * As intenções específicas vêm primeiro. Com a regra genérica do WhatsApp à
 * cabeça, um pedido de barbearia com "marcações pelo WhatsApp" saía como
 * "Encomenda pelo WhatsApp" — ninguém encomenda um corte de cabelo.
 */
const CTA_RULES: Array<{
  test: RegExp;
  needs: ContactType[];
  label: (channel: ContactType) => string;
}> = [
  {
    test: /marca[çc][õo]es|marca[çc][ãa]o|marcar|agend|consulta|\bhora\b/i,
    needs: ['whatsapp', 'telefone'],
    label: (channel) =>
      channel === 'whatsapp' ? 'Marca a tua hora pelo WhatsApp' : 'Marca a tua hora por telemóvel',
  },
  {
    test: /reserv|mesa|jantar|almo[çc]/i,
    needs: ['whatsapp', 'telefone'],
    label: (channel) =>
      channel === 'whatsapp' ? 'Reserva pelo WhatsApp' : 'Reserva pelo telemóvel',
  },
  {
    test: /whats?app|encomend|pedid/i,
    needs: ['whatsapp'],
    label: () => 'Encomenda pelo WhatsApp',
  },
  {
    test: /\bsite\b|online|loja virtual/i,
    needs: ['website'],
    label: () => 'Encomenda no nosso site',
  },
  {
    test: /visit|loja|espa[çc]o|balc[ãa]o/i,
    needs: ['endereco'],
    label: () => 'Visita-nos na loja',
  },
  {
    test: /liga|telefon|chama/i,
    needs: ['telefone', 'whatsapp'],
    label: () => 'Liga-nos agora',
  },
];

const FALLBACK_CTA: Array<{ type: ContactType; label: string }> = [
  { type: 'whatsapp', label: 'Fala com a gente no WhatsApp' },
  { type: 'telefone', label: 'Liga-nos' },
  { type: 'instagram', label: 'Segue-nos no Instagram' },
  { type: 'website', label: 'Vê mais no nosso site' },
  { type: 'endereco', label: 'Passa pela nossa loja' },
];

function buildCta(brief: string, available: ContactType[]): string {
  for (const rule of CTA_RULES) {
    if (!rule.test.test(brief)) continue;
    const channel = rule.needs.find((need) => available.includes(need));
    if (channel) return rule.label(channel);
  }
  for (const fallback of FALLBACK_CTA) {
    if (available.includes(fallback.type)) return fallback.label;
  }
  return '';
}

// --- Etiqueta ---------------------------------------------------------------

function buildBadge(brief: string): string {
  const text = brief.toLowerCase();
  if (/\bpromo[çc][ãa]o|promo\b/.test(text)) return 'Promoção';
  if (/\bdesconto|saldo/.test(text)) return 'Desconto';
  if (/\bnovidade|novo|nova\b/.test(text)) return 'Novidade';
  if (/\blan[çc]amento|lan[çc]ar/.test(text)) return 'Lançamento';
  if (/\bj[áa] abr|inaugura/.test(text)) return 'Já abrimos';
  if (/\bfim de semana|s[áa]bado|domingo/.test(text)) return 'Fim de semana';
  // Sem indicação no pedido não inventamos etiqueta.
  return '';
}

// --- Direcção visual --------------------------------------------------------

/**
 * Nota de luz e acabamento por estilo, para o planeador local.
 *
 * Descreve tratamento, nunca objectos. `auto` fica neutro de propósito: sem
 * fornecedor de IA não há quem escolha um estilo, e inventar um aqui era
 * decidir pelo cliente em silêncio.
 */
const STYLE_NOTES: Record<StyleId, string> = {
  auto: 'luz suave e acabamento sóbrio',
  clean: 'muito espaço livre e sombras quase imperceptíveis',
  elegante: 'luz lateral suave e sombras discretas',
  vibrante: 'contraste forte e sombras bem marcadas',
  tecnologico: 'luz controlada, superfícies limpas e reflexos contidos',
  cinematografico: 'luz direccional dramática, profundidade e sombras longas',
};

export function buildVisualDirection(request: PlanRequest, attempt: number): string {
  const recipe = recipeFor(request.style, request.brand.colors, request.brief, attempt);
  const baseColor = describeColor(request.brand.colors.primary);
  return `Fundo ${baseColor} com ${describeRecipe(recipe)}, ${STYLE_NOTES[request.style]}.`;
}

/**
 * Prompt para o ambiente gerado.
 *
 * Parte do `scenePrompt` do modelo, que descreve o cenário da referência, e
 * acrescenta o contexto do negócio e as cores da empresa. Descreve APENAS
 * ambiente: as peças, os textos e o logótipo são montados pela aplicação por
 * cima, em camadas próprias.
 */
export function buildBackgroundPrompt(request: PlanRequest, template: Template): string {
  const baseColor = describeColor(request.brand.colors.primary);
  const accent = describeColor(request.brand.colors.accent || request.brand.colors.secondary);
  const subject: Record<string, string> = {
    restaurantes: 'superfície de mesa e ambiente de restaurante desfocado',
    beleza: 'superfície lisa e ambiente de estúdio de beleza desfocado',
    lojas: 'estúdio fotográfico limpo com superfície de apoio',
    servicos: 'ambiente de escritório desfocado',
    outro: 'estúdio fotográfico limpo',
  };
  return [
    template.generation.scenePrompt,
    subject[request.brand.segment] ?? subject.outro,
    `dominante ${baseColor} com toques ${accent}`,
    STYLE_NOTES[request.style],
  ].join(', ');
}

// --- Opções apresentadas ----------------------------------------------------

const ITEM_SEPARATORS = /\s*(?:,|;|\/|\be\b|\bou\b)\s*/i;

const ITEM_LEADING_NOISE =
  /^(?:com|para|de|da|do|das|dos|em|no|na|nos|nas|a|o|as|os|um|uma|uns|umas|por|at[ée]|desde|tamb[ée]m|mais)\b/i;

const ITEM_TRAILING_NOISE =
  /\s+\b(?:por|de|da|do|a|ao|cada|cada\s+um|unidade|mais|tamb[ée]m|apenas|s[óo])\b[.!?]?$/i;

function trimNoise(term: string): string {
  let out = term.replace(/[.!?;:]+$/, '').trim();
  out = out.replace(ITEM_LEADING_NOISE, '').trim();
  // Os restos da remoção do preço ("Hugo Boss por cada") saem em cadeia.
  for (let pass = 0; pass < 3; pass += 1) {
    const next = out.replace(ITEM_TRAILING_NOISE, '').trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

function enumerateTerms(text: string, prices: ReturnType<typeof detectPrices>): string[] {
  // O preço sai antes de separar: senão "Hugo Boss por 15.000 Kz" era
  // descartado inteiro por conter números.
  const withoutPrices = stripPriceFragments(text, prices);
  return withoutPrices
    .split(ITEM_SEPARATORS)
    .map((part) => trimNoise(stripArticle(part)))
    // Termos longos são frases, não nomes de produto.
    .filter((part) => part.length >= 2 && part.length <= 28 && !/\d{3,}/.test(part));
}

/**
 * Nomes das opções a apresentar na arte.
 *
 * Só sai daqui o que o utilizador escreveu. Procuramos a enumeração mais
 * longa do pedido ("bolo, salgados e refrescos") e cada termo passa a nome de
 * uma peça. Sem enumeração devolvemos lista vazia — inventar nomes de
 * produtos seria afirmar que a empresa os vende.
 */
export function extractItemNames(
  source: string,
  max: number,
  prices = detectPrices(source),
): string[] {
  const sentences = splitSentences(source).filter((sentence) => !isDirective(sentence));
  // O texto já pode vir recortado (lado direito de dois pontos); nesse caso
  // não há frases a filtrar e analisamos o que recebemos.
  const candidates = sentences.length > 0 ? sentences : [source];

  let best: string[] = [];
  for (const sentence of candidates) {
    // "os nossos serviços: corte, barba" — a enumeração está depois dos dois
    // pontos; o que vem antes é a mensagem e não uma das opções.
    const colon = sentence.indexOf(':');
    const scope =
      colon !== -1 && enumerateTerms(sentence.slice(colon + 1), prices).length >= 2
        ? sentence.slice(colon + 1)
        : sentence;

    const terms = enumerateTerms(stripArticle(stripLeadIn(scope)), prices);
    const unique = [...new Set(terms.map((term) => capitalizeFirst(term)))];
    if (unique.length > best.length) best = unique;
  }

  return best.length >= 2 ? best.slice(0, max) : [];
}

type BriefParts = {
  /** Frase que dá o título. */
  message: string;
  /** Texto de onde saem os nomes das opções. */
  itemsSource: string;
  /** Frase consumida pela separação, para não voltar no subtítulo. */
  consumed: string | null;
};

/**
 * Separa a mensagem da enumeração.
 *
 * A forma mais comum de pedido é "quero anunciar X: a, b e c". Os dois lados
 * servem propósitos diferentes: o esquerdo é a mensagem e vai para o título,
 * o direito é a lista e vai para as peças. Sem esta separação o título
 * repetia, palavra por palavra, os nomes já desenhados nas peças — e a arte
 * dizia a mesma coisa duas vezes.
 */
function splitBriefParts(
  contentSentences: string[],
  prices: ReturnType<typeof detectPrices>,
): BriefParts {
  for (const sentence of contentSentences) {
    const colon = sentence.indexOf(':');
    if (colon === -1) continue;

    const left = sentence.slice(0, colon).trim();
    const right = sentence.slice(colon + 1).trim();
    if (!left || !right) continue;
    // Um único termo depois dos dois pontos não é uma enumeração.
    if (enumerateTerms(right, prices).length < 2) continue;

    return { message: left, itemsSource: right, consumed: sentence };
  }

  return {
    message: contentSentences[0] ?? '',
    itemsSource: contentSentences.join(' '),
    consumed: contentSentences[0] ?? null,
  };
}

// --- Planeamento ------------------------------------------------------------

export function planDeterministically(request: PlanRequest): Plan {
  const brief = (request.brief ?? '').trim();
  const attempt = request.attempt ?? 0;

  /*
    O modelo serve aqui apenas para LIMITES DE TEXTO.

    Não é escolha criativa: este caminho só corre sem fornecedor de IA, e o
    que o modelo contribui são os números de caracteres que o motor de
    composição local consegue desenhar sem transbordar. A escolha do modelo
    por segmento e estilo deixou de existir — era o que fazia um pedido de
    perfumaria sair com a encenação de outro sector.
  */
  const query = {
    segment: request.brand.segment,
    style: request.style,
    format: request.format,
    itemCount: request.itemCount || undefined,
  };

  const template = pickTemplate(query, brief || request.brand.name, attempt);

  const slots = textSlotsOf(getTemplate(template.id));
  const headlineMax = slots.get('headline')?.maxChars ?? 64;
  const subMax = slots.get('subheadline')?.maxChars ?? 130;

  const prices = detectPrices(brief);
  const sentences = splitSentences(brief);
  const contentSentences = sentences.filter((s) => !isDirective(s));
  const parts = splitBriefParts(contentSentences, prices);

  const headlineRaw = stripLeadIn(stripPriceFragments(parts.message, prices));
  const headline =
    capitalizeFirst(truncateWords(headlineRaw, headlineMax)) || request.brand.name;

  // O subtítulo fica com as frases que não deram título nem opções.
  const rest = contentSentences
    .filter((sentence) => sentence !== parts.consumed)
    .join(' ');
  const subheadlineRaw = stripPriceFragments(rest, prices);
  const subheadline = capitalizeFirst(truncateWords(subheadlineRaw, subMax));

  const available = request.brand.contacts.map((c) => c.type);
  const cta = buildCta(brief, available);

  const items = extractItemNames(parts.itemsSource, template.itemSlots.length, prices);

  const missingFields: Plan['missingFields'] = [];
  if (!brief) {
    missingFields.push({
      field: 'brief',
      question: 'Escreve o que queres anunciar para podermos preparar a composição.',
    });
  }

  // Este modelo mostra uma escolha entre opções. Sem opções suficientes a
  // composição fica incompleta, e é melhor perguntar do que preencher.
  if (brief && items.length < template.itemRange.min && request.itemCount === 0) {
    missingFields.push({
      field: 'items',
      question: `Quais são as opções a mostrar? Escreve ${template.itemRange.min} a ${template.itemRange.max}, separadas por vírgulas.`,
    });
  }

  return {
    headline,
    subheadline,
    cta,
    badge: buildBadge(brief),
    price: prices.length > 0 ? formatKz(prices[0].value) : '',
    templateId: template.id,
    items,
    highlightedItemIndex: 0,
    mainImageIndex: 0,
    visualDirection: buildVisualDirection(request, attempt),
    backgroundPrompt: buildBackgroundPrompt(request, template),
    missingFields,
  };
}
