/**
 * Proposta de identidade sem IA.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Não finge ser IA. Deriva um sistema visual coerente das cores que o
 * cliente deu (ou das que foram extraídas do logótipo) usando as mesmas
 * funções de contraste que o motor de artes usa — `ensureContrast`,
 * `bestTextOn`, `deriveAccent`. O resultado é legível por construção, mas é
 * aritmética, não direcção criativa, e a interface diz isso.
 *
 * Serve dois casos: nenhum fornecedor configurado, e resposta da IA que não
 * passa a validação. Nos dois o cliente fica com uma proposta utilizável em
 * vez de um ecrã de erro.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { DEFAULT_BODY_FONT, type FontId } from '@/lib/fontCatalog';
import type { SegmentId, VisualPreference } from '@/lib/domain/types';
import {
  bestTextOn,
  darken,
  ensureContrast,
  isLight,
  lighten,
  mix,
  safeHex,
} from '@/lib/utils/color';
import type { IdentityProposal } from '@/lib/ai/identitySchema';

export type FallbackInput = {
  company: { name: string; segment: SegmentId; description: string };
  colors: { primary?: string; secondary?: string; accent?: string | null };
  extractedColors: string[];
  visualPreference: VisualPreference | null;
  constraints: string;
  hasLogo: boolean;
  /**
   * Claro ou escuro, lido dos píxeis do ficheiro.
   *
   * Decide o tom do material no briefing da folha de identidade: o logótipo
   * é aplicado sem mudar de cor, logo as peças têm de contrastar com ele.
   */
  logoTone?: 'claro' | 'escuro' | null;
};

/** Tipografia por preferência visual. Escolhas do catálogo, não inventadas. */
const FONTS_BY_PREFERENCE: Record<VisualPreference, { display: FontId; body: FontId }> = {
  minimalista: { display: 'manrope', body: 'inter' },
  elegante: { display: 'playfair', body: 'inter' },
  moderno: { display: 'grotesk', body: 'inter' },
  institucional: { display: 'jakarta', body: 'inter' },
  vibrante: { display: 'poppins', body: 'inter' },
};

const FONTS_BY_SEGMENT: Record<SegmentId, { display: FontId; body: FontId }> = {
  restaurantes: { display: 'playfair', body: 'inter' },
  beleza: { display: 'playfair', body: 'inter' },
  lojas: { display: 'poppins', body: 'inter' },
  servicos: { display: 'jakarta', body: 'inter' },
  outro: { display: 'manrope', body: DEFAULT_BODY_FONT },
};

