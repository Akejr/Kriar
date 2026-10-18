/**
 * Modelos estruturados.
 *
 * Um modelo NÃO é uma imagem achatada. É um conjunto de dados que descreve
 * regras de composição, resolvido em runtime pelo motor em
 * `src/lib/composition/resolve.ts`.
 *
 * Convenções de coordenadas
 * -------------------------
 * · Caixas (`NBox`): `x`/`w` são fracções da LARGURA, `y`/`h` da ALTURA.
 * · Tamanhos de tipografia, espaçamentos e raios: fracções da LARGURA.
 *   Como todos os formatos têm 1080 px de largura, o mesmo modelo produz
 *   tipografia com o mesmo tamanho absoluto em 1080×1350, 1080×1080 e
 *   1080×1920.
 *
 * Por que grupos de fluxo (`stacks`) e não caixas fixas para texto
 * ---------------------------------------------------------------
 * A altura real de um bloco de texto só é conhecida depois de medir a fonte e
 * decidir as quebras de linha. Com caixas fixas, um título longo transbordava
 * para cima do bloco seguinte. Os grupos empilham os itens pela ordem
 * declarada e calculam a posição a partir de uma âncora, pelo que a distância
 * entre elementos é sempre respeitada. Se o grupo não couber no espaço
 * disponível, o motor reduz a tipografia até ao mínimo legível e só depois
 * avisa — nunca sobrepõe.
 */
import type { ColorToken, PaletteScheme } from '@/lib/composition/palette';
import type { FormatId, SegmentId, StyleId, TextRole } from '@/lib/domain/types';

export type NBox = { x: number; y: number; w: number; h: number };

// --- Referência criativa ----------------------------------------------------

/**
 * Objectivo de comunicação.
 *
 * Deliberadamente separado do segmento do negócio: o mesmo modelo serve
 * sectores diferentes, e a escolha deve ser feita pelo objectivo e não pelo
 * vocabulário do pedido.
 */
export type CommunicationGoal =
  | 'apresentar-opcoes'
  | 'destacar-um-produto'
  | 'incentivar-decisao'
  | 'anunciar-novidade'
  | 'promover-preco'
  | 'reforcar-confianca'
  | 'apresentar-servico';

/**
 * Capacidade de montagem.
 *
 * Existe para o modelo poder DECLARAR o que a aplicação sabe fazer. Um
 * elemento que não tenha capacidade implementada não pode ser apresentado
 * como editável nem prometido na arte final.
 */
export type TemplateCapability =
  /** Texto em camada própria, posicionado pela aplicação. */
  | 'texto-em-camada'
  /** Logótipo em camada própria, com o ficheiro original. */
  | 'logotipo-em-camada'
  /** Imagem num compartimento alinhado ao eixo. */
  | 'imagem-em-compartimento'
  /** Peças desenhadas pela aplicação: forma, cor, imagem e nome. */
  | 'pecas-desenhadas'
  /** Fundo, superfície e iluminação gerados. */
  | 'ambiente-gerado'
  /** Cena completa gerada com presença humana. */
  | 'cena-com-mao'
  /** Conteúdo mapeado numa superfície inclinada. */
  | 'perspectiva-em-superficie'
  /** Máscara para dedos ou objectos à frente do conteúdo aplicado. */
  | 'mascara-de-oclusao';

export type TemplateReference = {
  /** Caminho no disco, a partir da raiz do projecto. Nunca é servido ao browser. */
  file: string;
  /** Versão reduzida usada nas chamadas de geração. */
  payloadFile: string;
  /** Até três variações opcionais. */
  variants?: string[];
  /**
   * `true` quando a referência contém a identidade Kriar como demonstração.
   * Nesse caso a marca nunca pode passar para as artes dos clientes.
   */
  containsDemoBrand: boolean;
};

export type TemplateAssembly = {
  /** Camadas que a aplicação monta e controla ao píxel. */
  appLayers: string[];
  /** O que é produzido pelo gerador de imagem. */
  generated: string[];
  /** Capacidades implementadas nesta versão do modelo. */
  supports: TemplateCapability[];
  /**
   * Capacidades que a referência pediria mas que ainda não existem.
   * São mostradas ao utilizador: nada é prometido em silêncio.
   */
  missing: TemplateCapability[];
  /** Explicação honesta de cada limitação, em linguagem comum. */
  limitations: string[];
};

