/**
 * DIRECÇÃO CRIATIVA de uma publicação.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * É a proposta específica criada para um pedido concreto — e é o conceito
 * que faltava no sistema.
 *
 * Antes existia um "modelo" escolhido de uma biblioteca, e esse modelo trazia
 * a cena já decidida. Trocavam-se os textos e os produtos. O que não existia
 * era uma IDEIA feita para aquele pedido: por isso uma perfumaria e uma
 * escola recebiam a mesma encenação.
 *
 * A direcção criativa é criada a partir do briefing e da identidade. As
 * referências entram depois, para orientar o acabamento — não para fornecer
 * a ideia.
 * ──────────────────────────────────────────────────────────────────────────
 */
import type { ReferenceDensity, ReferenceUsage, VisualTechnique } from './references';
import type {
  BrandColors,
  ContactType,
  FormatId,
  LogoPlacement,
  LogoSize,
  StyleId,
  TextRole,
} from './types';

/**
 * Abordagem visual.
 *
 * Seis formas de resolver uma publicação. Nenhuma é obrigatória e nenhuma
 * exige metáfora, mão, cenário tridimensional ou efeitos: foi a ausência
 * desta lista que fez tudo sair como cena conceptual encenada.
 */
export type VisualApproach =
  /** O produto no contexto onde é usado. */
  | 'produto-em-contexto'
  /** O produto sozinho, bem fotografado. */
  | 'fotografia-simples'
  /** A mensagem resolvida com tipografia, sem cena. */
  | 'tipografica'
  /** Composição de revista: imagem, texto e grelha. */
  | 'editorial'
  /** Uma ideia representada por uma cena construída. */
  | 'cena-conceptual'
  /** Vários produtos organizados num conjunto. */
  | 'varios-produtos';

/**
 * DISPOSIÇÃO da arte: onde fica a imagem protagonista, o texto, o logótipo
 * e os contactos.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Seis grelhas, as mesmas que as artes de agência da biblioteca usam. A cena
 * é criada para cada pedido; a GRELHA é que não se improvisa. Era o gerador
 * a decidir sozinho onde punha o logótipo e os contactos, e uma arte real
 * saiu com o logótipo colado à aresta e o website empilhado por cima dele.
 *
 * Com uma grelha, a revisão mostra um esboço fiel antes de gastar uma
 * geração, e o gerador recebe esse esboço como imagem.
 * ──────────────────────────────────────────────────────────────────────────
 */
export type LayoutId =
  /** Título e texto em cima, à esquerda; a imagem protagonista por baixo. */
  | 'titulo-topo'
  /** Título centrado em cima, com o logótipo por cima dele; a imagem por baixo. */
  | 'titulo-centro'
  /** Texto à esquerda; a imagem protagonista à direita. */
  | 'texto-esquerda'
  /** Texto à direita; a imagem protagonista à esquerda. */
  | 'texto-direita'
  /** A imagem protagonista em cima; o texto em baixo, à esquerda. */
  | 'titulo-baixo'
  /** O título domina; a imagem é de apoio. */
  | 'tipografica';

/** O que a imagem protagonista mostra. Serve a escolha das referências. */
export type ProtagonistKind = 'pessoa' | 'produto' | 'dispositivo' | 'cena' | 'tipografia';

export type CreativeDirection = {
  /** Identificador desta direcção dentro do projecto. */
  id: string;
  /** A ideia central, numa frase que o cliente entende. */
  idea: string;
  approach: VisualApproach;
  /** A cena ou a abordagem gráfica, em linguagem concreta. */
  scene: string;
  /** O elemento principal da arte. */
  focus: string;
  hierarchy: string;
  composition: string;
  lighting: string;
  materials: string;
  /** Como a identidade da marca se aplica nesta arte. */
  brandApplication: string;
  /** Porque esta direcção comunica a mensagem. Para o cliente ler. */
  rationale: string;
  /**
   * O DESIGN da peça: dois ou três recursos gráficos que fazem dela um
   * anúncio desenhado e não uma fotografia com texto por cima — como a
   * fotografia assenta no fundo, a forma da marca que liga texto e imagem,
   * a tipografia usada como elemento. Direcções antigas chegam sem isto.
   */
  graphics?: string;
  /**
   * A grelha da arte. Proposta pelo modelo; o cliente pode trocá-la na
   * revisão. Direcções de antes desta versão chegam sem ela.
   */
  layout?: LayoutId;
  /** `true` depois de o cliente trocar a grelha: a `composition` do modelo deixa de valer. */
  layoutChanged?: boolean;
  /** O que a imagem protagonista mostra. */
  subject?: ProtagonistKind;
  /**
   * O que a direcção quer ver bem executado, e quanta coisa leva.
   *
   * Guardados com a direcção para as referências poderem ser escolhidas DE
   * NOVO quando o cliente troca de ideia ou de grelha — eram escolhidas uma
   * vez, para a primeira ideia, e "Outra ideia" ficava com as referências
   * da anterior.
   */
  techniques?: VisualTechnique[];
  textDensity?: ReferenceDensity;
  elementDensity?: ReferenceDensity;
};

/**
 * Briefing estruturado (§8A).
 *
 * Separado da direcção criativa de propósito: o briefing é o que o cliente
 * QUER, a direcção é como propomos resolvê-lo. "Outra ideia" troca a
 * segunda e nunca a primeira.
 */
export type PublicationBrief = {
  /** O que a publicação tem de conseguir. */
  objective: string;
  /** A mensagem a passar. */
  message: string;
  /** Conteúdo que não pode faltar. */
  mandatory: string[];
  /** Produto ou serviço principal. */
  mainSubject: string;
  /** Produtos ou serviços de apoio. */
  supporting: string[];
  /** Chamada para acção pretendida. */
  callToAction: string;
  /**
   * Factos confirmados pelo cliente.
   *
   * Existe para separar o que foi afirmado do que seria invenção. Preços,
   * descontos, prazos e características só entram na arte se estiverem aqui.
   */
  confirmedFacts: string[];
  /** Público, quando o cliente o indicou. */
  audience: string;
  /** Restrições a respeitar. */
  constraints: string[];
};

/**
 * DOCUMENTO APROVADO da publicação (§11).
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O que o gerador recebe. Nada aqui é reinterpretado: são as decisões que o
 * cliente acabou de confirmar no ecrã de revisão.
 *
 * As versões do briefing e da identidade ficam gravadas para uma arte
 * continuar explicável depois de a marca mudar — alterar a identidade cria
 * uma versão nova e não reescreve o que já foi produzido.
 * ──────────────────────────────────────────────────────────────────────────
 */
export type ApprovedPublication = {
  briefVersion: number;
  identityVersion: number;
  style: StyleId;
  format: FormatId;
  direction: CreativeDirection;
  /** Textos exactos, tal como aprovados. */
  texts: Partial<Record<TextRole, string>>;
  /** Produtos incluídos, com o principal marcado. */
  items: Array<{ name: string; highlighted: boolean; assetId: string | null }>;
  contacts: Array<{ type: ContactType; value: string }>;
  logo: { show: boolean; placement: LogoPlacement; size: LogoSize };
  colors: BrandColors;
  constraints: string[];
  /** Referências usadas e o que foi aproveitado de cada uma. */
  references: ReferenceUsage[];
  /**
   * Campos que o cliente editou à mão.
   *
   * O gerador não os pode reescrever, e um pedido de "outra ideia" não os
   * pode apagar. É a lista que torna isso verificável em vez de confiável.
   */
  protectedDecisions: string[];
  approvedAt: string;
};
