import { z } from 'zod';
import { FORMATS, STYLES } from '@/lib/domain/catalog';
import type { FormatId, StyleId } from '@/lib/domain/types';

/**
 * Formatos aceites nas rotas, derivados do catálogo.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Derivado, nunca escrito à mão.
 *
 * As listas de formatos estavam repetidas em quatro esquemas Zod. Quando
 * entraram o LinkedIn, os Reels e o horizontal, os mapas `Record<FormatId,
 * …>` deram erro de compilação e foram corrigidos — mas estes `z.enum`
 * continuaram a aceitar só três valores, e as rotas respondiam 400 a um
 * formato que a interface oferecia. Um defeito invisível ao compilador.
 *
 * `satisfies` garante que a lista do catálogo é exactamente a união do tipo:
 * acrescentar um formato sem o declarar no catálogo volta a dar erro de
 * compilação, que é onde este problema se deve fazer sentir.
 * ──────────────────────────────────────────────────────────────────────────
 */
const FORMAT_IDS = FORMATS.map((format) => format.id) as [FormatId, ...FormatId[]];

export const formatEnum = z.enum(FORMAT_IDS);

/** Estilos aceites nas rotas, derivados do catálogo. Mesma razão. */
const STYLE_IDS = STYLES.map((style) => style.id) as [StyleId, ...StyleId[]];

export const styleEnum = z.enum(STYLE_IDS);

/**
 * Texto livre APARADO, nunca rejeitado.
 *
 * Para campos que vêm de leituras guardadas — o estilo aprendido, por
 * exemplo. Com `max()`, um perfil gravado com uma frase a mais fazia a
 * geração responder 400, e o cliente ficava sem arte por causa de um
 * adjectivo.
 */
export const clippedText = (max: number) =>
  z
    .string()
    .default('')
    .transform((value) => {
      const flat = value.replace(/\s+/g, ' ').trim();
      if (flat.length <= max) return flat;
      const cut = flat.slice(0, max);
      const word = cut.lastIndexOf(' ');
      return (word > 0 ? cut.slice(0, word) : cut).trim();
    });

/**
 * Esquema do plano de publicação.
 *
 * Validado SEMPRE no servidor, mesmo quando a resposta vem de um fornecedor
 * de IA. Se a resposta não passar, a aplicação não a usa: cai para o
 * planeador determinístico e diz-o na interface.
 */
export const planSchema = z.object({
  headline: z.string().min(1).max(90),
  subheadline: z.string().max(220).optional().default(''),
  cta: z.string().max(60).optional().default(''),
  badge: z.string().max(34).optional().default(''),
  /**
   * Só pode conter um preço que o utilizador tenha escrito no pedido.
   * O guardrail no servidor remove qualquer outro valor.
   */
  price: z.string().max(28).optional().default(''),
  templateId: z.string().min(1),
  /**
   * Nomes curtos das opções apresentadas na arte.
   *
   * Só podem sair do pedido do utilizador ou do perfil da empresa. O
   * guardrail no servidor remove qualquer nome inventado.
   */
  items: z.array(z.string().min(1).max(28)).max(6).optional().default([]),
  /** Índice, em `items`, da opção que fica em destaque. */
  highlightedItemIndex: z.number().int().min(0).max(5).optional().default(0),
  /** Índice, dentro das imagens enviadas, da fotografia principal. */
  mainImageIndex: z.number().int().min(0).max(20).optional().default(0),
  /** Descrição do acabamento visual. Não entra na arte. */
  visualDirection: z.string().max(320).optional().default(''),
  /** Prompt para o fundo. Só descreve fundo: sem texto, logótipo ou produto. */
  backgroundPrompt: z.string().max(320).optional().default(''),
  /** Informação essencial que falta e que a aplicação deve pedir. */
  missingFields: z
    .array(
      z.object({
        field: z.string().min(1).max(40),
        question: z.string().min(1).max(160),
      }),
    )
    .max(5)
    .optional()
    .default([]),
});

export type Plan = z.infer<typeof planSchema>;

// O `templateId` não é validado aqui contra o catálogo de propósito: a rota
// `/api/ai/plan` substitui um identificador desconhecido por uma escolha
// determinística válida, em vez de rejeitar o plano todo e perder o resto do
// conteúdo. Ver `normalizeTemplateChoice`.

// --- Pedido ao servidor -----------------------------------------------------

