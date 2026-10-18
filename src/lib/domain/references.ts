/**
 * Biblioteca de REFERÊNCIAS VISUAIS.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Uma referência demonstra QUALIDADES: iluminação, profundidade, hierarquia,
 * integração entre texto e imagem, acabamento. Não é uma composição a
 * reproduzir.
 *
 * Esta distinção é a razão de este ficheiro existir. Antes havia "modelos",
 * e um modelo trazia a referência mais coordenadas fixas, slots de texto e
 * instruções de preservação — tudo tratado como obrigatório. Com uma única
 * referência activa, que mostrava um jogo do galo, o sistema produzia jogos
 * do galo: a imagem ia como "segue esta estrutura de perto" e o
 * `scenePrompt` descrevia a cena dela por palavras.
 *
 * O que uma referência dá:
 *   · características de qualidade e acabamento;
 *   · situações em que ajuda;
 *   · e, explicitamente, o que NÃO deve ser transferido.
 *
 * O que uma referência nunca dá:
 *   · o tema da publicação;
 *   · os objectos da cena;
 *   · informação comercial;
 *   · a identidade de outra empresa.
 *
 * O pedido e a marca determinam a criação. A referência orienta o cuidado.
 * ──────────────────────────────────────────────────────────────────────────
 */
import type { LayoutId, ProtagonistKind } from './direction';
import type { StyleId, VisualTrait } from './types';

/**
 * Estado de uma referência.
 *
 * `pendente` é o estado inicial de tudo o que é analisado automaticamente: a
 * análise é uma sugestão, e só entra em uso depois de um humano a revelar
 * correcta. Tratar a saída de um modelo de visão como verdade aprovada era
 * deixar a biblioteca descrever mal as próprias imagens.
 */
export type ReferenceStatus = 'pendente' | 'aprovada' | 'inactiva';

/** Grau de densidade, usado para texto e para elementos. */
export type ReferenceDensity = 'baixa' | 'media' | 'alta';

/**
 * Técnica visual demonstrada.
 *
 * Vocabulário fechado de propósito: é por aqui que a recuperação filtra, e
 * uma lista livre tornava a filtragem impossível.
 */
export type VisualTechnique =
  | 'integracao-pessoa-elemento'
  | 'profundidade-por-sobreposicao'
  | 'materiais-transparentes'
  | 'metafora-visual'
  | 'ponto-de-atencao-unico'
  | 'espaco-livre-para-texto'
  | 'organizacao-modular'
  | 'agrupamento-por-categoria'
  | 'hierarquia-tipografica-forte'
  | 'recurso-de-destaque'
  | 'equilibrio-entre-entidades'
  | 'movimento-implicito'
  | 'iluminacao-dramatica'
  | 'iluminacao-controlada'
  | 'contraste-alto'
  | 'presenca-humana'
  | 'produto-em-contexto'
  | 'escala-tipografica-dominante';

/**
 * Adequação ao uso da própria IMAGEM como referência numa geração.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Não é o mesmo que estar aprovada. Uma referência pode ser excelente como
 * descrição e perigosa como imagem: quanto mais reconhecível for a cena, as
 * marcas ou as personagens que contém, maior o risco de o gerador as
 * arrastar para a arte do cliente.
 *
 * `nunca` não desvaloriza a referência — significa que o seu valor se
 * transmite melhor por palavras.
 * ────────────────────────────────────────────────────────────────────────
 */
export type ReferenceDirectUse = 'segura' | 'com-cuidado' | 'nunca';

/** De onde veio a descrição de uma referência. */
export type ReferenceAnalysisSource = 'semente' | 'ia' | 'administrador';

export type ReferenceAnalysis = {
  source: ReferenceAnalysisSource;
  /** Modelo que produziu a análise automática, quando foi o caso. */
  model: string | null;
  at: string;
  /** `true` quando um administrador corrigiu a análise automática. */
  editedByAdmin: boolean;
};

