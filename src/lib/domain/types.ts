import type { FontId } from '@/lib/fontCatalog';
import type { CreativeDirection } from './direction';
import type { ReferenceUsage } from './references';

// --- Conta ------------------------------------------------------------------

export type Account = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

// --- Formatos ---------------------------------------------------------------

/**
 * Formatos de publicação.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Cada entrada é uma proporção que uma plataforma trata de forma diferente,
 * não um nome comercial. `story` e `reels` partilham os mesmos píxeis de
 * propósito: a proporção é a mesma, mas a interface da aplicação tapa zonas
 * diferentes e o que se pede ao gerador muda — um story é uma peça para
 * ler, uma capa de reels é uma peça para parar o dedo.
 *
 * Adicionar um formato aqui obriga a declará-lo nos mapas de proporção de
 * cada fornecedor de imagem e na lista de formatos dos modelos. É de
 * propósito: um formato que o gerador não sabe pedir é um formato que falha
 * em produção, e o compilador apanha-o antes do cliente.
 * ──────────────────────────────────────────────────────────────────────────
 */
export type FormatId =
  /** 1080 × 1350 (4:5) — feed de Instagram e Facebook. */
  | 'vertical'
  /** 1080 × 1080 (1:1) — feed de qualquer rede. */
  | 'quadrado'
  /** 1080 × 1920 (9:16) — stories de Instagram, Facebook e WhatsApp. */
  | 'story'
  /** 1080 × 1920 (9:16) — capa de Reels e de TikTok. */
  | 'reels'
  /** 1200 × 627 (1.91:1) — publicação de imagem única no LinkedIn. */
  | 'linkedin'
  /** 1920 × 1080 (16:9) — YouTube, capa de evento, apresentação. */
  | 'horizontal';

export type FormatSpec = {
  id: FormatId;
  label: string;
  hint: string;
  /** Rede onde o formato se encaixa. Só informativo. */
  platform: string;
  width: number;
  height: number;
};

// --- Segmentos e estilos ----------------------------------------------------

export type SegmentId = 'restaurantes' | 'beleza' | 'lojas' | 'servicos' | 'outro';

/**
 * Estilo visual: a FORMA de apresentar a mensagem.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Não fixa objectos nem composição. Um estilo diz como a mensagem se
 * apresenta; o que aparece na arte vem do pedido e da marca.
 *
 * "Promocional" saiu da lista. Promoção é um OBJECTIVO, não um estilo: uma
 * promoção pode ser clean, elegante ou vibrante, e tratá-la como estilo
 * forçava preços gigantes e cores berrantes em campanhas que pediam o
 * contrário.
 *
 * `auto` não é um estilo: é a ausência de escolha, e manda o sistema decidir
 * a direcção mais adequada ao pedido e à marca.
 * ──────────────────────────────────────────────────────────────────────────
 */
export type StyleId =
  | 'auto'
  | 'clean'
  | 'elegante'
  | 'vibrante'
  | 'tecnologico'
  | 'cinematografico';

/**
 * Características descritivas de uma peça ou de uma referência.
 *
 * São etiquetas INTERNAS: ajudam a recuperar referências e a descrever uma
 * direcção criativa, e nunca viram botões no ecrã do cliente. Seis estilos já
 * é o limite do que se escolhe sem hesitar.
 */
export type VisualTrait =
  | 'conceptual'
  | 'fotografico'
  | 'editorial'
  | 'institucional'
  | 'tridimensional'
  | 'tipografico'
  | 'corporativo'
  | 'comercial'
  | 'informativo'
  | 'humano'
  | 'expressivo'
  | 'alto-impacto';

// --- Marca ------------------------------------------------------------------

export type ContactType =
  | 'whatsapp'
  | 'telefone'
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'website'
  | 'endereco';

export type BrandContact = {
  id: string;
  type: ContactType;
  value: string;
  /** Se entra nas artes por omissão. Nunca se activam todos automaticamente. */
  showByDefault: boolean;
};

export type BrandColors = {
  primary: string;
  secondary: string;
  /** Terceira cor, opcional. */
  accent?: string | null;
};