export type TemplateGeneration = {
  /** Instrução base para o gerador. Descreve ambiente, nunca texto nem marca. */
  scenePrompt: string;
  /** O que não pode aparecer na imagem gerada. */
  negative: string[];
  /** O que a IA pode adaptar livremente. */
  adaptable: string[];
  /** O que tem de ser preservado em qualquer adaptação. */
  preserve: string[];
};

// --- Peças ------------------------------------------------------------------

/**
 * Compartimento de uma peça: uma das opções apresentadas.
 *
 * As peças são desenhadas pela aplicação — forma, cor, imagem e nome — e não
 * pelo gerador. Assim os nomes saem sempre com a ortografia certa, ficam
 * editáveis e ocupam exactamente a posição aprovada.
 */
export type TemplateItemSlot = {
  id: string;
  role: 'principal' | 'complementar';
  box: NBox;
  shape: 'circulo' | 'quadrado' | 'triangulo';
  /** Cor da superfície da peça. */
  surface: ColorToken;
  /** Cor do nome sobre essa superfície. */
  onSurface: ColorToken;
  /** Raio dos cantos, fracção da largura. Ignorado em círculo e triângulo. */
  radius?: number;
  /** Ordem de desenho entre peças. */
  z: number;
  /** Tamanho do nome, fracção da largura. */
  labelSize: number;
  /**
   * Realce aplicado quando ESTA peça é a escolhida: multiplicador do tamanho
   * da caixa. A subida vertical e o alongamento da sombra derivam dele, para
   * a leitura de "é esta" se manter sem a mão da referência, que não está
   * implementada. 1 (ou ausente) significa sem realce.
   */
  lift?: number;
};

// --- Variações de composição ------------------------------------------------

/**
 * Variação de disposição dentro do mesmo modelo.
 *
 * É o que "Outra composição" percorre quando a biblioteca tem poucos modelos:
 * em vez de trocar de conceito, reorganiza o mesmo conceito.
 */
export type TemplateVariant = {
  id: string;
  label: string;
  stacks?: Record<string, Partial<Pick<TemplateStack, 'x' | 'w' | 'anchor' | 'align' | 'limit'>>>;
  itemSlots?: Record<string, Partial<Pick<TemplateItemSlot, 'box' | 'z'>>>;
  logo?: Partial<TemplateLogoSlot>;
};

export type Align = 'left' | 'center' | 'right';
export type VEdge = 'top' | 'bottom' | 'middle';

// --- Fundo ------------------------------------------------------------------

export type TemplateShape = {
  /** Necessário apenas quando o formato precisa de ajustar esta forma. */
  id?: string;
  type: 'rect' | 'ellipse';
  box: NBox;
  color: ColorToken;
  opacity?: number;
  /** Raio dos cantos como fracção da largura. */
  radius?: number;
};

export type TemplateGradient = {
  /** Necessário apenas quando o formato precisa de ajustar este gradiente. */
  id?: string;
  box: NBox;
  direction: 'to-bottom' | 'to-top' | 'to-right' | 'to-left';
  from: ColorToken;
  to: ColorToken;
  fromAlpha?: number;
  toAlpha?: number;
};

export type TemplateBackground = {
  /** Cor que cobre toda a arte. */
  base: ColorToken;
  shapes?: TemplateShape[];
  gradients?: TemplateGradient[];
  /**
   * Zona onde o fundo gerado (IA ou procedimental local) é desenhado.
   * Se ausente, este modelo não aceita fundo gerado.
   */
  generated?: {
    box: NBox;
    /** Véu sobre o fundo gerado, para o texto continuar legível. */
    scrim?: TemplateGradient;
  };
};

// --- Imagens ----------------------------------------------------------------

export type TemplateImageSlot = {
  id: string;
  box: NBox;
  /** `contain` nunca corta o produto. `cover` preenche e recorta. */
  fit: 'contain' | 'cover';
  shape?: 'rect' | 'ellipse';
  /** Raio dos cantos como fracção da largura. */
  radius?: number;
  /** 1 é a fotografia principal. */
  priority: number;
  /** Superfície desenhada atrás da imagem, útil com `contain`. */
  plate?: { color: ColorToken; radius?: number; inset?: number };
  shadow?: boolean;
  /** Etiqueta mostrada no editor. */
  label: string;
};