export const planRequestSchema = z.object({
  brief: z.string().max(1200).default(''),
  format: formatEnum,
  style: styleEnum,
  imageCount: z.number().int().min(0).max(20).default(0),
  /** Opções já definidas na composição. */
  itemCount: z.number().int().min(0).max(10).default(0),
  /** Tentativa. Incrementa em "Outra ideia". */
  attempt: z.number().int().min(0).max(50).default(0),
  /**
   * Ideia actual, quando o cliente pediu outra.
   *
   * Substituiu `currentTemplateId` e `keepTemplate`. Aqueles diziam qual
   * MODELO manter ou evitar; este diz qual IDEIA já foi vista, que é a
   * pergunta certa agora que a composição é criada e não escolhida.
   */
  currentIdea: z.string().max(300).optional(),
  /**
   * "Melhorar a ideia": o que o cliente quer diferente na ideia actual.
   *
   * Com isto, `currentIdea` deixa de ser a ideia a EVITAR e passa a ser a
   * ideia a MELHORAR — a mesma, com o pedido aplicado.
   */
  refinement: clippedText(600),
  /**
   * Os textos actuais, na melhoria: a ideia melhorada mantém-nos, salvo se
   * o pedido falar deles.
   */
  currentTexts: z.record(z.string(), z.string().max(240)).default({}),
  /**
   * Os papéis de texto que o cliente APAGOU — "sem botão", "sem etiqueta".
   *
   * Um texto apagado voltava na proposta seguinte: o plano preenchia de
   * novo tudo o que não estava protegido, e uma arte pedida sem chamada
   * para acção saía com ela.
   */
  removedTexts: z
    .array(z.enum(['headline', 'subheadline', 'price', 'cta', 'badge']))
    .max(5)
    .default([]),
  /** As ideias que o cliente já viu e trocou nesta publicação. */
  seenIdeas: z.array(clippedText(300)).max(12).default([]),
  /**
   * Ideias de publicações recentes da mesma marca (§14).
   *
   * Serve o controlo de variedade: o modelo recebe o que já foi feito e é
   * instruído a não repetir. Variar conceito e composição, nunca a
   * identidade.
   */
  recentIdeas: z.array(z.string().max(300)).max(5).default([]),
  /** Regras da identidade aprovada, para o conceito as respeitar à partida. */
  identity: z
    .object({
      tone: z.string().max(200).default(''),
      avoid: z.array(z.string().max(80)).max(8).default([]),
      fixedRules: z.array(z.string().max(160)).max(8).default([]),
      constraints: z.string().max(400).default(''),
    })
    .nullable()
    .default(null),
  /**
   * O estilo aprendido com as artes que a empresa já publicou, em palavras.
   * Vazio quando a marca não o tem ou o cliente o desligou.
   */
  learnedStyle: clippedText(900),
  /**
   * As imagens que o cliente anexou, com a nota de cada uma.
   *
   * A direcção criativa era decidida sem as ver — só sabia QUANTAS havia.
   * Uma captura de ecrã da página do produto, com a nota "esta é a página
   * onde se paga", não entrava na ideia, e a arte saía sem ela.
   */
  attachments: z
    .array(
      z.object({
        note: clippedText(160),
        /** Para que serve: material da empresa, captura de ecrã ou arte a recriar. */
        // `catch` e não só `default`: um valor desconhecido de uma versão
        // futura cai no caso comum em vez de chumbar o pedido.
        kind: z.enum(['produto', 'captura', 'recriar']).catch('produto'),
        dataUrl: z
          .string()
          .max(3_000_000)
          .regex(/^data:image\/[a-z0-9+.-]+;base64,/i)
          .nullable()
          .default(null),
      }),
    )
    .max(6)
    .default([]),
  /** A memória da empresa, em regras curtas. Ver `artworkRequestSchema.memory`. */
  memory: z
    .array(clippedText(160))
    .max(12)
    .default([])
    .transform((rules) => rules.filter(Boolean)),
  brand: z.object({
    name: z.string().max(120),
    segment: z.enum(['restaurantes', 'beleza', 'lojas', 'servicos', 'outro']),
    description: z.string().max(600).default(''),
    /** Apenas os contactos escolhidos para esta publicação. */
    contacts: z
      .array(
        z.object({
          type: z.enum([
            'whatsapp',
            'telefone',
            'instagram',
            'facebook',
            'linkedin',
            'website',
            'endereco',
          ]),
          value: z.string().max(160),
        }),
      )
      .max(8)
      .default([]),
    colors: z.object({
      primary: z.string().max(9),
      secondary: z.string().max(9),
      accent: z.string().max(9).nullable().optional(),
    }),
  }),
  /**
   * Textos que o utilizador editou à mão e que não podem ser reescritos.
   * Chaveado pelo papel do texto (`headline`, `price`, ...).
   */
  lockedTexts: z.record(z.string(), z.string().max(240)).default({}),
});