export function buildFallbackProposal(input: FallbackInput): IdentityProposal {
  const extracted = input.extractedColors.map((hex) => safeHex(hex, ''));
  const usable = extracted.filter(Boolean);

  const primary = safeHex(input.colors.primary ?? usable[0] ?? '', '#16324F');

  // Sem secundária, o complemento vem do tom da principal: logótipo escuro
  // pede branco, logótipo claro pede um preto suave.
  const secondary = safeHex(
    input.colors.secondary ?? usable[1] ?? '',
    isLight(primary) ? '#10141A' : '#FFFFFF',
  );

  /*
    Terceira cor só quando existe base.
    Sem ela a paleta fica com duas cores, que é o caso comum e honesto.
  */
  const accentSource = input.colors.accent ?? usable[2] ?? '';
  const accent = accentSource ? safeHex(accentSource, accentSource) : null;

  // Fundos e textos derivados com contraste garantido.
  const bgLight = mix(primary, '#FFFFFF', 0.92);
  const bgDark = mix(primary, '#0A0B0D', 0.74);
  const textOnLight = ensureContrast(bestTextOn(bgLight), bgLight, 7);
  const textOnDark = ensureContrast(bestTextOn(bgDark), bgDark, 7);
  const neutral = isLight(bgLight) ? darken(bgLight, 0.1) : lighten(bgDark, 0.12);

  const fonts =
    (input.visualPreference ? FONTS_BY_PREFERENCE[input.visualPreference] : null) ??
    FONTS_BY_SEGMENT[input.company.segment];

  return {
    // Sem base para uma assinatura, não inventamos uma.
    tagline: '',

    colors: [
      {
        role: 'primary',
        hex: primary,
        label: 'Principal',
        usage: 'Títulos, botões e elementos de destaque',
      },
      {
        role: 'secondary',
        hex: secondary,
        label: 'Secundária',
        usage: 'Superfícies de apoio e separadores',
      },
      ...(accent
        ? [
            {
              role: 'accent' as const,
              hex: accent,
              label: 'Terceira',
              usage: 'Realces pontuais e chamadas para acção',
            },
          ]
        : []),
      {
        role: 'bgLight',
        hex: bgLight,
        label: 'Fundo claro',
        usage: 'Publicações de fundo claro',
      },
      {
        role: 'bgDark',
        hex: bgDark,
        label: 'Fundo escuro',
        usage: 'Publicações de fundo escuro',
      },
      {
        role: 'textOnLight',
        hex: textOnLight,
        label: 'Texto sobre claro',
        usage: 'Leitura corrida em fundos claros',
      },
      {
        role: 'textOnDark',
        hex: textOnDark,
        label: 'Texto sobre escuro',
        usage: 'Leitura corrida em fundos escuros',
      },
      {
        role: 'neutral',
        hex: neutral,
        label: 'Neutro',
        usage: 'Linhas, molduras e áreas calmas',
      },
    ],

    typography: {
      display: fonts.display,
      body: fonts.body,
      rationale: input.visualPreference
        ? `Escolhida a partir da preferência ${input.visualPreference}.`
        : 'Escolhida a partir da actividade da empresa.',
    },

    /*
      Escala de proporção 1.5 a partir de 28 px.

      Não é direcção criativa, é aritmética — e é por isso que a interface
      diz "derivada por regras locais". Uma escala bem proporcionada parece
      sempre melhor do que tamanhos escolhidos a olho, mas não substitui
      alguém a decidir a voz da marca.
    */
    typeScale: [
      {
        id: 'display',
        label: 'Display',
        font: 'display' as const,
        sizePx: 94,
        weight: 700 as const,
        lineHeight: 1.02,
        tracking: -0.02,
        uppercase: false,
        usage: 'Frase principal de uma publicação',
      },
      {
        id: 'titulo',
        label: 'Título',
        font: 'display' as const,
        sizePx: 56,
        weight: 600 as const,
        lineHeight: 1.1,
        tracking: -0.01,
        uppercase: false,
        usage: 'Títulos secundários e destaques',
      },
      {
        id: 'corpo',
        label: 'Corpo',
        font: 'body' as const,
        sizePx: 28,
        weight: 400 as const,
        lineHeight: 1.5,
        tracking: 0,
        uppercase: false,
        usage: 'Texto de apoio e descrições',
      },
      {
        id: 'rotulo',
        label: 'Rótulo',
        font: 'body' as const,
        sizePx: 18,
        weight: 600 as const,
        lineHeight: 1.2,
        tracking: 0.09,
        uppercase: true,
        usage: 'Etiquetas, categorias e contactos',
      },
    ],

    visualPrompts: buildFallbackVisualPrompts(input),

    logoRules: {
      minWidthPx: 96,
      clearSpaceRatio: 0.25,
      // Sem análise do ficheiro não afirmamos que funciona nos dois fundos.
      worksOnLight: true,
      worksOnDark: false,
      needsBackdropOn: input.hasLogo ? 'escuro' : 'nenhum',
      preferredPlacements: ['inferior-direito', 'superior-esquerdo'],
    },

    backgrounds: [
      {
        id: 'claro',
        label: 'Claro',
        description: 'Fundo liso na cor clara da marca, para produtos e texto escuro.',
        hexes: [bgLight, secondary],
      },
      {
        id: 'escuro',
        label: 'Escuro',
        description: 'Fundo profundo derivado da cor principal, para contraste e destaque.',
        hexes: [bgDark, primary],
      },
      {
        id: 'textura',
        label: 'Textura discreta',
        description: 'A mesma base com uma textura leve, para dar matéria sem roubar atenção.',
        hexes: [mix(bgLight, neutral, 0.2), neutral],
      },
    ],

    graphics: {
      cornerRadius: input.visualPreference === 'institucional' ? 'recto' : 'suave',
      shadow: input.visualPreference === 'minimalista' ? 'nenhuma' : 'discreta',
      lineWeight: 'fina',
      decoration:
        input.visualPreference === 'vibrante'
          ? 'moderada'
          : input.visualPreference === 'minimalista'
            ? 'minima'
            : 'moderada',
      notes: 'Formas simples, espaço livre generoso, sem molduras decorativas.',
    },

    composition: {
      logoPlacement: 'inferior-direito',
      hierarchy:
        'Título em primeiro lugar, produto a seguir, chamada para acção no fim. Um só elemento domina cada publicação.',
      margins: 'Margem livre equivalente a um décimo da largura em todos os lados.',
      contacts: 'Uma linha discreta no rodapé, só com os canais escolhidos para a publicação.',
      price:
        'Destacado apenas quando for a mensagem, dentro de uma cápsula na cor de realce.',
    },

    direction: {
      lighting: 'Luz suave e direccional, de cima e de lado, com sombras curtas.',
      framing: 'Enquadramento limpo, com o produto ligeiramente fora do centro.',
      photoTreatment: 'Cores fiéis ao produto, contraste moderado, sem filtros marcados.',
      decorationLevel: 'Cenários simples. O produto é o assunto.',
      tone: 'Directo e próximo, a tratar o cliente por tu.',
      avoid: ['molduras decorativas', 'texto sobre zonas com muito detalhe'],
    },

    fixedRules: [
      'O ficheiro do logótipo é usado como está. Não é redesenhado nem recolorido.',
      ...(input.constraints.trim() ? [`Pedido do cliente: ${input.constraints.trim()}`] : []),
    ],

    logoReading: {
      description: '',
      colors: usable.slice(0, 3),
      // Sem fornecedor não houve leitura do ficheiro. Dizê-lo é o mínimo.
      unreadable: true,
    },
  };
}