// --- Texto ------------------------------------------------------------------

export type TemplateTextSlot = {
  role: TextRole;
  /** `display` usa a fonte de títulos da marca; `body` a de texto corrido. */
  font: 'display' | 'body';
  /** Limitado aos pesos garantidos pelo catálogo de fontes. */
  weight: 400 | 500 | 600 | 700;
  /** Tamanho ideal, em fracção da largura. */
  size: number;
  /** Tamanho mínimo aceitável antes de avisarmos o utilizador. */
  minSize: number;
  maxLines: number;
  /** Multiplicador da altura de linha. */
  lineHeight: number;
  /** Espaçamento entre letras, em `em`. */
  tracking?: number;
  uppercase?: boolean;
  color: ColorToken;
  /** Limite aconselhado de caracteres, usado no planeamento e nos avisos. */
  maxChars: number;
  optional?: boolean;
  /** Sobrepõe o alinhamento do grupo. */
  align?: Align;
  /** Cápsula de cor atrás do texto (preço, chamada para acção). */
  pill?: {
    color: ColorToken;
    /** 0.5 = totalmente redonda nas pontas. Fracção da altura da cápsula. */
    radius: number;
    /** Fracções da largura da arte. */
    padX: number;
    padY: number;
  };
};

// --- Grupos de fluxo --------------------------------------------------------

export type TemplateStackItem =
  | { kind: 'text'; slot: TemplateTextSlot }
  | { kind: 'rule'; color: ColorToken; thickness: number; width: number }
  | { kind: 'space'; size: number };

export type TemplateStack = {
  id: string;
  /** Coluna do grupo, em fracções da largura. */
  x: number;
  w: number;
  /** Onde o grupo é ancorado verticalmente. `at` é fracção da altura. */
  anchor: { edge: VEdge; at: number };
  align: Align;
  /** Espaço entre itens, em fracção da largura. */
  gap: number;
  items: TemplateStackItem[];
  /**
   * Fronteira que o grupo não pode atravessar. Se faltar, usa as margens de
   * segurança. Define o espaço disponível para o ajuste automático.
   */
  limit?: { edge: 'top' | 'bottom'; at: number };
};

// --- Logótipo ---------------------------------------------------------------

/**
 * O logótipo é o único elemento com a altura medida em fracções da LARGURA.
 * Assim um mesmo modelo dá ao logótipo o mesmo tamanho absoluto nos três
 * formatos, sem precisar de ajustes manuais por formato.
 */
export type TemplateLogoSlot = {
  /** Fracção da largura. */
  x: number;
  /** Fracção da ALTURA. Medida a partir da aresta indicada em `vAlign`. */
  y: number;
  /** Fracção da largura. */
  w: number;
  /** Fracção da LARGURA. */
  h: number;
  align: Align;
  vAlign: VEdge;
  /**
   * Cor do fundo sobre o qual o logótipo assenta. Serve para escolher
   * automaticamente a versão clara ou escura, quando a marca as tiver.
   */
  over: ColorToken;
};

// --- Ajustes por formato ----------------------------------------------------

export type TemplateFormatOverride = {
  imageSlots?: Record<string, Partial<Pick<TemplateImageSlot, 'box' | 'fit' | 'radius'>>>;
  itemSlots?: Record<string, Partial<Pick<TemplateItemSlot, 'box' | 'labelSize' | 'lift'>>>;
  stacks?: Record<string, Partial<Pick<TemplateStack, 'x' | 'w' | 'anchor' | 'gap' | 'limit'>>>;
  /** Indexado pelo `id` do gradiente. */
  gradients?: Record<string, Partial<TemplateGradient>>;
  /** Indexado pelo `id` da forma. */
  shapes?: Record<string, Partial<TemplateShape>>;
  logo?: Partial<TemplateLogoSlot>;
  generatedBox?: NBox;
};

// --- Modelo -----------------------------------------------------------------

