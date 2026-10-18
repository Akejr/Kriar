import { APP } from '@/config/app';

export type DetectedPrice = {
  /** Fragmento exacto encontrado no pedido do utilizador. */
  raw: string;
  /** Valor numérico interpretado. */
  value: number;
  /** Posição no texto, para podermos remover o fragmento do título. */
  index: number;
  /** Se a moeda vinha escrita explicitamente. */
  hadCurrency: boolean;
};

/**
 * Formata um valor em Kwanzas no formato usado em Angola:
 * milhares separados por ponto, decimais por vírgula, símbolo à direita.
 * Implementado à mão para dar sempre o mesmo resultado no servidor e no
 * browser (o `Intl` com `pt-AO` varia entre ambientes).
 */
export function formatKz(value: number, options?: { decimals?: boolean }): string {
  const showDecimals = options?.decimals ?? !Number.isInteger(value);
  const fixed = Math.abs(value).toFixed(showDecimals ? 2 : 0);
  const [intPart, decPart] = fixed.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = value < 0 ? '-' : '';
  const number = decPart ? `${grouped},${decPart}` : grouped;
  return `${sign}${number} ${APP.currency.symbol}`;
}

/**
 * Interpreta um número escrito à portuguesa/angolana.
 * `15.000` → 15000 · `15 000` → 15000 · `1.500,50` → 1500.5 · `15000` → 15000
 */
function parseLocalNumber(input: string): number | null {
  const cleaned = input.replace(/\s/g, '');
  const hasComma = cleaned.includes(',');
  const normalized = hasComma
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : // Sem vírgula: pontos são separadores de milhares se formarem grupos de 3.
      /^\d{1,3}(\.\d{3})+$/.test(cleaned)
      ? cleaned.replace(/\./g, '')
      : cleaned.replace(/\.(?=\d{3}\b)/g, '');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const CURRENCY_WORD = '(?:kz|kwanzas?|akz|aoa)';
const NUMBER = '\\d{1,3}(?:[.\\s]\\d{3})+(?:,\\d{1,2})?|\\d+(?:,\\d{1,2})?';

/**
 * Procura preços no pedido do utilizador.
 *
 * Só devolve valores que o utilizador realmente escreveu. A IA nunca inventa
 * preços: se esta função não encontrar nada e o pedido parecer uma promoção,
 * a aplicação pede o preço num campo próprio.
 */
export function detectPrices(text: string): DetectedPrice[] {
  if (!text) return [];
  const found: DetectedPrice[] = [];
  const seen = new Set<number>();

  // 1) Número seguido de moeda: "15.000 Kz"
  const after = new RegExp(`(${NUMBER})\\s*${CURRENCY_WORD}\\b`, 'gi');
  // 2) Moeda seguida de número: "Kz 15 000"
  const before = new RegExp(`${CURRENCY_WORD}\\s*(${NUMBER})`, 'gi');

  for (const regex of [after, before]) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const value = parseLocalNumber(match[1]);
      if (value === null || value <= 0) continue;
      if (seen.has(match.index)) continue;
      seen.add(match.index);
      found.push({ raw: match[0].trim(), value, index: match.index, hadCurrency: true });
    }
  }

  // 3) Sem moeda escrita, mas com a palavra "por"/"preço"/"a" antes:
  //    "por 15.000", "preço 7500". Mais conservador: exige >= 100.
  if (found.length === 0) {
    const loose = new RegExp(`\\b(?:por|pre[çc]o(?:\\s+de)?|a)\\s+(${NUMBER})\\b`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = loose.exec(text)) !== null) {
      const value = parseLocalNumber(match[1]);
      if (value === null || value < 100) continue;
      found.push({ raw: match[1].trim(), value, index: match.index, hadCurrency: false });
    }
  }

  return found.sort((a, b) => a.index - b.index);
}

/** Palavras que sugerem uma promoção, para pedirmos o preço se faltar. */
const PROMO_HINTS = [
  'promo',
  'promoção',
  'promocao',
  'desconto',
  'saldo',
  'saldos',
  'campanha',
  'oferta',
  'baixa de preço',
  'barato',
];

export function looksLikePromotion(text: string): boolean {
  const lower = text.toLowerCase();
  return PROMO_HINTS.some((hint) => lower.includes(hint));
}

/** Remove o fragmento do preço de um texto, deixando-o limpo para o título. */
export function stripPriceFragments(text: string, prices: DetectedPrice[]): string {
  let out = text;
  for (const price of prices) {
    out = out.split(price.raw).join(' ');
  }
  return out
    .replace(/\b(por|a|pre[çc]o(?:\s+de)?)\s+(?=[,.;]|$)/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