/**
 * Briefings dos visuais, sem IA.
 *
 * São descrições de cenário por segmento. Servem para a geração de imagem
 * ter por onde começar quando o modelo de texto não está disponível — a
 * imagem em si continua a ser gerada por IA, é só o briefing que é nosso.
 */
function buildFallbackVisualPrompts(input: FallbackInput): IdentityProposal['visualPrompts'] {
  const material = MATERIAL_BY_SEGMENT[input.company.segment];
  const surface = SURFACE_BY_SEGMENT[input.company.segment];

  /*
    O tom das peças acompanha o do logótipo, ao contrário.

    Sem isto o briefing pedia "superfície clara" e "superfície escura" sem
    olhar ao ficheiro, e saía um logótipo escuro sobre material escuro — a
    peça onde a marca não se lê.
  */
  const pecas =
    input.logoTone === 'claro'
      ? 'em tons profundos e uniformes, para o logótipo claro se ler'
      : 'em papel cru e tons de creme claro, para o logótipo escuro se ler';

  return {
    identidade: `Fotografia de estúdio do material de marca desta empresa: ${material}, ${pecas}. As peças assentam sobre ${surface}, dispostas em diagonal com espaço livre entre elas e uma delas ligeiramente sobreposta à outra. Vista em ângulo de trinta graus. Luz direccional de cima e da esquerda, sombras curtas e definidas, grão do papel visível na luz rasante. Acabamento mate com relevo seco no logótipo. Composição arrumada, com uma zona vazia a respirar num dos cantos.`,
  };
}

/** Material de marca plausível por actividade. */
const MATERIAL_BY_SEGMENT: Record<SegmentId, string> = {
  restaurantes: 'menu, guardanapo, embalagem de take-away e cartões de visita',
  beleza: 'embalagem de produto, cartões de visita, saco de papel e etiqueta',
  lojas: 'saco de compras, etiqueta de preço, cartões de visita e caixa',
  servicos: 'papel de carta, envelope, cartões de visita e pasta de documentos',
  outro: 'cartões de visita, papel de carta, envelope e crachá',
};

const SURFACE_BY_SEGMENT: Record<SegmentId, string> = {
  restaurantes: 'uma mesa de madeira clara',
  beleza: 'uma bancada de pedra lisa',
  lojas: 'uma superfície de estúdio neutra',
  servicos: 'uma secretária arrumada',
  outro: 'uma superfície de estúdio neutra',
};
