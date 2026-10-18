import type { CreativeDirection, LayoutId, ProtagonistKind } from '@/lib/domain/direction';
import type {
  ReferenceDensity,
  ReferenceUsage,
  VisualReference,
  VisualTechnique,
} from '@/lib/domain/references';
import type { StyleId } from '@/lib/domain/types';
import { approvedReferences, completeUsage, getReference } from './catalog';

/**
 * Recuperação de referências.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Determinística e no servidor. A IA não vasculha a biblioteca: recebe uma
 * lista curta de candidatas e escolhe entre elas, o que mantém a decisão
 * auditável e barata.
 *
 * Duas regras que vêm de defeitos conhecidos:
 *
 *  · se nenhuma referência servir, devolve lista VAZIA. Forçar a referência
 *    menos má é como se chegava a um jogo do galo numa publicação de
 *    perfumaria. Sem referência, a identidade e os princípios de design
 *    bastam;
 *  · `auto` nunca escolhe o estilo com mais imagens cadastradas. As nove
 *    iniciais são quase todas tecnológicas; deixar a contagem decidir fazia
 *    de "automático" um sinónimo de "tecnológico".
 * ──────────────────────────────────────────────────────────────────────────
 */

export type ReferenceQuery = {
  /** Estilo pedido. `auto` não filtra por estilo. */
  style: StyleId;
  /** A grelha da ideia aprovada. */
  layout?: LayoutId;
  /** O que a imagem protagonista mostra. */
  subject?: ProtagonistKind;
  /** Técnicas úteis à direcção criativa proposta. */
  techniques?: VisualTechnique[];
  /** Densidade desejada para a arte. */
  textDensity?: ReferenceDensity;
  elementDensity?: ReferenceDensity;
  /** Quantos produtos a arte vai mostrar. */
  itemCount?: number;
  /** Referências usadas em publicações recentes desta marca. */
  recentlyUsed?: string[];
  /** Máximo devolvido. Três é o limite útil. */
  limit?: number;
};

const DENSITY_ORDER: Record<ReferenceDensity, number> = { baixa: 0, media: 1, alta: 2 };

/**
 * A pontuação de uma referência para um pedido (maior é melhor), e o porquê
 * dela, em palavras.
 *
 * O porquê fica gravado na publicação (`ReferenceUsage.why`): é o que permite
 * responder, sem adivinhar, "porque é que esta arte seguiu aquela
 * referência?" — a mesma grelha, o mesmo protagonista, as técnicas que a
 * ideia pediu.
 */
function scoreWithReasons(
  reference: VisualReference,
  query: ReferenceQuery,
): { points: number; reasons: string[] } {
  const reasons: string[] = [];
  let points = 0;

  /*
    Estilo: pesa o mesmo que UMA técnica, não o dobro.

    Com +6, o estilo decidia sozinho. Um pedido de pagamentos da Netflix com
    estilo "vibrante" recebia como exemplos o Dia da Mulher e um puzzle de
    bandeiras — as duas referências marcadas "vibrante" —, e o telemóvel com
    catálogo, que demonstra exactamente o que a ideia pedia, ficava de fora.
    Agora ganha a referência que mostra as técnicas que a direcção quer.
  */
  if (query.style !== 'auto' && reference.styles.includes(query.style)) {
    points += 3;
    reasons.push(`estilo ${query.style}`);
  }

  const shared = (query.techniques ?? []).filter((technique) =>
    reference.techniques.includes(technique),
  );
  points += shared.length * 3;
  if (shared.length > 0) {
    reasons.push(`técnicas da ideia: ${shared.map((technique) => technique.replace(/-/g, ' ')).join(', ')}`);
  }

  /*
    PARECENÇA com a ideia: a mesma grelha, o mesmo tipo de protagonista.

    A escolha só olhava para as técnicas e o estilo, e uma ideia de pessoa à
    direita com texto à esquerda recebia como exemplo três dispositivos
    centrados. Agora uma referência com a mesma disposição e o mesmo tipo de
    imagem ganha — é a que mostra ao gerador como fica, em acabamento de
    agência, a arte que o cliente aprovou no esboço.
  */
  if (query.layout && reference.layouts.includes(query.layout)) {
    points += 4;
    reasons.push(`mesma grelha (${query.layout})`);
  }
  if (query.subject && reference.subjects.includes(query.subject)) {
    points += 3;
    reasons.push(`mesmo protagonista (${query.subject})`);
  }

  if (query.textDensity) {
    const distance = Math.abs(
      DENSITY_ORDER[reference.textDensity] - DENSITY_ORDER[query.textDensity],
    );
    points += 2 - distance;
  }

  if (query.elementDensity) {
    const distance = Math.abs(
      DENSITY_ORDER[reference.elementDensity] - DENSITY_ORDER[query.elementDensity],
    );
    points += 2 - distance;
  }

  // Uma referência modular ajuda quando há muitos produtos; atrapalha quando
  // há um só.
  if (typeof query.itemCount === 'number') {
    const modular =
      reference.techniques.includes('organizacao-modular') ||
      reference.techniques.includes('agrupamento-por-categoria');
    if (query.itemCount >= 3 && modular) points += 2;
    if (query.itemCount <= 1 && modular) points -= 2;
  }

  /*
    Penalização por uso recente.

    Não é variedade por variedade: é o que evita que a mesma referência
    oriente todas as publicações de uma marca e as faça parecer a mesma arte
    com textos trocados.
  */
  if (query.recentlyUsed?.includes(reference.id)) {
    points -= 4;
    reasons.push('usada há pouco nesta marca (penalizada)');
  }

  // Entre duas candidatas equivalentes, a que se pode enviar como imagem
  // transmite melhor o acabamento.
  if (reference.directUse === 'segura') points += 1;
  if (reference.directUse === 'nunca') points -= 1;

  return { points, reasons };
}