/** Resultado da análise de ficheiros de identidade. */
export type IdentityHint = {
  kind: 'cor' | 'fonte' | 'nota';
  value: string;
  /**
   * `explicito` — encontrado tal e qual no ficheiro (ex.: `#1A3A5C` escrito no
   * manual, ou o nome de uma fonte embebida no PDF).
   * `inferido` — deduzido por análise (ex.: cor dominante de uma imagem).
   */
  source: 'explicito' | 'inferido';
  /** De onde veio, para o utilizador poder confirmar. */
  origin: string;
  /** Detalhe opcional: frequência, nome do ficheiro, etc. */
  detail?: string;
};

// --- Especificação de identidade -------------------------------------------

/**
 * De onde veio uma decisão da identidade.
 *
 * É a distinção que o produto tem de manter visível: o que o cliente
 * afirmou, o que estava escrito no manual dele, e o que é sugestão nossa.
 * Sem isto, uma sugestão passa a parecer um facto sobre a marca.
 */
export type DecisionSource = 'cliente' | 'manual' | 'ia';

export type VisualPreference =
  | 'minimalista'
  | 'elegante'
  | 'moderno'
  | 'institucional'
  | 'vibrante';

/** Secções ajustáveis da proposta. Serve para preservar edições manuais. */
export type BrandSectionId =
  | 'identidade'
  | 'paleta'
  | 'tipografia'
  | 'logotipo'
  | 'fundos';

export type BrandColorRole =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'bgLight'
  | 'bgDark'
  | 'textOnLight'
  | 'textOnDark'
  | 'neutral';

export type BrandColorEntry = {
  role: BrandColorRole;
  hex: string;
  /** Nome legível: "Principal", "Fundo claro". */
  label: string;
  /** Para que serve: "títulos e botões". */
  usage: string;
  source: DecisionSource;
};

export type BrandTypography = {
  display: FontId;
  body: FontId;
  /** Porque esta escolha serve a marca. */
  rationale: string;
  /**
   * Fontes pedidas no manual que não existem no catálogo.
   *
   * Nunca substituímos em silêncio: a interface diz qual foi pedida, que
   * alternativa usámos e porquê.
   */
  unavailable: Array<{ requested: string; replacedWith: FontId }>;
  source: DecisionSource;
};

export type BrandLogoRules = {
  /** Largura mínima, em píxeis, para o logótipo continuar legível. */
  minWidthPx: number;
  /** Margem de segurança, em fracção da largura do logótipo. */
  clearSpaceRatio: number;
  worksOnLight: boolean;
  worksOnDark: boolean;
  /**
   * Fundos onde o logótipo precisa de uma área de contraste atrás.
   * NUNCA recolorimos o ficheiro do cliente.
   */
  needsBackdropOn: 'nenhum' | 'claro' | 'escuro' | 'ambos';
  preferredPlacements: LogoPlacement[];
  source: DecisionSource;
};

export type BrandBackgroundStyle = {
  id: 'claro' | 'escuro' | 'textura' | 'fotografia';
  label: string;
  description: string;
  /** Cores da prévia, derivadas da paleta da marca. */
  hexes: string[];
};

export type BrandGraphics = {
  cornerRadius: 'recto' | 'suave' | 'redondo';
  shadow: 'nenhuma' | 'discreta' | 'marcada';
  lineWeight: 'fina' | 'media' | 'forte';
  decoration: 'minima' | 'moderada' | 'rica';
  notes: string;
  source: DecisionSource;
};

export type BrandComposition = {
  logoPlacement: LogoPlacement;
  hierarchy: string;
  margins: string;
  contacts: string;
  price: string;
  source: DecisionSource;
};

export type BrandDirection = {
  lighting: string;
  framing: string;
  photoTreatment: string;
  decorationLevel: string;
  tone: string;
  avoid: string[];
  source: DecisionSource;
};

/**
 * Escala tipográfica do sistema.
 *
 * Um par de fontes não é tipografia: é uma escolha de fontes. O que faz um
 * sistema utilizável são os degraus — que tamanho tem um título, que peso
 * tem um rótulo, quanto respira cada linha.
 */