export type PlanRequest = z.infer<typeof planRequestSchema>;

export const planResponseSchema = z.object({
  ok: z.literal(true),
  plan: planSchema,
  /** `ia` quando o plano veio de um fornecedor; `deterministico` caso contrário. */
  source: z.enum(['ia', 'deterministico']),
  /** Explicação curta, mostrada na interface. */
  notice: z.string().optional(),
});

export type PlanResponse = z.infer<typeof planResponseSchema>;

// --- Fundo ------------------------------------------------------------------

export const backgroundRequestSchema = z.object({
  prompt: z.string().max(400).default(''),
  /**
   * Modelo em uso. O servidor vai lá buscar as regras de geração
   * (`scenePrompt`, `negative`, `preserve`) e as referências permitidas.
   */
  templateId: z.string().max(60).optional(),
  format: formatEnum,
  style: styleEnum,
  colors: z.object({
    primary: z.string().max(9),
    secondary: z.string().max(9),
    accent: z.string().max(9).nullable().optional(),
  }),
  seed: z.string().max(200).default(''),
  attempt: z.number().int().min(0).max(50).default(0),
});

export type BackgroundRequest = z.infer<typeof backgroundRequestSchema>;

// --- Arte completa ----------------------------------------------------------



/**
 * Pedido de geração da arte completa.
 *
 * Tudo o que entra aqui já foi revisto pelo cliente no ecrã de revisão. As
 * referências de imagem vêm como data URL, produzidas no browser a partir
 * dos recursos que ele carregou.
 */
