import { z } from 'zod';
import { FONT_IDS } from '@/lib/fontCatalog';
import { normalizeHex } from '@/lib/utils/color';
import { clippedText } from './schema';

/**
 * Esquema da proposta de identidade.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Validado SEMPRE no servidor. Um modelo que invente um identificador de
 * fonte, um papel de cor inexistente ou um hexadecimal malformado faz o
 * plano cair para a proposta determinística — não chega ao browser.
 *
 * As fontes são validadas contra o catálogo real (`FONT_IDS`). É o que
 * impede a interface de prometer uma tipografia que não consegue carregar.
 * ──────────────────────────────────────────────────────────────────────────
 */

/**
 * Cor TOLERANTE.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Aceita `#RRGGBB`, `#RGB`, `RRGGBB` e `#RRGGBBAA`, e normaliza. Antes era
 * uma expressão regular estrita, e uma proposta inteira — paleta, escala
 * tipográfica, briefings — era rejeitada porque um valor vinha com oito
 * dígitos ou sem cerquilha.
 *
 * Rigor na forma não é robustez. O que importa validar é que a cor EXISTE e
 * é legível; o formato em que o modelo a escreveu é problema nosso.
 * ──────────────────────────────────────────────────────────────────────────
 */
const hex = z
  .string()
  .trim()
  .transform((value, ctx) => {
    // `#RRGGBBAA`: o canal alfa não nos serve, as cores da marca são opacas.
    const withoutAlpha = value.replace(/^(#?[0-9a-fA-F]{6})[0-9a-fA-F]{2}$/, '$1');
    const normalized = normalizeHex(withoutAlpha);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'cor inválida' });
      return z.NEVER;
    }
    return normalized;
  });

/** Lista de cores que descarta as inválidas em vez de falhar. */
const hexList = z
  .array(z.string())
  .transform((values) =>
    values.map((value) => normalizeHex(value)).filter((value): value is string => Boolean(value)),
  );

/**
 * Lista que valida cada entrada por si e descarta as que não passam.
 *
 * Falha apenas quando sobram menos de `min` entradas — ou seja, quando
 * realmente não há material com que trabalhar.
 */
function tolerantList<T extends z.ZodTypeAny>(entry: T, min: number, max: number) {
  return z
    .array(z.unknown())
    .transform((values) =>
      values
        .map((value) => entry.safeParse(value))
        .filter(
          (result): result is { success: true; data: z.infer<T> } => result.success,
        )
        .map((result) => result.data)
        .slice(0, max),
    )
    .refine((list) => list.length >= min, {
      message: `são precisas pelo menos ${min} entradas utilizáveis`,
    });
}

/** Peso mais próximo dos que o catálogo de fontes garante. */
function nearestWeight(value: number): 400 | 500 | 600 | 700 {
  const allowed = [400, 500, 600, 700] as const;
  return allowed.reduce((best, candidate) =>
    Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best,
  );
}

const fontId = z.enum(FONT_IDS as [string, ...string[]]);

const source = z.enum(['cliente', 'manual', 'ia']);

const logoPlacement = z.enum([
  'superior-esquerdo',
  'superior-centro',
  'superior-direito',
  'inferior-esquerdo',
  'inferior-centro',
  'inferior-direito',
]);