export type BrandTypeStep = {
  /** Identificador do degrau: `display`, `titulo`, `corpo`, `rotulo`. */
  id: string;
  label: string;
  /** Papel tipográfico que carrega a fonte. */
  font: 'display' | 'body';
  /** Tamanho em píxeis, à escala de uma publicação de 1080 px. */
  sizePx: number;
  weight: 400 | 500 | 600 | 700;
  lineHeight: number;
  /** Espaçamento entre letras, em `em`. */
  tracking: number;
  uppercase: boolean;
  /** Para que serve este degrau. */
  usage: string;
};

/**
 * Visual gerado por IA para a identidade.
 *
 * Cada um tem o seu prompt e a sua geração. Um pedido único a produzir todas
 * as imagens daria uma colagem; pedidos separados dão peças que servem para
 * algo.
 */
/**
 * Visuais gerados por IA na identidade.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Um só: a folha de identidade visual.
 *
 * Havia quatro — a folha, o logótipo sobre claro, o logótipo sobre escuro e
 * uma textura de fundo. As três últimas saíram, e por razões concretas, não
 * por economia:
 *
 *  · as aplicações do logótipo sobre claro e sobre escuro são desenhadas
 *    pela aplicação com o FICHEIRO REAL do cliente sobre as cores da paleta.
 *    Sai instantâneo, de graça, e mostra o contraste verdadeiro. O gerador
 *    dava o oposto: um logótipo azul-marinho num envelope azul-marinho,
 *    exactamente a aplicação que as regras dizem para evitar;
 *  · a textura de fundo não tem para onde ir. As cores da marca acompanham
 *    a empresa como DADOS e a geração de cada publicação recebe-as em
 *    palavras — um ficheiro de padrão era uma quarta geração paga para
 *    ilustrar o que a paleta já diz.
 * ──────────────────────────────────────────────────────────────────────────
 */
export type BrandVisualKind = 'identidade';

export type BrandVisual = {
  kind: BrandVisualKind;
  label: string;
  /** Instrução enviada ao gerador. Editável pelo cliente. */
  prompt: string;
  assetId: string | null;
  /** `true` quando a paleta mudou depois de este visual ser gerado. */
  stale: boolean;
  /** Proporção pedida ao gerador. */
  format: 'vertical' | 'quadrado' | 'story';
};

/**
 * Identidade da marca como dados reutilizáveis.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * É isto que alimenta a criação de publicações. Guardada com versão e
 * estado, para que alterar a identidade não mexa em projectos já feitos: um
 * projecto fica associado à versão com que foi criado.
 *
 * `fixedRules` e `flexiblePreferences` existem separadas de propósito. As
 * primeiras são a integridade do logótipo e as restrições que o cliente
 * declarou — não se negociam. As segundas são composição, fundos e
 * decoração, que cada publicação pode ajustar.
 * ──────────────────────────────────────────────────────────────────────────
 */
export type BrandIdentitySpec = {
  id: string;
  version: number;
  status: 'rascunho' | 'aprovada';
  /** Sugestão de assinatura. `null` quando não há. Nunca é apresentada como oficial. */
  tagline: { value: string; source: DecisionSource } | null;
  colors: BrandColorEntry[];
  typography: BrandTypography;
  /** Degraus tipográficos do sistema. */
  typeScale: BrandTypeStep[];
  logoRules: BrandLogoRules;
  backgrounds: BrandBackgroundStyle[];
  graphics: BrandGraphics;
  /** Visuais gerados por IA, um prompt cada. */
  visuals: BrandVisual[];

  /*
    Os três campos seguintes NÃO aparecem no ecrã.

    Alimentam a geração das publicações — é a identidade a mandar na arte
    sem o cliente ter de a repetir em cada pedido. Mostrá-los na proposta
    era enchê-la de texto que ninguém lê: o cliente quer ver o sistema
    visual, não o prompt.
  */
  composition: BrandComposition;
  direction: BrandDirection;
  fixedRules: string[];

  /** Texto livre do cliente: o que respeitar ou evitar. */
  clientConstraints: string;
  visualPreference: VisualPreference | null;
  /** Como a proposta foi produzida. */
  producedBy: 'ia' | 'local';
  createdAt: string;
  approvedAt: string | null;
  /**
   * Secções editadas à mão. Uma actualização da proposta não lhes toca.
   */
  lockedSections: BrandSectionId[];
};