/**
 * Pontuação mínima para uma referência ser considerada útil.
 *
 * Existe para a lista poder sair vazia. Sem este limiar, a ordenação devolvia
 * sempre as três primeiras — mesmo quando nenhuma tinha relação com o pedido.
 */
const MIN_SCORE = 3;

export function retrieveReferences(query: ReferenceQuery): VisualReference[] {
  return rankReferences(query).map((entry) => entry.reference);
}

/** As escolhidas, com a pontuação e o porquê de cada uma. */
function rankReferences(
  query: ReferenceQuery,
): Array<{ reference: VisualReference; points: number; reasons: string[] }> {
  const limit = query.limit ?? 3;

  const ranked = approvedReferences()
    .map((reference) => ({ reference, ...scoreWithReasons(reference, query) }))
    .filter((entry) => entry.points >= MIN_SCORE)
    .sort((a, b) => b.points - a.points);

  /*
    Evitar candidatas quase iguais no mesmo pedido.

    Três referências que demonstram a mesma técnica não dão três sinais —
    dão o mesmo sinal três vezes mais alto, e o resultado converge para a
    cena delas.
  */
  const picked: typeof ranked = [];
  const seenTechniques = new Set<VisualTechnique>();

  for (const entry of ranked) {
    if (picked.length >= limit) break;

    const fresh = entry.reference.techniques.filter(
      (technique) => !seenTechniques.has(technique),
    );
    // A primeira entra sempre; as seguintes só se trouxerem algo novo.
    if (picked.length > 0 && fresh.length === 0) continue;

    picked.push(
      picked.length > 0
        ? { ...entry, reasons: [...entry.reasons, 'complementa as anteriores com outras técnicas'] }
        : entry,
    );
    for (const technique of entry.reference.techniques) seenTechniques.add(technique);
  }

  return picked;
}

/**
 * As referências de UMA direcção, com o plano de aproveitamento completo.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Corria uma vez, no servidor, para a ideia escolhida. "Outra ideia" trocava
 * a ideia e ficava com as referências da anterior — uma ideia de pessoa à
 * direita a ser gerada com o exemplo de três dispositivos. Agora corre
 * sempre que a ideia ou a grelha mudam, no browser, que é onde isso
 * acontece, e o servidor recebe o resultado como sempre.
 *
 * Determinística e sem IA: a mesma ideia dá as mesmas referências, e o
 * porquê de cada uma lê-se na pontuação.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function referenceUsageFor(args: {
  direction: CreativeDirection;
  style: StyleId;
  itemCount: number;
  recentlyUsed?: string[];
}): ReferenceUsage[] {
  const { direction } = args;
  const found = rankReferences({
    style: args.style,
    layout: direction.layout,
    subject: direction.subject,
    techniques: direction.techniques ?? [],
    textDensity: direction.textDensity,
    elementDensity: direction.elementDensity,
    itemCount: args.itemCount,
    recentlyUsed: args.recentlyUsed,
    limit: 3,
  });
  return completeUsage(
    found.map(({ reference, points, reasons }) => ({
      referenceId: reference.id,
      take: reference.strengths.slice(0, 4),
      doNotTransfer: [],
      // Quem decide se a imagem viaja é o cadastro (`completeUsage`).
      mode: 'imagem',
      why: `${points} pontos — ${reasons.length > 0 ? reasons.join('; ') : 'densidade de texto e de elementos parecida'}`,
    })),
  );
}

/** O nome de uma referência, para o cliente ler. Nunca o identificador. */
export function referenceName(referenceId: string): string {
  return getReference(referenceId)?.name ?? 'Referência';
}

/**
 * Resumo de uma referência para o prompt de selecção.
 *
 * Deliberadamente sem o campo `content`: descrever "mão a colocar uma peça
 * num tabuleiro" ao modelo que vai propor conceitos é oferecer-lhe a cena.
 * O que ele precisa de saber é o que a referência DEMONSTRA.
 */
export function describeForSelection(reference: VisualReference): string {
  return [
    `- ${reference.id} — ${reference.name}`,
    `  Demonstra: ${reference.strengths.join('; ')}`,
    `  Técnicas: ${reference.techniques.join(', ')}`,
    `  Densidade: texto ${reference.textDensity}, elementos ${reference.elementDensity}`,
    `  Ajuda quando: ${reference.helpfulWhen.join('; ')}`,
    `  Limitações: ${reference.limitations.join(' ')}`,
  ].join('\n');
}