export type VisualReference = {
  /**
   * Identificador estável.
   *
   * NÃO representa ordem de qualidade nem prioridade. `ref1` não é melhor
   * do que `ref9`, e a selecção nunca usa o número para desempatar.
   */
  id: string;
  name: string;
  /** Caminho do original no disco, a partir da raiz. Nunca servido ao browser. */
  file: string;
  /** Versão reduzida, a única enviada nas chamadas de geração. */
  payloadFile: string;
  /** Sobe quando a descrição muda de forma que afecte a recuperação. */
  version: number;
  status: ReferenceStatus;

  /** O que se vê na imagem, em linguagem comum. */
  content: string;

  styles: StyleId[];
  traits: VisualTrait[];
  techniques: VisualTechnique[];

  textDensity: ReferenceDensity;
  elementDensity: ReferenceDensity;

  /**
   * A grelha desta arte e o que a imagem protagonista mostra.
   *
   * É por aqui que a escolha encontra as referências PARECIDAS com a ideia
   * aprovada: uma ideia com o texto à esquerda e uma pessoa à direita
   * aprende mais com uma arte assim do que com três dispositivos centrados.
   */
  layouts: LayoutId[];
  subjects: ProtagonistKind[];

  hierarchy: string;
  contrast: string;
  lighting: string;
  depth: string;
  typography: string;
  whitespace: string;
  textImageIntegration: string;

  /** Qualidades que vale a pena aproveitar. */
  strengths: string[];
  /** Limitações honestas desta imagem como referência. */
  limitations: string[];
  /** Situações de pedido em que esta referência ajuda. */
  helpfulWhen: string[];
  /**
   * Conteúdos concretos que NUNCA devem passar para a arte do cliente.
   *
   * É o campo que impede o sistema de repetir o tabuleiro, a mão, as marcas
   * de streaming ou as personagens. Entra no prompt como proibição
   * explícita, não como sugestão.
   */
  doNotTransfer: string[];
  /**
   * "Cuidados" desta referência: restrições de conteúdo e de qualidade que
   * têm de acompanhar o uso dela.
   *
   * Não repete `doNotTransfer`. Aquele campo lista OBJECTOS que não passam
   * para a arte; este diz como usar a referência sem inventar nada — por
   * exemplo "usar apenas benefícios reais fornecidos pelo cliente". Entra no
   * prompt da imagem ao lado da referência, como instrução.
   */
  cautions?: string[];
  /**
   * Sectores retratados na imagem (desporto, alimentação, electrónica...).
   *
   * Informação AUXILIAR, para quem revê a biblioteca. NUNCA limita a
   * selecção: uma referência de desporto pode orientar uma arte de formação,
   * e é o que ela demonstra — luz, hierarquia, acabamento — que decide, não
   * o sector de onde veio.
   */
  sectors?: string[];

  directUse: ReferenceDirectUse;
  analysis: ReferenceAnalysis;

  /**
   * Metadados do antigo sistema de modelos.
   *
   * Preservados por serem descritivos e por projectos antigos os
   * referenciarem. NUNCA são impostos a uma criação nova: ver secção 3 da
   * especificação — coordenadas podem continuar como descrição, não como
   * imposição.
   */
  legacy?: {
    templateId?: string;
    note?: string;
  };
};

/** A referência pode entrar numa geração? */
export function isUsable(reference: VisualReference): boolean {
  return reference.status === 'aprovada';
}

/**
 * Como uma referência vai ser aproveitada numa publicação concreta.
 *
 * Registado por publicação, não por referência: a mesma imagem serve
 * propósitos diferentes em pedidos diferentes. É também o que permite
 * diagnosticar resultados repetitivos — sem este registo, "porque é que
 * saiu outro tabuleiro?" não tem resposta.
 */
export type ReferenceUsage = {
  referenceId: string;
  /** Características aproveitadas, em palavras do pedido actual. */
  take: string[];
  /** Conteúdos que não devem ser transferidos. */
  doNotTransfer: string[];
  /** `descricao` envia só palavras; `imagem` anexa o ficheiro reduzido. */
  mode: 'descricao' | 'imagem';
  /**
   * Porque foi escolhida PARA ESTA publicação: o que a pontuação viu — a
   * mesma grelha, o mesmo protagonista, as técnicas da ideia, o estilo.
   *
   * Com `take`, é a resposta a "que princípio aproveitou esta arte, e
   * porquê?" sem reproduzir a cena original. Nunca vai para o gerador.
   */
  why?: string;
};