export type BrandIdentity = {
  colors: BrandColors;
  fontDisplay: FontId;
  fontBody: FontId;
  /** Logótipo principal. */
  logoAssetId: string | null;
  /** Versão opcional para usar SOBRE fundos claros. */
  logoForLightBgAssetId: string | null;
  /** Versão opcional para usar SOBRE fundos escuros. */
  logoForDarkBgAssetId: string | null;
  /** Como a identidade foi definida. */
  setupMode: 'manual' | 'importado';
  /** Proveniência, quando houve importação. Apenas informativo. */
  importReport?: {
    at: string;
    files: string[];
    hints: IdentityHint[];
    /** Se existiu integração de IA na análise. */
    usedAi: boolean;
  } | null;

  /**
   * `true` quando as cores foram escolhidas ou confirmadas pelo cliente.
   *
   * Enquanto for `false`, `colors` contém apenas valores de reserva para o
   * motor de artes ter hexadecimais válidos. Esses valores NÃO são enviados
   * à IA como decisão da empresa — se fossem, a proposta ficava presa a
   * cores que ninguém escolheu e o logótipo real era ignorado.
   */
  colorsConfirmed?: boolean;

  /** Preferência visual indicada no cadastro. */
  visualPreference?: VisualPreference | null;
  /** O que o cliente mandou respeitar ou evitar. */
  constraints?: string;
  /**
   * Proposta em curso ou aprovada.
   *
   * `null` enquanto o cliente não gerar nenhuma. A aplicação continua a
   * funcionar sem ela: `colors`, `fontDisplay` e `fontBody` são o mínimo.
   */
  spec?: BrandIdentitySpec | null;
  /**
   * O estilo aprendido com as artes que a empresa já publicou.
   *
   * Vive dentro de `identity` e não ao lado: no Supabase a identidade é uma
   * coluna `jsonb` que aceita campos novos, e um campo de topo na marca era
   * descartado em silêncio pela gravação, que só conhece as colunas que
   * existem.
   */
  styleLearning?: BrandStyleLearning | null;
  /**
   * A memória da empresa: o que o uso ensinou, em regras curtas.
   *
   * Dentro de `identity` pela mesma razão do estilo aprendido.
   */
  memory?: BrandMemory | null;
};

// --- Memória da empresa -----------------------------------------------------

/**
 * Um acontecimento do uso que diz alguma coisa sobre a empresa.
 *
 * Só os que mostram uma preferência: o que se corrigiu numa edição, a ideia
 * que se recusou, a arte que se descarregou, o texto que se reescreveu, a
 * arte que se aprovou para a biblioteca. Abrir um projecto não ensina nada.
 */
export type BrandMemoryEvent = {
  id: string;
  kind: 'edicao' | 'outra-ideia' | 'melhoria' | 'descarga' | 'texto' | 'aprovada';
  at: string;
  projectId: string | null;
  /** O que aconteceu, numa frase já pronta para o modelo ler. */
  detail: string;
};

/** Uma regra da memória, escrita pela IA a partir do uso ou pelo cliente. */
export type BrandMemoryRule = {
  id: string;
  text: string;
  source: 'ia' | 'cliente';
  createdAt: string;
};

export type BrandMemory = {
  /** `false` quando o cliente desliga a memória sem a apagar. */
  enabled: boolean;
  /** Os acontecimentos mais recentes primeiro. Tem tecto. */
  events: BrandMemoryEvent[];
  rules: BrandMemoryRule[];
  /**
   * Regras que o cliente apagou. A IA não as volta a propor: uma regra
   * apagada é uma correcção, e esquecê-la era desfazer a correcção.
   */
  dismissed: string[];
  /** Acontecimentos novos desde a última leitura. */
  pending: number;
  learnedAt: string | null;
};

/**
 * O estilo que se repete nas artes que a empresa já usa, em palavras.
 *
 * Cada campo descreve LINGUAGEM VISUAL — tipografia, cor, composição,
 * tratamento de imagem —, nunca conteúdo. Os produtos, os preços e as
 * promoções de uma arte antiga não são estilo da marca: são dessa arte.
 */
