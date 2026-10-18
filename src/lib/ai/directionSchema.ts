import { z } from 'zod';
import { STYLES } from '@/lib/domain/catalog';
import { isLayoutId } from '@/lib/composition/layouts';
import type { LayoutId, ProtagonistKind, VisualApproach } from '@/lib/domain/direction';
import type { ReferenceDensity, VisualTechnique } from '@/lib/domain/references';
import type { StyleId } from '@/lib/domain/types';

/**
 * Resposta do modelo que interpreta o pedido e propõe conceitos.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Combina as etapas A e B da especificação numa chamada: briefing
 * estruturado e um pequeno conjunto de direcções candidatas, com a escolha
 * justificada.
 *
 * A validação é TOLERANTE, e mais do que era. Aparar e descartar; nunca
 * rejeitar a resposta inteira por um detalhe.
 *
 * A lição foi cara. Com o modelo criativo (GPT-5.4), as três direcções
 * vinham com técnicas inventadas — "mockup-fotografico-de-dispositivo" —, e
 * uma técnica fora da lista invalidava o conceito inteiro. Sem conceitos
 * válidos, a rota caía em silêncio no modelo barato, e foi uma ideia do
 * modelo barato — "fundo azul escuro com texto em amarelo" — que deu o
 * cartaz de texto. Um modelo melhor estava a ser deitado fora por um
 * pormenor de formato.
 *
 * Por isso: técnicas desconhecidas são descartadas, abordagens desconhecidas
 * caem na mais segura, textos longos são aparados no fim de uma palavra e
 * listas compridas são cortadas. Só falta o mínimo indispensável — uma ideia
 * e uma cena — é que um conceito é descartado.
 * ──────────────────────────────────────────────────────────────────────────
 */

const CONCRETE_STYLE_IDS = STYLES.filter((style) => style.id !== 'auto').map(
  (style) => style.id,
) as [StyleId, ...StyleId[]];

export const APPROACHES: VisualApproach[] = [
  'produto-em-contexto',
  'fotografia-simples',
  'tipografica',
  'editorial',
  'cena-conceptual',
  'varios-produtos',
];

/** As técnicas que a biblioteca de referências conhece. Mostradas no prompt. */
export const TECHNIQUES: VisualTechnique[] = [
  'integracao-pessoa-elemento',
  'profundidade-por-sobreposicao',
  'materiais-transparentes',
  'metafora-visual',
  'ponto-de-atencao-unico',
  'espaco-livre-para-texto',
  'organizacao-modular',
  'agrupamento-por-categoria',
  'hierarquia-tipografica-forte',
  'recurso-de-destaque',
  'equilibrio-entre-entidades',
  'movimento-implicito',
  'iluminacao-dramatica',
  'iluminacao-controlada',
  'contraste-alto',
  'presenca-humana',
  'produto-em-contexto',
  'escala-tipografica-dominante',
];

const DENSITIES: ReferenceDensity[] = ['baixa', 'media', 'alta'];

export const SUBJECTS: ProtagonistKind[] = ['pessoa', 'produto', 'dispositivo', 'cena', 'tipografia'];

/** Corta no fim de uma palavra, nunca a meio de uma. */
function clip(value: string, max: number): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const word = cut.lastIndexOf(' ');
  return (word > max * 0.6 ? cut.slice(0, word) : cut).trim();
}

/** Texto obrigatório com um mínimo; acima do máximo é aparado. */
const required = (min: number, max: number) =>
  z
    .string()
    .transform((value) => clip(value, max))
    .pipe(z.string().min(min));

/** Texto opcional, aparado. */
const optional = (max: number) =>
  z
    .string()
    .catch('')
    .default('')
    .transform((value) => clip(value, max));

/** Lista de textos: entradas inválidas descartadas, o excesso cortado. */
const textList = (maxItems: number, maxLength: number) =>
  z
    .array(z.unknown())
    .catch([])
    .default([])
    .transform((items) =>
      items
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => clip(item, maxLength))
        .slice(0, maxItems),
    );

/**
 * Descarta entradas inválidas em vez de rejeitar a lista.
 *
 * Mesma função que `tolerantList` na identidade, e pela mesma lição: um
 * campo mal preenchido num conceito não justifica perder os outros dois.
 */
