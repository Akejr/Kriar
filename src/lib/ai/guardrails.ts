/**
 * Guardrails do plano.
 *
 * Correm SEMPRE no servidor, depois da validação do esquema e antes de a
 * resposta chegar ao browser. Removem conteúdo que a aplicação não tem
 * fundamento para afirmar.
 *
 * Regra de base: a IA pode reorganizar e reescrever o que o utilizador disse.
 * Não pode acrescentar factos comerciais. Em concreto, não podem passar:
 *
 *   · preços que o utilizador não escreveu;
 *   · descontos ou percentagens que o pedido não mencione;
 *   · números de telefone, endereços, redes sociais ou sites que não estejam
 *     no perfil da empresa e escolhidos para esta publicação;
 *   · prazos e condições de venda ("válido até", "stock limitado", ...)
 *     ausentes do pedido.
 *
 * Quando falta informação essencial, devolvemos um campo a preencher em vez
 * de inventar.
 */
import { detectPrices, formatKz, looksLikePromotion } from '@/lib/utils/money';
import type { Plan, PlanRequest } from './schema';

export type GuardrailReport = {
  plan: Plan;
  /** O que foi removido, para podermos ser transparentes na interface. */
  removed: string[];
};

const DIGIT_RUN = /\d[\d\s.\-()]{5,}\d/g;
const URL_LIKE = /\b(?:https?:\/\/|www\.)[^\s]+|\b[a-z0-9-]+\.(?:ao|com|pt|net|org)\b/gi;
const HANDLE = /@[a-z0-9._]{2,}/gi;
const PERCENT = /\b\d{1,3}\s?%/g;
const CONDITION_PHRASES = [
  /v[áa]lido até[^.;]*/gi,
  /stock limitado/gi,
  /enquanto durar(?:em)? o[s]? stock[s]?/gi,
  /promo[çc][ãa]o v[áa]lida[^.;]*/gi,
  /entrega gr[áa]tis/gi,
  /garantia de \d+[^.;]*/gi,
];

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Números aceitáveis: os do perfil da empresa E os que o utilizador escreveu
 * no pedido.
 *
 * O guardrail existe para travar INVENÇÃO, não para contrariar o utilizador.
 * Nos testes com IA real, um número escrito no pedido ("liga para o
 * 923 111 222") estava a ser removido — o utilizador perdia informação que
 * tinha dado de propósito.
 */
function allowedNumbers(request: PlanRequest): Set<string> {
  const set = new Set<string>();
  for (const contact of request.brand.contacts) {
    const digits = normalizeDigits(contact.value);
    if (digits.length >= 6) set.add(digits);
  }
  for (const match of (request.brief ?? '').match(DIGIT_RUN) ?? []) {
    const digits = normalizeDigits(match);
    if (digits.length >= 6) set.add(digits);
  }
  return set;
}

function allowedTexts(request: PlanRequest): string[] {
  const doPerfil = request.brand.contacts.map((c) => c.value.toLowerCase().trim());
  // Endereços e perfis escritos no pedido também contam como confirmados.
  const doPedido = [
    ...((request.brief ?? '').match(URL_LIKE) ?? []),
    ...((request.brief ?? '').match(HANDLE) ?? []),
  ].map((value) => value.toLowerCase().trim());
  return [...doPerfil, ...doPedido].filter(Boolean);
}

function scrubContacts(
  value: string,
  request: PlanRequest,
  removed: string[],
  fieldLabel: string,
): string {
  let out = value;

  out = out.replace(DIGIT_RUN, (match) => {
    const digits = normalizeDigits(match);
    for (const allowed of allowedNumbers(request)) {
      if (allowed.endsWith(digits) || digits.endsWith(allowed)) return match;
    }
    removed.push(`${fieldLabel}: número não confirmado (${match.trim()})`);
    return ' ';
  });

  out = out.replace(URL_LIKE, (match) => {
    const lower = match.toLowerCase();
    if (allowedTexts(request).some((allowed) => allowed.includes(lower) || lower.includes(allowed)))
      return match;
    removed.push(`${fieldLabel}: endereço não confirmado (${match})`);
    return ' ';
  });

  out = out.replace(HANDLE, (match) => {
    const lower = match.toLowerCase();
    if (allowedTexts(request).some((allowed) => allowed.includes(lower.replace('@', ''))))
      return match;
    removed.push(`${fieldLabel}: perfil não confirmado (${match})`);
    return ' ';
  });

  return out;
}

/**
 * O botão é uma acção, não um contacto.
 *
 * Os contactos verdadeiros já vão na linha dos contactos da arte. Numa
 * geração real o botão saiu "Encomenda pelo WhatsApp: +244 923 000 000",
 * com o mesmo número escrito logo por baixo — e o número é verdadeiro, por
 * isso `scrubContacts` deixava-o passar. Sete dígitos ou mais: um preço como
 * "150.000" fica.
 */
function stripContactsFromCta(value: string, removed: string[]): string {
  // O perfil antes do site: "@kianda.ao" também parece um domínio, e
  // tirado como domínio deixava o "@" no botão.
  const out = value
    .replace(/\+?\d[\d\s.\-()]{5,}\d/g, (match) => (normalizeDigits(match).length >= 7 ? ' ' : match))
    .replace(HANDLE, ' ')
    .replace(URL_LIKE, ' ');
  // "Compra em www…" ficava "Compra em": a preposição que apontava para o
  // contacto sai com ele.
  const cleaned = tidy(tidy(out).replace(/\s+(em|no|na|pelo|pela|para|por|via|ao|à|de|do|da)$/i, ''));
  if (cleaned !== tidy(value)) {
    removed.push(`Chamada para acção: contacto tirado do botão ("${value.trim()}")`);
  }
  return cleaned;
}

function scrubInventedTerms(
  value: string,
  brief: string,
  removed: string[],
  fieldLabel: string,
): string {
  let out = value;
  const briefLower = brief.toLowerCase();

  out = out.replace(PERCENT, (match) => {
    if (briefLower.includes(match.replace(/\s/g, '').toLowerCase())) return match;
    if (/\d{1,3}\s?%/.test(briefLower)) return match;
    removed.push(`${fieldLabel}: desconto não indicado (${match})`);
    return ' ';
  });

  for (const pattern of CONDITION_PHRASES) {
    out = out.replace(pattern, (match) => {
      if (briefLower.includes(match.toLowerCase().slice(0, 12))) return match;
      removed.push(`${fieldLabel}: condição não indicada ("${match.trim()}")`);
      return ' ';
    });
  }

  return out;
}

function tidy(value: string): string {
  return value
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^[\s,.;:–-]+|[\s,;:–-]+$/g, '')
    .trim();
}