export type BrandStyleProfile = {
  /** A linguagem visual da marca numa ou duas frases. */
  summary: string;
  composition: string;
  typography: string;
  color: string;
  /** Fotografia, ilustração, 3D: como a imagem é tratada. */
  imagery: string;
  /** Formas, selos, faixas, texturas que se repetem. */
  graphics: string;
  /** Tom e densidade do texto. */
  copy: string;
  /** Como o logótipo costuma ser aplicado. */
  logo: string;
  /** Elementos que aparecem em várias artes e definem a marca. */
  recurring: string[];
};

/**
 * Uma arte da BIBLIOTECA DA MARCA.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Duas origens, a mesma função:
 *
 *  · `cadastro` — uma das que o cliente enviou. Ficam todas; as duas que a
 *    leitura do estilo diz representarem-no melhor levam `featured`;
 *  · `aprovada` — gerada na Kriar e aprovada pelo cliente no botão "Usar
 *    como referência da marca". Nunca entra sozinha: uma arte descarregada
 *    não é necessariamente uma arte exemplar.
 *
 * Em cada geração seguem duas ou três, escolhidas pelo tema e em rotação. O
 * perfil em texto é que leva a biblioteca inteira a todos os pedidos.
 * ──────────────────────────────────────────────────────────────────────────
 */
export type BrandStyleReference = {
  assetId: string;
  /**
   * O que esta arte MOSTRA — produtos, textos, preços, pessoas.
   *
   * É a lista do que nunca passa para uma arte nova. Sem ela, o gerador
   * recebia uma promoção antiga como exemplo e devolvia a mesma promoção.
   */
  content: string;
  /** Porque representa a marca. */
  why: string;
  /**
   * Das que melhor representam o estilo, na leitura em que entrou.
   *
   * Guardavam-se só essas duas, e o cliente que enviava doze via duas na
   * biblioteca ("enviei várias, só carregaram duas"). Agora ficam todas, e
   * estas seguem mais vezes como exemplo (`pickLibraryArts`).
   */
  featured?: boolean;
  width: number | null;
  height: number | null;
  source: 'cadastro' | 'aprovada';
  /** Palavras do tema (o serviço, o produto, a campanha), para escolher por relevância. */
  topics: string[];
  /** Formato da arte, quando se sabe. Uma referência do mesmo formato pesa mais. */
  format: FormatId | null;
  /** A publicação de onde veio, quando foi aprovada aqui. */
  projectId: string | null;
  /** A versão da arte aprovada, para o botão saber se esta já lá está. */
  fromAssetId: string | null;
  addedAt: string;
};

export type BrandStyleLearning = {
  /** `false` quando o cliente desliga o estilo sem o esquecer. */
  enabled: boolean;
  profile: BrandStyleProfile;
  /**
   * A biblioteca da marca: as do cadastro e as aprovadas, mais recentes
   * primeiro. Ver `BrandStyleReference`.
   */
  references: BrandStyleReference[];
  /** Quantas artes foram analisadas. */
  analysedCount: number;
  /** Se as artes são coerentes entre si, numa frase. */
  consistency: string;
  analysedAt: string;
  /** Fornecedor e modelo que fizeram a leitura. */
  producedBy: string;
};

export type Brand = {
  id: string;
  accountId: string;
  company: {
    name: string;
    segment: SegmentId;
    description: string;
    website?: string;
    address?: string;
  };
  contacts: BrandContact[];
  identity: BrandIdentity;
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
};

// --- Ficheiros --------------------------------------------------------------

export type AssetKind =
  | 'logo'
  | 'logo-light-bg'
  | 'logo-dark-bg'
  | 'product'
  | 'reference'
  | 'brand-manual'
  | 'generated-bg';

export type Asset = {
  id: string;
  accountId: string;
  kind: AssetKind;
  name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  /** Caminho no armazenamento (Supabase). Vazio no modo local. */
  path: string | null;
  /** Origem do recurso, quando foi produzido pela aplicação. */
  provenance?: 'upload' | 'ia' | 'local';
  createdAt: string;
};

// --- Composição -------------------------------------------------------------

export type TextRole = 'headline' | 'subheadline' | 'price' | 'cta' | 'contacts' | 'badge';

export type CompositionText = {
  value: string;
  /**
   * `true` quando o utilizador editou o texto à mão. Nesse estado a IA
   * (ou o planeador determinístico) não o pode reescrever.
   */
  locked: boolean;
  /**
   * O texto que a IA propôs, antes de o cliente lhe mexer.
   *
   * É o que permite à memória da empresa saber que o cliente reescreveu
   * "Paga a tua subscrição" para "Paga a tua Netflix" — e aprender com isso.
   */
  proposed?: string;
};