/**
 * Modelo da biblioteca.
 *
 * Duas metades que servem propósitos diferentes:
 *
 *  1. **Referência criativa e regras** (`reference`, `concept`, `goals`,
 *     `avoidWhen`, `generation`, `assembly`) — orientam a IA na escolha do
 *     modelo e na geração do ambiente.
 *  2. **Esqueleto renderizável** (`stacks`, `itemSlots`, `imageSlots`,
 *     `logo`, `background`) — é o que o motor desenha na prévia editável,
 *     antes de existir qualquer imagem gerada.
 *
 * A biblioteca é interna: o cliente não escolhe modelos numa galeria, e a
 * identidade presente nas referências é conteúdo de demonstração.
 */
export type Template = {
  id: string;
  /** Sobe quando as regras mudam de forma que afecte artes já criadas. */
  version: number;
  name: string;
  description: string;
  /** O que a composição comunica, em uma frase. */
  concept: string;
  goals: CommunicationGoal[];
  /** Situações em que este modelo não deve ser escolhido. */
  avoidWhen: string[];
  reference: TemplateReference;
  assembly: TemplateAssembly;
  generation: TemplateGeneration;

  segments: SegmentId[];
  styles: StyleId[];
  formats: FormatId[];
  /** Quantidade de peças suportada. */
  itemRange: { min: number; max: number };
  textDensity: 'baixa' | 'media' | 'alta';

  scheme: PaletteScheme;
  /** Margens de segurança. Nenhum elemento legível entra nesta zona. */
  safeMargin: { x: number; y: number };
  background: TemplateBackground;
  imageSlots: TemplateImageSlot[];
  itemSlots: TemplateItemSlot[];
  stacks: TemplateStack[];
  logo: TemplateLogoSlot;
  variants: TemplateVariant[];
  overridesByFormat?: Partial<Record<FormatId, TemplateFormatOverride>>;
};

/** Reúne todos os `TemplateTextSlot` de um modelo, indexados por papel. */
export function textSlotsOf(template: Template): Map<TextRole, TemplateTextSlot> {
  const out = new Map<TextRole, TemplateTextSlot>();
  for (const stack of template.stacks) {
    for (const item of stack.items) {
      if (item.kind === 'text') out.set(item.slot.role, item.slot);
    }
  }
  return out;
}

/** Aplica uma variação de disposição, devolvendo um modelo novo. */
export function applyVariant(template: Template, variantId: string | null): Template {
  if (!variantId) return template;
  const variant = template.variants.find((item) => item.id === variantId);
  if (!variant) return template;

  return {
    ...template,
    stacks: template.stacks.map((stack) => {
      const patch = variant.stacks?.[stack.id];
      return patch ? { ...stack, ...patch } : stack;
    }),
    itemSlots: template.itemSlots.map((slot) => {
      const patch = variant.itemSlots?.[slot.id];
      return patch ? { ...slot, ...patch } : slot;
    }),
    logo: variant.logo ? { ...template.logo, ...variant.logo } : template.logo,
  };
}

/** Aplica os ajustes do formato pedido, devolvendo um modelo novo. */
export function applyFormatOverride(template: Template, format: FormatId): Template {
  const override = template.overridesByFormat?.[format];
  if (!override) return template;

  const imageSlots = template.imageSlots.map((slot) => {
    const patch = override.imageSlots?.[slot.id];
    return patch ? { ...slot, ...patch } : slot;
  });

  const itemSlots = template.itemSlots.map((slot) => {
    const patch = override.itemSlots?.[slot.id];
    return patch ? { ...slot, ...patch } : slot;
  });

  const stacks = template.stacks.map((stack) => {
    const patch = override.stacks?.[stack.id];
    return patch ? { ...stack, ...patch } : stack;
  });

  const background: TemplateBackground = {
    ...template.background,
    shapes: template.background.shapes?.map((shape) => {
      const patch = shape.id ? override.shapes?.[shape.id] : undefined;
      return patch ? { ...shape, ...patch } : shape;
    }),
    gradients: template.background.gradients?.map((gradient) => {
      const patch = gradient.id ? override.gradients?.[gradient.id] : undefined;
      return patch ? { ...gradient, ...patch } : gradient;
    }),
    generated:
      override.generatedBox && template.background.generated
        ? { ...template.background.generated, box: override.generatedBox }
        : template.background.generated,
  };

  return {
    ...template,
    background,
    imageSlots,
    itemSlots,
    stacks,
    logo: override.logo ? { ...template.logo, ...override.logo } : template.logo,
  };
}