/** Minúsculas sem acentos: a comparação não deve falhar por causa de um "ç". */
function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/**
 * Nomes das opções apresentadas: só o que o utilizador nomeou.
 *
 * Um nome é aceite quando a palavra que o identifica aparece no pedido, na
 * descrição da empresa ou no nome da empresa. Sem esta verificação, a IA
 * preenchia as cinco peças com produtos plausíveis que a empresa nunca
 * mencionou — e a arte passava a afirmar que ela os vende.
 *
 * A comparação é por prefixo de cinco letras, para "perfume" e "perfumes"
 * contarem como a mesma palavra. O erro que importa evitar é apagar o nome
 * que o próprio utilizador escreveu.
 */
function scrubItems(plan: Plan, request: PlanRequest, removed: string[]): string[] {
  const source = [request.brief ?? '', request.brand.description, request.brand.name].join(' ');
  const tokens = normalizeForMatch(source)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const out: string[] = [];

  for (const raw of plan.items ?? []) {
    const name = tidy(raw);
    if (!name) continue;

    const normalized = normalizeForMatch(name);
    const words = normalized.split(/\s+/).filter((word) => word.length >= 4);

    const confirmed =
      words.length === 0
        ? tokens.some((token) => token.includes(normalized) || normalized.includes(token))
        : words.some((word) => {
            const stem = word.slice(0, 5);
            return tokens.some((token) => token.slice(0, 5) === stem);
          });

    if (!confirmed) {
      removed.push(`Opção: "${name}" não aparece no pedido`);
      continue;
    }

    const duplicate = out.some(
      (existing) => normalizeForMatch(existing) === normalized,
    );
    if (!duplicate) out.push(name);
  }

  return out.slice(0, 6);
}

/**
 * Aplica os guardrails. Nunca lança: devolve sempre um plano utilizável.
 */
