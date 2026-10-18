/**
 * A biblioteca da marca: que artes seguem em cada geração.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * A proposta do cliente era enviar TODAS as artes da empresa em cada pedido,
 * para as publicações comunicarem entre si. O objectivo ficou; o meio não, e
 * por quatro razões medidas ou documentadas:
 *
 *  · o gerador aceita um número fixo de imagens por pedido, e a Kriar já
 *    ocupa até dez com o logótipo, as fotografias e as referências;
 *  · com muitas imagens, o gerador faz a média delas, e a ideia do post
 *    perde força;
 *  · cada imagem a mais é mais uma oportunidade de copiar conteúdo;
 *  · reenviar artes geradas amplifica os defeitos delas, e o feed fica
 *    todo igual.
 *
 * O que leva a biblioteca inteira a todos os pedidos é o PERFIL em texto,
 * reaprendido sempre que a biblioteca muda. Como imagem seguem só duas ou
 * três, escolhidas aqui: pelo formato, pelo tema do pedido e em rotação.
 *
 * Funções puras: correm no browser, que é quem monta o pedido.
 * ──────────────────────────────────────────────────────────────────────────
 */
import type {
  BrandStyleLearning,
  BrandStyleReference,
  FormatId,
} from '@/lib/domain/types';

/** Artes na biblioteca, no máximo. Chega para um ano de publicações exemplares. */
export const LIBRARY_LIMIT = 24;

/** Formatos deitados. Os restantes são de pé ou quadrados. */
const LANDSCAPE: FormatId[] = ['linkedin', 'horizontal'];

/** Palavras que não dizem nada sobre o tema de uma publicação. */
const STOPWORDS = new Set(
  [
    'para', 'como', 'com', 'sem', 'mais', 'menos', 'muito', 'muita', 'esta', 'este', 'isto',
    'essa', 'esse', 'isso', 'aqui', 'onde', 'quando', 'quero', 'queremos', 'fazer', 'faz',
    'uma', 'umas', 'uns', 'dos', 'das', 'nos', 'nas', 'pelo', 'pela', 'pelos', 'pelas',
    'nosso', 'nossa', 'nossos', 'nossas', 'teu', 'tua', 'teus', 'tuas', 'seu', 'sua',
    'arte', 'artes', 'publicacao', 'post', 'imagem', 'anuncio', 'anunciar', 'mostrar',
    'mostra', 'empresa', 'marca', 'cliente', 'clientes', 'todos', 'todas', 'agora', 'hoje',
    'tambem', 'ainda', 'sobre', 'entre', 'depois', 'antes', 'desde', 'cada', 'outra', 'outro',
    'novo', 'nova', 'novos', 'novas', 'melhor', 'melhores', 'grande', 'pequeno', 'texto',
  ].map(fold),
);

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** As palavras de um texto que podem dizer o tema. */
export function topicWords(text: string): string[] {
  const words = fold(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word));
  return [...new Set(words)];
}

/** As artes da biblioteca, mais recentes primeiro. */
export function libraryOf(
  learning: BrandStyleLearning | null | undefined,
): BrandStyleReference[] {
  return [...(learning?.references ?? [])].sort((a, b) =>
    (b.addedAt || '').localeCompare(a.addedAt || ''),
  );
}

/** A versão da arte já está na biblioteca? */
export function libraryEntryFor(
  learning: BrandStyleLearning | null | undefined,
  artworkAssetId: string | null | undefined,
): BrandStyleReference | null {
  if (!artworkAssetId) return null;
  return (
    learning?.references.find((reference) => reference.fromAssetId === artworkAssetId) ?? null
  );
}

/**
 * As artes que seguem como imagem nesta geração.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Pontuação simples e auditável, sem IA:
 *
 *  · mesmo formato +2, mesma orientação +1 — uma referência deitada ensina
 *    pouco a uma publicação de pé;
 *  · palavras do tema em comum com o pedido, até +4,5 — uma campanha de
 *    streaming aprende mais com outra de streaming;
 *  · aprovada na Kriar +0,5 — é a direcção que o cliente aprova agora;
 *  · das que melhor representam o estilo, na leitura do cadastro, +0,75;
 *  · usada na geração anterior da marca −2,5 — a rotação.
 *
 * As da própria publicação ficam de fora: a versão aprovada há pouco, a
 * seguir como referência da "outra" desta mesma publicação, devolvia a
 * mesma arte.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function pickLibraryArts(args: {
  learning: BrandStyleLearning | null | undefined;
  brief: string;
  format: FormatId;
  projectId: string | null;
  recentlyUsed: string[];
  count: number;
}): BrandStyleReference[] {
  const pool = libraryOf(args.learning).filter(
    (reference) => !args.projectId || reference.projectId !== args.projectId,
  );
  if (pool.length <= args.count) return pool;

  const briefWords = new Set(topicWords(args.brief));
  const recent = new Set(args.recentlyUsed);
  const landscape = LANDSCAPE.includes(args.format);

  const scored = pool.map((reference, order) => {
    let score = 0;
    if (reference.format === args.format) score += 2;
    else if (reference.format && LANDSCAPE.includes(reference.format) === landscape) score += 1;

    const words = topicWords(`${reference.topics.join(' ')} ${reference.content}`);
    const shared = words.filter((word) => briefWords.has(word)).length;
    score += Math.min(3, shared) * 1.5;

    if (reference.source === 'aprovada') score += 0.5;
    // Das que a leitura disse representarem melhor o estilo.
    if (reference.featured) score += 0.75;
    if (recent.has(reference.assetId)) score -= 2.5;
    // Empate: a mais recente.
    score -= order * 0.01;
    return { reference, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, args.count)
    .map((entry) => entry.reference);
}

/**
 * As artes que a leitura do perfil vê, no máximo `limit`.
 *
 * As aprovadas mais recentes primeiro — são a direcção actual —, depois as
 * do cadastro, que são o ponto de partida.
 */
export function learningSet(
  references: BrandStyleReference[],
  limit: number,
): BrandStyleReference[] {
  const approved = references
    .filter((reference) => reference.source === 'aprovada')
    .sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
  const original = references.filter((reference) => reference.source !== 'aprovada');
  return [...approved, ...original].slice(0, limit);
}