/**
 * Para que serve um anexo.
 *
 *  · `produto`  — fotografia ou produto: material real que entra na arte;
 *  · `captura`  — captura de ecrã de um site ou de uma aplicação: entra no
 *                 ecrã de um dispositivo da cena;
 *  · `recriar`  — uma arte que já existe, de outra empresa ou não, para
 *                 fazer igual mas com esta marca. Aproveita-se a estrutura;
 *                 o logótipo, o nome, as pessoas, as fotografias e os
 *                 textos dela nunca passam.
 */
export type AttachmentKind = 'produto' | 'captura' | 'recriar';

export type CompositionImage = {
  assetId: string;
  /** Ponto focal normalizado, usado quando a imagem é recortada. */
  focal: { x: number; y: number };
  /** Para que serve. `produto` por omissão, que é o caso comum. */
  kind: AttachmentKind;
  /**
   * O que o cliente quer que seja feito com esta imagem. Opcional.
   *
   * ──────────────────────────────────────────────────────────────────────────
   * Uma fotografia sem explicação é ambígua para quem gera. "Este é o produto
   * principal", "usa só o fundo desta", "copia o tipo de letra do site" e
   * "este é o nosso espaço" são instruções diferentes para a mesma imagem, e
   * o gerador não as adivinha.
   *
   * Vazio é o estado normal e aceitável: a maioria das fotografias é o
   * produto, e obrigar a escrever uma nota por cada uma era atrito sem
   * ganho.
   * ──────────────────────────────────────────────────────────────────────────
   */
  note: string;
};

/**
 * Uma das opções apresentadas na arte.
 *
 * As peças são desenhadas pela aplicação — forma, cor, imagem e nome — e não
 * pelo gerador de imagem. É isso que mantém a ortografia correcta, os nomes
 * editáveis depois da geração e as posições exactamente onde foram aprovadas.
 */
export type CompositionItem = {
  id: string;
  /** Nome curto que aparece na peça. */
  name: string;
  /** Imagem, logótipo ou ícone aplicado na superfície. */
  assetId: string | null;
  /** `true` depois de o utilizador editar o nome à mão. */
  locked: boolean;
};

export type LayerOverride = {
  /** Deslocamento manual, normalizado à largura/altura da arte. */
  dx: number;
  dy: number;
  /** Escala manual aplicada ao bloco (0.5 a 1.8). */
  scale: number;
  /** Alinhamento forçado, só para texto. */
  align?: 'left' | 'center' | 'right';
  /** Peso forçado, só para texto. Limitado aos pesos do catálogo de fontes. */
  weight?: 400 | 500 | 600 | 700;
};

export type CompositionBackground = {
  /** `modelo` usa as formas do modelo; `gerado` usa o recurso de fundo. */
  mode: 'modelo' | 'gerado';
  assetId: string | null;
  /** Descrição que serviu de base ao fundo. Editável pelo utilizador. */
  prompt: string;
  /** Como o fundo actual foi produzido. */
  producedBy: 'ia' | 'local' | null;
};

/** Onde o logótipo assenta na arte. */
export type LogoPlacement =
  | 'superior-esquerdo'
  | 'superior-centro'
  | 'superior-direito'
  | 'inferior-esquerdo'
  | 'inferior-centro'
  | 'inferior-direito';

export type LogoSize = 'pequeno' | 'medio' | 'grande';

/**
 * A cor de base de uma arte: a principal ou a secundária da marca.
 *
 * É a cor do fundo e das grandes áreas de design. Há empresas que alternam
 * de propósito — uma publicação clara, uma escura — para o perfil ficar
 * ritmado; por isso escolhe-se em cada publicação, e por omissão alterna
 * com a anterior da mesma marca.
 */
export type ArtBase = 'primaria' | 'secundaria';

/**
 * Onde ficam os contactos na arte.
 *
 *  · `texto` — por baixo do botão, como a última linha do bloco de texto.
 *    É o de omissão: o gerador respeita-o melhor (ver `sketch.ts`);
 *  · `rodape` — numa linha própria no fundo, acima da margem.
 */