export const artworkRequestSchema = z.object({
  /**
   * Direcção criativa aprovada pelo cliente.
   *
   * ──────────────────────────────────────────────────────────────────────
   * Substituiu `templateId`. O gerador deixou de receber a identidade de um
   * modelo da biblioteca e passa a receber a IDEIA desta publicação — que é
   * o que a torna diferente das outras.
   *
   * `templateId` não foi reintroduzido como opcional de propósito: enquanto
   * existisse, havia um caminho para a composição de um modelo voltar a ser
   * imposta.
   * ──────────────────────────────────────────────────────────────────────
   */
  direction: z.object({
    /**
     * A abordagem da direcção. Decide se o nível mínimo de imagem se aplica:
     * só uma direcção `tipografica`, pedida pelo cliente, pode ser só texto.
     */
    approach: z.string().max(40).default(''),
    idea: z.string().min(1).max(400),
    scene: z.string().min(1).max(700),
    focus: z.string().max(200).default(''),
    hierarchy: z.string().max(300).default(''),
    composition: z.string().max(500).default(''),
    lighting: z.string().max(300).default(''),
    materials: z.string().max(300).default(''),
    brandApplication: z.string().max(300).default(''),
    /**
     * Os recursos de design da peça. Aparado e não rejeitado: direcções de
     * antes chegam sem ele, e uma frase a mais não pode custar a arte.
     */
    graphics: clippedText(420),
  }),
  /**
   * A cor de base desta arte: a principal ou a secundária da marca. Pinta o
   * fundo e as grandes áreas; a outra é o realce. Ver `composition/base.ts`.
   */
  base: z.enum(['primaria', 'secundaria']).catch('primaria').default('primaria'),
  /** O tamanho do logótipo escolhido na revisão. */
  logoSize: z.enum(['pequeno', 'medio', 'grande']).catch('pequeno').default('pequeno'),
  /** Contactos no bloco de texto (omissão) ou numa linha de rodapé. */
  contactsPlacement: z.enum(['texto', 'rodape']).catch('texto').default('texto'),
  /**
   * As fontes da marca, pelo nome. O gerador não as tem instaladas, mas
   * sabe desenhar "uma serifada de alto contraste como a Playfair Display"
   * — e sem isto desenhava a letra que lhe apetecia.
   */
  typography: z
    .object({
      display: clippedText(60),
      body: clippedText(60),
      displayKind: z.enum(['sans', 'serif']).catch('sans').default('sans'),
      bodyKind: z.enum(['sans', 'serif']).catch('sans').default('sans'),
    })
    .nullable()
    .default(null),
  /**
   * Plano de aproveitamento das referências (§8D).
   *
   * Pode vir vazio: sem referência adequada, a identidade e os princípios de
   * design bastam. Forçar uma referência inadequada era o defeito.
   */
  referenceUsage: z
    .array(
      z.object({
        referenceId: z.string().max(40),
        take: z.array(z.string().max(160)).max(8).default([]),
        doNotTransfer: z.array(z.string().max(80)).max(16).default([]),
        mode: z.enum(['descricao', 'imagem']).default('descricao'),
        // Diagnóstico (porque foi escolhida). Aparado, nunca rejeitado.
        why: z
          .string()
          .optional()
          .transform((value) => value?.slice(0, 300)),
      }),
    )
    .max(3)
    .default([]),
  format: formatEnum,
  style: styleEnum,
  /**
   * Defeitos da tentativa anterior, quando esta geração é uma correcção.
   *
   * Vêm da verificação automática (`/api/ai/review-art`) e entram no topo do
   * prompt. Vazio na primeira tentativa.
   */
  /*
    400 e não 220. Uma frase de defeito leva a nota do verificador lá dentro
    — "o logótipo saiu redesenhado (…)" — e passava dos 220 com facilidade.
    O pedido de correcção respondia 400 e a correcção automática morria em
    silêncio, precisamente no defeito mais grave.
  */
  correction: z.array(z.string().max(400)).max(8).default([]),
  company: z.string().max(120).default(''),
  segment: z.enum(['restaurantes', 'beleza', 'lojas', 'servicos', 'outro']),
  colors: z.object({
    primary: z.string().max(9),
    secondary: z.string().max(9),
    accent: z.string().max(9).nullable().optional(),
  }),
  texts: z.object({
    headline: z.string().max(120).default(''),
    subheadline: z.string().max(240).default(''),
    cta: z.string().max(80).default(''),
    badge: z.string().max(40).default(''),
    price: z.string().max(32).default(''),
  }),
  items: z
    .array(
      z.object({
        name: z.string().max(40),
        highlighted: z.boolean().default(false),
        hasImage: z.boolean().default(false),
      }),
    )
    .max(8)
    .default([]),
  /**
   * `true` quando o gerador desenha o logótipo na arte.
   *
   * Passou a ser o caminho normal. Com a aplicação a sobrepô-lo depois, o
   * logótipo caía em cima do texto gerado: duas camadas a disputar o mesmo
   * canto, porque o gerador não sabia que aquele espaço estava reservado.
   */
  drawLogo: z.boolean().default(true),
  /**
   * Contactos a escrever na arte, já com o nome de cada canal.
   *
   * Substituiu `contactLine`. A posição e o tamanho do logótipo saíram do
   * contrato: quem compõe a imagem decide onde a marca assenta, e era isso
   * que faltava para ela não colidir com o texto.
   */
  contacts: z
    .array(
      z.object({
        label: z.string().max(40),
        value: z.string().max(160),
      }),
    )
    // Oito e não seis: há sete canais de contacto, e uma publicação com
    // todos ligados respondia 400 depois de o cliente ter revisto tudo.
    .max(8)
    .default([]),
  /**
   * Referências de imagem, em data URL. O limite baixo é deliberado: cada
   * referência pesa no corpo do pedido e o fornecedor aceita no máximo 14.
   */
  references: z
    .array(
      z.object({
        /*
          Só material do cliente chega aqui.

          As referências estéticas são carregadas no servidor a partir do
          cadastro, nunca enviadas pelo cliente: um `dataUrl` com o papel de
          "estetica" vindo do browser seria uma imagem arbitrária a entrar na
          geração com o selo de exemplo aprovado.
        */
        role: z.enum([
          'produto',
          'captura',
          'recriar',
          'logotipo',
          'esboco',
          'arte-anterior',
          'estilo-marca',
        ]),
        /*
          180 e não 60.

          O rótulo passou a poder ser a explicação que o cliente escreveu
          sobre a fotografia — "copia o tipo de letra deste site" —, e o
          campo de nota aceita 160 caracteres. Com o limite antigo, uma nota
          longa fazia a geração responder 400 depois de o cliente ter
          escrito tudo.
        */
        // Aparado e não rejeitado: o rótulo de uma arte de estilo é o que ela
        // mostra, escrito por um modelo de visão, e pode passar dos 180.
        label: clippedText(180),
        dataUrl: z.string().max(8_000_000),
      }),
    )
    // Logótipo, esboço, cinco anexos e até três artes da biblioteca da marca.
    .max(10)
    .default([]),
  /**
   * A disposição aprovada no esboço da revisão, zona a zona, em palavras.
   * `null` em pedidos de antes do esboço.
   */
  layout: z
    .object({
      label: clippedText(80),
      zones: z
        .array(clippedText(400))
        .max(10)
        .default([])
        .transform((zones) => zones.filter(Boolean)),
    })
    .nullable()
    .default(null),
  /**
   * A memória da empresa, em regras curtas. Aparadas e não rejeitadas: são
   * escritas por um modelo e editadas pelo cliente.
   */
  memory: z
    .array(clippedText(160))
    .max(12)
    .default([])
    .transform((rules) => rules.filter(Boolean)),

  /**
   * O estilo aprendido com as artes que a empresa já publicou.
   *
   * Declarado aqui pela mesma razão das `surfaces` em baixo: um objecto Zod
   * descarta em silêncio o que não conhece, e o estilo saía do browser e
   * nunca chegava ao prompt.
   */
  brandStyle: z
    .object({
      analysedCount: z.number().int().min(0).max(500).default(0),
      summary: clippedText(600),
      composition: clippedText(420),
      typography: clippedText(420),
      color: clippedText(420),
      imagery: clippedText(420),
      graphics: clippedText(420),
      copy: clippedText(420),
      logo: clippedText(320),
      recurring: z
        .array(clippedText(160))
        .default([])
        .transform((items) => items.filter(Boolean).slice(0, 8)),
    })
    .nullable()
    .default(null),

  /**
   * Regras da identidade aprovada no cadastro.
   *
   * É o que mantém a coerência entre publicações: a mesma luz, o mesmo nível
   * de decoração, o mesmo tom. Opcional porque uma conta sem identidade
   * aprovada continua a poder gerar.
   */
  guidelines: z
    .object({
      lighting: z.string().max(200).default(''),
      framing: z.string().max(200).default(''),
      photoTreatment: z.string().max(200).default(''),
      decorationLevel: z.string().max(200).default(''),
      tone: z.string().max(200).default(''),
      avoid: z.array(z.string().max(80)).max(8).default([]),
      cornerRadius: z.string().max(20).default(''),
      shadow: z.string().max(20).default(''),
      /** Regras que não se negociam. */
      fixedRules: z.array(z.string().max(160)).max(8).default([]),
      /**
       * Papéis de superfície e de texto da paleta aprovada.
       *
       * Tem de estar declarado aqui, e não só no tipo do prompt: um objecto
       * Zod descarta em silêncio as chaves que não conhece. Sem esta entrada
       * as cores de fundo e de texto saíam do cliente e nunca chegavam ao
       * gerador — a falha mais difícil de ver, porque nada estoura.
       */
      surfaces: z
        .object({
          bgLight: z.string().max(9).nullable().default(null),
          bgDark: z.string().max(9).nullable().default(null),
          textOnLight: z.string().max(9).nullable().default(null),
          textOnDark: z.string().max(9).nullable().default(null),
        })
        .optional(),
    })
    .nullable()
    .default(null),
});

