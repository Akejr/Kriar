import { cta, contacts, headline, rule, subheadline, text } from './helpers';
import type { Template } from './types';

/**
 * Modelo 02 — A próxima jogada
 *
 * Conceito: uma escolha em curso. Opções dispostas num suporte, uma delas em
 * destaque. A referência usa um tabuleiro e uma mão, mas o cenário não é
 * obrigatório: o modelo é uma família de composições sobre escolha,
 * possibilidades e próximo passo.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O QUE ESTA VERSÃO FAZ, E O QUE NÃO FAZ
 *
 * As peças são desenhadas pela APLICAÇÃO — forma, cor, imagem e nome. Não são
 * pedidas ao gerador. Três razões:
 *
 *   · os nomes saem com a ortografia correcta, em português;
 *   · ficam editáveis depois da geração, sem refazer a imagem;
 *   · ocupam exactamente a posição que o cliente aprovou.
 *
 * Ao gerador pedimos apenas o ambiente: superfície, luz e sombras.
 *
 * A mão da referência NÃO está implementada. Para uma mão gerada segurar uma
 * peça desenhada pela aplicação seria preciso mapeamento em perspectiva e
 * máscaras de oclusão para os dedos, e nenhuma das duas existe. Em vez de
 * fingir, a peça em destaque é elevada e ganha sombra mais longa — a leitura
 * de "esta é a escolhida" mantém-se. Está declarado em `assembly.missing`.
 * ──────────────────────────────────────────────────────────────────────────
 */