export type ContactsPlacement = 'texto' | 'rodape';

/**
 * Arte final gerada.
 *
 * O gerador produz a publicação completa — cena, produtos e texto. É isso que
 * dá o acabamento profissional, e é também a razão de existir a camada de
 * acabamento (`finish`): há coisas que um modelo de imagem não consegue
 * reproduzir com exactidão.
 */
export type CompositionArtwork = {
  assetId: string | null;
  /** Instrução que produziu esta arte. Editável antes de gerar. */
  prompt: string;
  producedBy: 'ia' | null;
  generatedAt: string | null;
  /** Dimensões reais do ficheiro devolvido. */
  width: number | null;
  height: number | null;
  /** Como a versão ACTUAL nasceu. `null` enquanto não há arte. */
  origin: ArtworkVersion['origin'] | null;
  /** O que a edição pediu, quando a versão actual nasceu de uma. */
  summary: string;
  /**
   * Versões anteriores, da mais recente para a mais antiga.
   *
   * ──────────────────────────────────────────────────────────────────────
   * "Gerar outra" e cada edição por zonas substituíam a arte, e a anterior
   * só voltava com Ctrl+Z na mesma sessão. Uma arte paga que desaparece ao
   * fechar o separador é uma arte perdida.
   *
   * Vive dentro da composição de propósito: desfazer uma edição desfaz
   * também a entrada no histórico, e as duas coisas nunca se contradizem.
   * ──────────────────────────────────────────────────────────────────────
   */
  history: ArtworkVersion[];
};

/** Uma versão da arte guardada no histórico. */
export type ArtworkVersion = {
  /** Identifica a versão: cada versão é um ficheiro diferente. */
  assetId: string;
  origin: 'geracao' | 'edicao';
  createdAt: string;
  width: number | null;
  height: number | null;
  /** O que a edição pediu. Vazio numa geração. */
  summary: string;
};

/**
 * Acabamento aplicado POR CIMA da arte gerada.
 *
 * Existe por uma razão concreta: um modelo de imagem redesenha o logótipo em
 * vez de o reproduzir, e erra dígitos de números de telefone e nomes de
 * perfis. Estas duas camadas são desenhadas pela aplicação com o ficheiro e
 * os valores reais. O utilizador pode desligá-las.
 */
export type CompositionFinish = {
  /** Sobrepõe o ficheiro original do logótipo. */
  overlayLogo: boolean;
  /** Sobrepõe a linha de contactos com os valores exactos. */
  overlayContacts: boolean;
};