/**
 * Papel de uma imagem enviada ao gerador.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O papel é declarado explicitamente no prompt, e não é cosmética: decide se
 * a imagem é material do cliente a preservar ou um exemplo de acabamento de
 * que só se aproveitam qualidades.
 *
 * `composicao` deixou de existir. Era o papel de uma referência enviada como
 * estrutura obrigatória — a causa de os resultados repetirem a cena da
 * referência. Foi substituído por `estetica`, que o prompt identifica como
 * exemplo de acabamento e nunca como imagem-base de uma edição.
 * ──────────────────────────────────────────────────────────────────────────
 */
export type ReferenceRole =
  /** Fotografia de um produto do cliente. Preservar identidade e características. */
  | 'produto'
  /** Captura de ecrã de um site ou aplicação. Entra no ecrã de um dispositivo. */
  | 'captura'
  /**
   * Uma arte que o cliente quer refeita com a marca dele. Aproveita-se a
   * estrutura; o logótipo, o nome, as pessoas, as fotografias e os textos
   * dela nunca passam.
   */
  | 'recriar'
  /** Logótipo do cliente. Preservar integralmente. */
  | 'logotipo'
  /**
   * O esboço da disposição aprovado na revisão: diz ONDE fica cada coisa.
   * Nunca é referência de estilo nem de cor.
   */
  | 'esboco'
  /** Referência estética da biblioteca. Aproveitar só as qualidades indicadas. */
  | 'estetica'
  /** Arte anterior DESTE projecto, quando o cliente está a editá-la. */
  | 'arte-anterior'
  /**
   * Uma das duas artes que a empresa já publicou, guardadas pelo estilo
   * aprendido. Mostra a linguagem da marca; o conteúdo nunca se copia.
   */
  | 'estilo-marca';

export type ArtworkRequest = z.infer<typeof artworkRequestSchema>;