function tolerantList<T extends z.ZodTypeAny>(item: T, min: number, max: number) {
  return z.array(z.unknown()).transform((entries, ctx) => {
    const valid = entries
      .map((entry) => item.safeParse(entry))
      .filter((result) => result.success)
      .map((result) => (result as { data: z.infer<T> }).data)
      .slice(0, max);

    if (valid.length < min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Precisamos de pelo menos ${min} entrada(s) válida(s).`,
      });
      return z.NEVER;
    }
    return valid;
  });
}

/*
  Os máximos ficam abaixo dos do pedido de geração (`artworkRequestSchema`),
  de propósito: uma direcção aceite aqui nunca pode ser recusada lá.
*/
const conceptSchema = z.object({
  /** A ideia central, em linguagem que o cliente entende. */
  idea: required(10, 300),
  // Uma abordagem desconhecida cai na mais comum, em vez de derrubar o
  // conceito.
  approach: z
    .string()
    .catch('produto-em-contexto')
    .transform((value): VisualApproach =>
      APPROACHES.includes(value as VisualApproach)
        ? (value as VisualApproach)
        : 'produto-em-contexto',
    ),
  scene: required(20, 650),
  focus: required(3, 180),
  hierarchy: required(5, 280),
  composition: required(10, 450),
  lighting: required(5, 280),
  materials: required(3, 280),
  brandApplication: required(5, 280),
  /** Porque esta direcção comunica a mensagem. Mostrado ao cliente. */
  rationale: required(10, 300),
  /**
   * Os recursos de design da peça (ver `CreativeDirection.graphics`).
   *
   * Opcional na validação: um modelo que se esqueça dele não derruba o
   * conceito — o prompt da imagem tem um design por omissão.
   */
  graphics: optional(400),
  /**
   * Técnicas que esta direcção quer ver demonstradas.
   *
   * É por aqui que a recuperação de referências filtra. As desconhecidas
   * são descartadas: uma técnica inventada não aponta para referência
   * nenhuma, mas também não torna o conceito inválido.
   */
  techniquesWanted: z
    .array(z.unknown())
    .catch([])
    .default([])
    .transform((items) =>
      items
        .filter((item): item is VisualTechnique =>
          TECHNIQUES.includes(item as VisualTechnique),
        )
        .slice(0, 5),
    ),
  textDensity: z
    .string()
    .catch('baixa')
    .default('baixa')
    .transform((value): ReferenceDensity =>
      DENSITIES.includes(value as ReferenceDensity) ? (value as ReferenceDensity) : 'baixa',
    ),
  elementDensity: z
    .string()
    .catch('media')
    .default('media')
    .transform((value): ReferenceDensity =>
      DENSITIES.includes(value as ReferenceDensity) ? (value as ReferenceDensity) : 'media',
    ),
  /**
   * A grelha. Uma desconhecida fica vazia, e a rota escolhe a da abordagem
   * (`defaultLayoutFor`) — nunca derruba o conceito.
   */
  layout: z
    .string()
    .catch('')
    .default('')
    .transform((value): LayoutId | null => (isLayoutId(value) ? value : null)),
  subject: z
    .string()
    .catch('cena')
    .default('cena')
    .transform((value): ProtagonistKind =>
      SUBJECTS.includes(value as ProtagonistKind) ? (value as ProtagonistKind) : 'cena',
    ),
});

export const directionResponseSchema = z.object({
  brief: z
    .object({
      objective: optional(300),
      message: optional(300),
      mandatory: textList(8, 160),
      mainSubject: optional(160),
      supporting: textList(8, 80),
      callToAction: optional(120),
      confirmedFacts: textList(10, 160),
      audience: optional(160),
      constraints: textList(8, 160),
    })
    .catch({
      objective: '',
      message: '',
      mandatory: [],
      mainSubject: '',
      supporting: [],
      callToAction: '',
      confirmedFacts: [],
      audience: '',
      constraints: [],
    }),

  /** Até três direcções que diferem na IDEIA ou na composição. */
  concepts: tolerantList(conceptSchema, 1, 3),

  /** Índice, em `concepts`, da direcção escolhida. A rota limita-o. */
  chosen: z.coerce.number().int().min(0).max(2).catch(0).default(0),

  /**
   * Estilo decidido quando o cliente pediu `auto`.
   *
   * Nunca pode ser `auto`: se o cliente delegou a escolha, a resposta tem de
   * ser uma escolha. Um valor fora da lista conta como não decidido.
   */
  style: z.enum(CONCRETE_STYLE_IDS).optional().catch(undefined),

  texts: z
    .object({
      headline: optional(90),
      subheadline: optional(220),
      cta: optional(60),
      badge: optional(34),
      price: optional(28),
    })
    .catch({ headline: '', subheadline: '', cta: '', badge: '', price: '' }),

  items: textList(6, 28),
  highlightedItemIndex: z.coerce.number().int().min(0).catch(0).default(0),
  mainImageIndex: z.coerce.number().int().min(0).catch(0).default(0),

  missingFields: z
    .array(z.unknown())
    .catch([])
    .default([])
    .transform((items) =>
      items
        .map((item) =>
          z
            .object({ field: required(1, 40), question: required(1, 160) })
            .safeParse(item),
        )
        .filter((result) => result.success)
        .map((result) => (result as { data: { field: string; question: string } }).data)
        .slice(0, 5),
    ),
});

export type DirectionResponse = z.infer<typeof directionResponseSchema>;
export type ProposedConcept = z.infer<typeof conceptSchema>;