export function applyGuardrails(plan: Plan, request: PlanRequest): GuardrailReport {
  const removed: string[] = [];
  const brief = request.brief ?? '';

  const clean = (value: string, label: string): string =>
    tidy(scrubInventedTerms(scrubContacts(value ?? '', request, removed, label), brief, removed, label));

  const headline = clean(plan.headline, 'Título') || plan.headline.trim();
  const subheadline = clean(plan.subheadline, 'Subtítulo');
  const cta = stripContactsFromCta(clean(plan.cta, 'Chamada para acção'), removed);
  const badge = clean(plan.badge, 'Etiqueta');

  // --- Preço: só o que o utilizador escreveu --------------------------------
  const briefPrices = detectPrices(brief);
  let price = '';
  if (plan.price) {
    const planPrices = detectPrices(plan.price);
    const match = planPrices.find((candidate) =>
      briefPrices.some((allowed) => allowed.value === candidate.value),
    );
    if (match) {
      price = formatKz(match.value);
    } else if (briefPrices.length > 0) {
      // Valor diferente do indicado: usa o do utilizador.
      price = formatKz(briefPrices[0].value);
      removed.push(`Preço: valor não confirmado (${plan.price.trim()}) substituído pelo do pedido`);
    } else {
      removed.push(`Preço: valor não indicado no pedido (${plan.price.trim()})`);
    }
  } else if (briefPrices.length > 0) {
    price = formatKz(briefPrices[0].value);
  }

  // --- Campos a preencher ---------------------------------------------------
  const missing = [...plan.missingFields];
  const hasMissing = (field: string) => missing.some((m) => m.field === field);

  if (!price && looksLikePromotion(brief) && !hasMissing('price')) {
    missing.push({
      field: 'price',
      question: 'O pedido fala de uma promoção mas não indica o preço. Qual é o valor em Kz?',
    });
  }

  const wantsWhatsapp = /whats?app/i.test(brief) || /whats?app/i.test(cta);
  const hasWhatsapp = request.brand.contacts.some((c) => c.type === 'whatsapp');
  if (wantsWhatsapp && !hasWhatsapp && !hasMissing('whatsapp')) {
    missing.push({
      field: 'whatsapp',
      question: 'Queres encomendas por WhatsApp mas não há número guardado. Qual é o número?',
    });
  }

  const wantsSite = /\b(site|website|loja online|encomenda online)\b/i.test(brief);
  const hasSite = request.brand.contacts.some((c) => c.type === 'website');
  if (wantsSite && !hasSite && !hasMissing('website')) {
    missing.push({
      field: 'website',
      question: 'O pedido menciona o site, mas não há endereço guardado. Qual é?',
    });
  }

  // --- Opções apresentadas --------------------------------------------------
  const items = scrubItems(plan, request, removed);

  // --- Textos protegidos pelo utilizador ------------------------------------
  const locked = request.lockedTexts ?? {};
  const finalPlan: Plan = {
    ...plan,
    headline: locked.headline ?? headline,
    subheadline: locked.subheadline ?? subheadline,
    cta: locked.cta ?? cta,
    badge: locked.badge ?? badge,
    price: locked.price ?? price,
    items,
    highlightedItemIndex: Math.min(
      Math.max(plan.highlightedItemIndex ?? 0, 0),
      Math.max(0, items.length - 1),
    ),
    mainImageIndex: Math.min(plan.mainImageIndex ?? 0, Math.max(0, request.imageCount - 1)),
    visualDirection: tidy(plan.visualDirection ?? ''),
    backgroundPrompt: tidy(stripForbiddenBackgroundTerms(plan.backgroundPrompt ?? '')),
    missingFields: missing.slice(0, 5),
  };

  return { plan: finalPlan, removed };
}

/**
 * O gerador de imagens só produz FUNDOS. Qualquer instrução para desenhar
 * texto, logótipos ou o produto é removida do prompt, porque esses elementos
 * ficam sempre em camadas controladas pela aplicação.
 */
export function stripForbiddenBackgroundTerms(prompt: string): string {
  return prompt
    .replace(/\b(texto|textos|t[íi]tulo|legenda|palavras?|letras?|tipografia|fonte)\b[^,.;]*/gi, '')
    .replace(/\b(log[óo]tipo|logo|marca d'[áa]gua|watermark)\b[^,.;]*/gi, '')
    .replace(/\b(pre[çc]o|desconto|%)\b[^,.;]*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