export type Composition = {
  /**
   * ──────────────────────────────────────────────────────────────────────────
   * CAMPOS DO ANTIGO SISTEMA DE MODELOS.
   *
   * Preservados, e por uma razão de dados e não de gosto: projectos já
   * criados referenciam-nos, e o motor de composição local continua a
   * precisar deles para desenhar o recurso sem chave de IA e as miniaturas
   * de rascunho.
   *
   * O que mudou é a AUTORIDADE. Deixaram de decidir a criação: já não vão
   * para a instrução do gerador, já não escolhem a cena e já não impõem
   * coordenadas. São geometria para o motor local, não direcção criativa.
   * Ver `direction`, que é quem manda agora.
   * ──────────────────────────────────────────────────────────────────────────
   */
  templateId: string;
  /** Variação de disposição do motor local. `null` usa a primeira. */
  variantId: string | null;
  /** Mantido para leitura de projectos antigos. */
  templateLocked: boolean;

  /**
   * DIRECÇÃO CRIATIVA desta publicação.
   *
   * A ideia criada para este pedido. É o que o gerador recebe e o que
   * "Outra ideia" substitui.
   *
   * `null` em projectos criados antes desta arquitectura — continuam a
   * abrir, e ganham uma direcção na primeira vez que forem planeados outra
   * vez.
   */
  direction: CreativeDirection | null;
  /**
   * Outras direcções propostas na mesma chamada.
   *
   * "Outra ideia" usa-as antes de pedir uma proposta nova: o modelo já
   * propôs duas ou três, e descartá-las para voltar a pedir era pagar duas
   * vezes pelo mesmo trabalho.
   */
  alternatives: CreativeDirection[];
  /** Referências usadas e o que foi aproveitado de cada uma (§8D). */
  references: ReferenceUsage[];

  format: FormatId;
  style: StyleId;
  /** Paleta desta publicação. Começa igual à da marca e pode divergir. */
  colors: BrandColors;
  /** `true` enquanto as cores forem exactamente as da marca. */
  colorsFromBrand: boolean;
  fontDisplay: FontId;
  fontBody: FontId;
  texts: Partial<Record<TextRole, CompositionText>>;
  images: CompositionImage[];
  /** Índice em `images` da fotografia principal. */
  mainImageIndex: number;
  /** Opções apresentadas. O modelo declara quantas comporta. */
  items: CompositionItem[];
  /** Índice em `items` da opção em destaque. */
  highlightedItemIndex: number;
  logo: {
    show: boolean;
    /**
     * `auto` escolhe a versão conforme a luminosidade do fundo onde o
     * logótipo assenta. As restantes forçam uma versão concreta.
     */
    variant: 'auto' | 'principal' | 'fundo-claro' | 'fundo-escuro';
    placement: LogoPlacement;
    size: LogoSize;
    /**
     * `true` depois de o cliente escolher a posição no esboço. Sem escolha,
     * cada grelha põe o logótipo onde ele fica melhor nela.
     */
    placementChosen?: boolean;
  };
  /** Contactos escolhidos para ESTA publicação. */
  contacts: Array<{ type: ContactType; value: string }>;
  /** Onde ficam os contactos. Publicações antigas chegam sem isto: `texto`. */
  contactsPlacement?: ContactsPlacement;
  /**
   * A cor de base desta arte. Ver `ArtBase`.
   *
   * Sem `baseChosen`, é proposta: a oposta da última publicação da marca,
   * para o feed alternar. Com ela, foi o cliente que escolheu e fica.
   */
  base?: ArtBase;
  baseChosen?: boolean;
  overrides: Record<string, LayerOverride>;
  background: CompositionBackground;
  artwork: CompositionArtwork;
  finish: CompositionFinish;
  /** Nota de direcção visual. Não entra na arte exportada. */
  visualDirection: string;
  /** `true` depois de o utilizador editar a nota à mão. */
  visualDirectionLocked: boolean;
  /**
   * `true` depois de o website da marca ter sido proposto nesta publicação.
   *
   * O website passou a entrar por omissão. As publicações de antes não o
   * tinham, e esta marca diz que já se tratou disso uma vez: se o cliente o
   * tirar depois, fica tirado.
   */
  websiteDefaulted?: boolean;
  /**
   * As artes da biblioteca da marca que seguiram na última geração.
   *
   * Servem a rotação: a próxima publicação da mesma marca prefere outras,
   * para o feed não sair todo da mesma referência.
   */
  brandRefs?: string[];
  /**
   * As ideias que o cliente já viu nesta publicação e trocou.
   *
   * "Outra ideia" mandava só a ideia actual: à terceira troca o modelo podia
   * voltar a propor a primeira. Vão todas, para cada ideia nova ser mesmo
   * nova.
   */
  seenIdeas?: string[];
};

// --- Projecto ---------------------------------------------------------------

export type ProjectStatus = 'rascunho' | 'composicao' | 'arte-final';

export type MissingField = {
  field: string;
  question: string;
};

export type Project = {
  id: string;
  accountId: string;
  brandId: string;
  name: string;
  status: ProjectStatus;
  /** Pedido original, tal como foi escrito. */
  brief: string;
  composition: Composition;
  /** Campos que a aplicação não pode inventar e pede ao utilizador. */
  missingFields: MissingField[];
  /** Como o último plano foi produzido. */
  planSource: 'ia' | 'deterministico' | null;
  /** Miniatura em data URL, gerada na gravação. */
  thumbnail: string | null;
  createdAt: string;
  updatedAt: string;
};

// --- Estado de integrações --------------------------------------------------

export type IntegrationStatus = {
  storage: 'supabase' | 'local';
  text: { configured: boolean; provider: string | null };
  image: {
    configured: boolean;
    provider: string | null;
    /** Proporção (largura/altura) que o gerador devolve em cada formato. */
    ratios?: Partial<Record<FormatId, number>>;
  };
};