export const modelo02ProximaJogada: Template = {
  id: 'modelo-02-proxima-jogada',
  version: 1,
  name: 'A próxima jogada',
  description: 'Opções dispostas num suporte, com uma delas em destaque.',
  concept:
    'Uma escolha em curso: várias opções à vista e uma em destaque, para o cliente perceber que há um próximo passo a dar.',

  goals: ['apresentar-opcoes', 'destacar-um-produto', 'incentivar-decisao', 'apresentar-servico'],

  avoidWhen: [
    'O pedido exige muito texto, condições detalhadas ou letras pequenas.',
    'O pedido é um catálogo extenso, com mais de cinco artigos.',
    'Há um só produto e nenhuma ideia de escolha entre alternativas.',
    'O preço é a mensagem central e tem de dominar a arte.',
  ],

  reference: {
    file: 'src/modelos/modelo-02-proxima-jogada.webp',
    payloadFile: 'src/modelos/modelo-02-proxima-jogada.ref.webp',
    // A referência mostra a identidade Kriar: é demonstração e nunca passa
    // para as artes dos clientes.
    containsDemoBrand: true,
  },

  /**
   * ACTUALIZADO depois da passagem a geração completa.
   *
   * As três limitações declaradas antes — `cena-com-mao`,
   * `perspectiva-em-superficie`, `mascara-de-oclusao` — existiam porque a
   * aplicação desenhava as peças e não conseguia encaixá-las numa cena
   * fotográfica. Com a arte inteira a sair do gerador, e a referência enviada
   * como imagem, as três deixaram de ser limitações: a mão aparece, os nomes
   * assentam na superfície em perspectiva e a oclusão dos dedos é correcta.
   *
   * Deixar limitações desactualizadas na interface é tão desonesto como
   * esconder as que existem.
   */
  assembly: {
    appLayers: [
      'logótipo do cliente, no ficheiro original',
      'linha de contactos, com os valores exactos',
    ],
    generated: [
      'cena completa, com produtos e encenação',
      'títulos, subtítulo e chamada para acção',
      'superfície, ambiente, iluminação e sombras',
    ],
    supports: [
      'texto-em-camada',
      'logotipo-em-camada',
      'ambiente-gerado',
      'cena-com-mao',
      'perspectiva-em-superficie',
      'mascara-de-oclusao',
    ],
    missing: [],
    limitations: [
      'O texto faz parte da imagem gerada. Corrigir uma palavra obriga a gerar a arte outra vez — é por isso que existe o ecrã de revisão antes de gerar.',
      'Cada geração é diferente da anterior, mesmo com os mesmos dados. Não há como repetir exactamente uma arte já produzida.',
      // Actualizado: os acabamentos colados por cima saíram. O texto
      // anterior prometia um interruptor que já não existe.
      'O logótipo e os contactos fazem parte da arte gerada. Cada arte é verificada antes de ser mostrada, e quando o logótipo sai errado é gerada outra vez com a correcção.',
    ],
  },

  generation: {
    scenePrompt: [
      'superfície de apoio limpa vista em ligeiro ângulo, para apresentar objectos',
      'luz suave e direccional de cima à esquerda, sombras longas e discretas',
      'zona superior esquerda calma e sem detalhe, reservada para texto',
      'profundidade de campo curta, fundo desfocado',
      'acabamento fotográfico, publicitário, tridimensional',
    ].join(', '),
    negative: [
      'texto',
      'letras',
      'números',
      'logótipos',
      'marcas de água',
      'pessoas',
      'mãos',
      'peças de jogo',
      'tabuleiros',
      'objectos em primeiro plano ao centro',
    ],
    adaptable: [
      'tipo de suporte: mesa, bancada, vitrine, prateleira, bandeja ou expositor',
      'ambiente: estúdio, loja, escritório, cozinha ou outro contexto do negócio',
      'materiais e acabamento da superfície',
      'fundo claro ou escuro, conforme a identidade do cliente',
      'direcção e temperatura da luz',
      'lado do bloco de texto e disposição das peças',
    ],
    preserve: [
      'uma opção principal claramente reconhecível',
      'alternativas que apoiem a mensagem sem competir com o destaque',
      'espaço livre suficiente para o texto e a marca',
      'coerência de escala, perspectiva, luz e sombras',
      'fidelidade aos produtos, logótipos e informações fornecidos',
    ],
  },

  segments: ['restaurantes', 'beleza', 'lojas', 'servicos', 'outro'],
  /*
    Estilos actualizados para o catálogo novo.

    Este modelo deixou de ser autoridade criativa — é o esqueleto do motor de
    composição local, usado no recurso sem chave de IA e nas miniaturas de
    rascunho. A lista existe para `allowedTemplatesFor` continuar a devolver
    um candidato em qualquer estilo.
  */
  styles: ['auto', 'clean', 'elegante', 'vibrante', 'tecnologico', 'cinematografico'],
  /*
    Serve todos os formatos.

    Este modelo entra na geração como referência de COMPOSIÇÃO e como
    descrição de cena — encenação, luz, hierarquia. Nada disso é próprio de
    uma proporção, e o gerador produz na proporção que lhe pedimos. Não
    declarar um formato aqui não o tornava mais seguro: deixava
    `allowedTemplatesFor` sem candidatos e o planeamento falhava.
  */
  formats: ['vertical', 'quadrado', 'story', 'reels', 'linkedin', 'horizontal'],
  itemRange: { min: 3, max: 5 },
  textDensity: 'baixa',

  scheme: 'neutral',
  safeMargin: { x: 0.075, y: 0.042 },

  background: {
    base: 'bg',
    generated: {
      box: { x: 0, y: 0, w: 1, h: 1 },
      scrim: {
        box: { x: 0, y: 0, w: 1, h: 0.42 },
        direction: 'to-bottom',
        from: 'bg',
        to: 'bg',
        fromAlpha: 0.82,
        toAlpha: 0,
      },
    },
  },

  // Sem compartimentos de fotografia livres: neste modelo as imagens do
  // cliente entram nas superfícies das peças.
  imageSlots: [],

  /**
   * Cinco peças, como na referência: uma principal e quatro complementares.
   * A distribuição adapta-se à quantidade real — ver `assignItems` no motor,
   * que nunca duplica conteúdo para preencher espaços.
   */
  itemSlots: [
    {
      id: 'principal',
      role: 'principal',
      box: { x: 0.5, y: 0.355, w: 0.3, h: 0.24 },
      shape: 'triangulo',
      surface: 'accent',
      onSurface: 'onAccent',
      z: 5,
      labelSize: 0.028,
      lift: 1.1,
    },
    {
      id: 'alt-1',
      role: 'complementar',
      box: { x: 0.17, y: 0.405, w: 0.22, h: 0.176 },
      shape: 'circulo',
      surface: 'primary',
      onSurface: 'onPrimary',
      z: 3,
      labelSize: 0.023,
    },
    {
      id: 'alt-2',
      role: 'complementar',
      box: { x: 0.43, y: 0.56, w: 0.21, h: 0.168 },
      shape: 'quadrado',
      surface: 'panel',
      onSurface: 'onPanel',
      radius: 0.028,
      z: 2,
      labelSize: 0.023,
    },
    {
      id: 'alt-3',
      role: 'complementar',
      box: { x: 0.17, y: 0.67, w: 0.25, h: 0.2 },
      shape: 'triangulo',
      surface: 'secondary',
      onSurface: 'onSecondary',
      z: 1,
      labelSize: 0.023,
    },
    {
      id: 'alt-4',
      role: 'complementar',
      box: { x: 0.65, y: 0.675, w: 0.22, h: 0.176 },
      shape: 'circulo',
      surface: 'primary',
      onSurface: 'onPrimary',
      z: 4,
      labelSize: 0.023,
    },
  ],

  stacks: [
    {
      id: 'mensagem',
      x: 0.075,
      w: 0.6,
      anchor: { edge: 'top', at: 0.105 },
      align: 'left',
      gap: 0.016,
      limit: { edge: 'bottom', at: 0.68 },
      items: [
        text(
          headline({
            size: 0.082,
            minSize: 0.05,
            maxLines: 3,
            lineHeight: 1.04,
            maxChars: 56,
            color: 'onBg',
          }),
        ),
        text(subheadline({ size: 0.027, maxChars: 90, maxLines: 2 })),
        rule('accent', 0.005, 0.07),
      ],
    },
    {
      id: 'acao',
      x: 0.22,
      w: 0.56,
      anchor: { edge: 'bottom', at: 0.048 },
      align: 'center',
      gap: 0.01,
      items: [
        text(
          cta({
            size: 0.025,
            uppercase: false,
            tracking: 0.01,
            color: 'onPanel',
            pill: { color: 'panel', radius: 0.5, padX: 0.045, padY: 0.024 },
          }),
        ),
      ],
    },
    {
      id: 'contactos',
      x: 0.075,
      w: 0.85,
      anchor: { edge: 'bottom', at: 0.012 },
      align: 'center',
      gap: 0.004,
      items: [text(contacts({ maxLines: 1, size: 0.018 }))],
    },
  ],

  logo: { x: 0.075, y: 0.042, w: 0.21, h: 0.05, align: 'left', vAlign: 'top', over: 'bg' },

  /**
   * Variações de disposição. "Outra composição" percorre-as, porque com uma
   * biblioteca pequena reorganizar o conceito é mais útil do que trocá-lo.
   */
  variants: [
    { id: 'texto-esquerda', label: 'Texto à esquerda' },
    {
      id: 'texto-direita',
      label: 'Texto à direita',
      stacks: {
        mensagem: { x: 0.325, w: 0.6, align: 'right' },
      },
      itemSlots: {
        principal: { box: { x: 0.2, y: 0.355, w: 0.3, h: 0.24 } },
        'alt-1': { box: { x: 0.61, y: 0.405, w: 0.22, h: 0.176 } },
        'alt-2': { box: { x: 0.36, y: 0.56, w: 0.21, h: 0.168 } },
        'alt-3': { box: { x: 0.58, y: 0.67, w: 0.25, h: 0.2 } },
        'alt-4': { box: { x: 0.13, y: 0.675, w: 0.22, h: 0.176 } },
      },
      logo: { x: 0.925, align: 'right' },
    },
    {
      id: 'texto-centrado',
      label: 'Texto centrado',
      stacks: {
        mensagem: { x: 0.12, w: 0.76, align: 'center' },
      },
      logo: { x: 0.5, align: 'center' },
    },
  ],

  overridesByFormat: {
    quadrado: {
      stacks: {
        mensagem: { anchor: { edge: 'top', at: 0.09 }, limit: { edge: 'bottom', at: 0.66 } },
      },
    },
    story: {
      stacks: {
        mensagem: { anchor: { edge: 'top', at: 0.13 }, limit: { edge: 'bottom', at: 0.62 } },
        acao: { anchor: { edge: 'bottom', at: 0.1 } },
        contactos: { anchor: { edge: 'bottom', at: 0.062 } },
      },
      logo: { y: 0.075 },
    },
  },
};