export const identityProposalSchema = z.object({
  /** Sugestão de assinatura. String vazia quando não há. */
  tagline: z.string().max(70).optional().default(''),

  /*
    ──────────────────────────────────────────────────────────────────────────
    Listas RESILIENTES: uma entrada má é descartada, não derruba a lista.

    Com validação entrada-a-entrada rígida, um único papel de cor escrito
    fora da lista fazia cair a proposta inteira — paleta, tipografia,
    briefings — e o cliente via "derivada por regras locais" sem saber
    porquê. O que precisamos de garantir é que SOBRA material utilizável, e
    o `completeSystem` da rota preenche o que faltar.
    ──────────────────────────────────────────────────────────────────────────
  */
  colors: tolerantList(
    z.object({
      role: z.enum([
        'primary',
        'secondary',
        'accent',
        'bgLight',
        'bgDark',
        'textOnLight',
        'textOnDark',
        'neutral',
      ]),
      hex,
      label: z.string().max(40).default(''),
      usage: z.string().max(120).default(''),
    }),
    // Uma cor basta: tendo a principal, o resto deriva-se com contraste
    // garantido.
    1,
    12,
  ),

  typography: z.object({
    display: fontId,
    body: fontId,
    rationale: z.string().max(200).optional().default(''),
  }),

  /**
   * Degraus tipográficos.
   *
   * Um par de fontes não é um sistema. São estes degraus que dizem que
   * tamanho tem um título e que peso tem um rótulo — e é o que a interface
   * mostra como especímenes reais.
   */
  typeScale: tolerantList(
    z.object({
      id: z.string().min(1).max(24),
      label: z.string().max(40).default(''),
      font: z.enum(['display', 'body']),
      /** Em píxeis, à escala de uma publicação de 1080 px de largura. */
      sizePx: z.coerce.number().int().min(10).max(200),
      // Pesos fora do catálogo são arredondados para o mais próximo, em vez
      // de invalidarem o degrau.
      weight: z.coerce.number().transform(nearestWeight),
      lineHeight: z.coerce.number().min(0.8).max(2.4),
      tracking: z.coerce.number().min(-0.1).max(0.4).default(0),
      uppercase: z.coerce.boolean().default(false),
      usage: z.string().max(120).default(''),
    }),
    3,
    6,
  ),

  /**
   * Instruções para os visuais gerados — um prompt por imagem.
   *
   * O modelo de texto escreve-os porque é ele que conhece a empresa. Cada um
   * vai depois para uma geração de imagem separada, com o logótipo anexado.
   */
  visualPrompts: z.object({
    /**
     * Folha de identidade: o material da empresa fotografado com o logótipo
     * aplicado.
     *
     * O limite subiu de 600 para 1100 caracteres quando passou a ser a ÚNICA
     * imagem gerada. Um briefing de fotografia que escolhe o material, a
     * superfície, a luz e o enquadramento não cabe em 600 — e era isso que
     * fazia sair material genérico de banco de imagens.
     */
    identidade: z.string().min(80).max(1100),
  }),

  logoRules: z.object({
    minWidthPx: z.number().int().min(24).max(400),
    clearSpaceRatio: z.number().min(0.05).max(1),
    worksOnLight: z.boolean(),
    worksOnDark: z.boolean(),
    needsBackdropOn: z.enum(['nenhum', 'claro', 'escuro', 'ambos']),
    preferredPlacements: z.array(logoPlacement).min(1).max(3),
  }),

  backgrounds: z
    .array(
      z.object({
        id: z.enum(['claro', 'escuro', 'textura', 'fotografia']),
        label: z.string().min(1).max(40),
        description: z.string().min(1).max(200),
        hexes: hexList,
      }),
    )
    // Um fundo basta: `completeSystem` acrescenta os que faltem.
    .min(1)
    .max(4),

  graphics: z.object({
    cornerRadius: z.enum(['recto', 'suave', 'redondo']),
    shadow: z.enum(['nenhuma', 'discreta', 'marcada']),
    lineWeight: z.enum(['fina', 'media', 'forte']),
    decoration: z.enum(['minima', 'moderada', 'rica']),
    notes: z.string().max(220).optional().default(''),
  }),

  composition: z.object({
    logoPlacement,
    hierarchy: z.string().max(220),
    margins: z.string().max(160),
    contacts: z.string().max(160),
    price: z.string().max(160),
  }),

  direction: z.object({
    lighting: z.string().max(180),
    framing: z.string().max(180),
    photoTreatment: z.string().max(180),
    decorationLevel: z.string().max(180),
    tone: z.string().max(180),
    avoid: z.array(z.string().max(80)).max(6).optional().default([]),
  }),

  fixedRules: z.array(z.string().max(160)).max(8).optional().default([]),

  /**
   * Leitura do logótipo pelo modelo. Só informativa, mostrada ao cliente
   * para ele poder discordar.
   */
  /**
   * Leitura do logótipo. Informativa — é mostrada ao cliente para ele poder
   * discordar, e por isso nunca derruba a proposta.
   */
  logoReading: z
    .object({
      description: z.string().max(400).optional().default(''),
      colors: hexList.optional().default([]),
      unreadable: z.boolean().optional().default(false),
    })
    .partial()
    .optional()
    .transform((value) => ({
      description: value?.description ?? '',
      colors: value?.colors ?? [],
      unreadable: value?.unreadable ?? false,
    })),
});

export type IdentityProposal = z.infer<typeof identityProposalSchema>;

// --- Pedido ao servidor -----------------------------------------------------

export const identityRequestSchema = z.object({
  company: z.object({
    name: z.string().min(1).max(120),
    segment: z.enum(['restaurantes', 'beleza', 'lojas', 'servicos', 'outro']),
    description: z.string().max(600).default(''),
  }),
  /** Cores que o cliente já definiu. Vazio quando ainda não definiu nenhuma. */
  colors: z
    .object({
      primary: z.string().max(9).optional(),
      secondary: z.string().max(9).optional(),
      accent: z.string().max(9).nullable().optional(),
    })
    .default({}),
  /** Cores extraídas do logótipo no browser, marcadas como inferidas. */
  extractedColors: z.array(z.string().max(9)).max(6).default([]),
  /** Logótipo em data URL, para o modelo analisar. */
  logoDataUrl: z.string().max(4_000_000).optional(),
  /** Tom medido nos píxeis do logótipo. Decide o par claro/escuro. */
  logoTone: z.enum(['escuro', 'claro']).nullable().default(null),
  /** `false` quando o logótipo é monocromático. */
  logoChromatic: z.boolean().default(true),
  /** Pistas vindas do manual de marca. */
  manualHints: z
    .array(
      z.object({
        kind: z.enum(['cor', 'fonte', 'nota']),
        value: z.string().max(120),
        source: z.enum(['explicito', 'inferido']),
        origin: z.string().max(120),
      }),
    )
    .max(40)
    .default([]),
  visualPreference: z
    .enum(['minimalista', 'elegante', 'moderno', 'institucional', 'vibrante'])
    .nullable()
    .default(null),
  constraints: z.string().max(400).default(''),
  /**
   * O estilo aprendido com as artes que a empresa já publica, em palavras.
   *
   * Vem do passo anterior do cadastro. Vazio quando o cliente o saltou.
   */
  learnedStyle: clippedText(1500),
  /**
   * Secções que o cliente editou à mão e que não devem ser propostas de
   * novo. O servidor pede ao modelo para as deixar em paz, e a aplicação
   * descarta o que venha para elas.
   */
  lockedSections: z
    .array(
      z.enum([
        'apresentacao',
        'paleta',
        'tipografia',
        'logotipo',
        'fundos',
        'composicao',
        'direccao',
        'exemplos',
      ]),
    )
    .max(8)
    .default([]),
});

export type IdentityRequest = z.infer<typeof identityRequestSchema>;

export { source as decisionSourceSchema };
