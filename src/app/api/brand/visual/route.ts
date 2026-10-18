import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveImageProvider } from '@/lib/ai/providers/image';
import { formatEnum } from '@/lib/ai/schema';
import { describeColor } from '@/lib/composition/palette';
import { prepareLogoReference } from '@/lib/server/logoReference';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// O mesmo gerador das publicações, com o mesmo minuto e meio por imagem.
// Ver `maxDuration` em `/api/ai/artwork`.
export const maxDuration = 300;

/**
 * Geração da FOLHA DE IDENTIDADE VISUAL.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * A única imagem gerada na identidade da marca.
 *
 * Eram quatro — esta, o logótipo sobre claro, o logótipo sobre escuro e uma
 * textura de fundo. As aplicações do logótipo passaram a ser desenhadas pela
 * aplicação com o ficheiro real sobre as cores da paleta, que é instantâneo,
 * de graça e mostra o contraste verdadeiro; a textura saiu porque as cores
 * acompanham a empresa como DADOS e chegam à geração de cada publicação em
 * palavras, sem precisarem de um ficheiro a ilustrá-las.
 *
 * O ficheiro do logótipo vai sempre como referência de imagem. É o que faz
 * aparecer o logótipo REAL do cliente em vez de um símbolo inventado, e é
 * também a razão de esta rota existir em vez de reutilizar
 * `/api/ai/artwork`: aqui não há textos, nem produtos, nem modelo de
 * composição — só o logótipo e uma cena.
 * ──────────────────────────────────────────────────────────────────────────
 */

const requestSchema = z.object({
  kind: z.literal('identidade').default('identidade'),
  /**
   * Instrução escrita pelo modelo de texto, revista pelo cliente.
   *
   * O limite acompanha o do esquema da proposta (1100): um briefing de
   * fotografia que escolhe material, superfície, luz e enquadramento não
   * cabe em menos, e cortá-lo aqui devolvia 400 ao cliente depois de a
   * proposta já ter sido paga.
   */
  prompt: z.string().min(10).max(1300),
  company: z.string().max(120).default(''),
  segment: z
    .enum(['restaurantes', 'beleza', 'lojas', 'servicos', 'outro'])
    .default('outro'),
  colors: z.object({
    primary: z.string().max(9),
    secondary: z.string().max(9),
    accent: z.string().max(9).nullable().optional(),
  }),
  // Derivado do catálogo, como nas restantes rotas: ver `formatEnum`.
  format: formatEnum.default('quadrado'),
  /**
   * Claro ou escuro, lido dos píxeis do ficheiro.
   *
   * Manda no tom do material. O logótipo é aplicado sem mudar de cor, logo
   * as peças onde assenta têm de contrastar com ele.
   */
  logoTone: z.enum(['claro', 'escuro']).nullable().optional(),
  /**
   * Varia a cena entre gerações.
   *
   * O "Gerar novo" tem de dar outra fotografia, não a mesma com outro grão.
   * Sem isto, o mesmo briefing devolvia composições quase idênticas.
   */
  variant: z.number().int().min(0).max(99).default(0),
  /** Logótipo em data URL. Sem ele a geração não faz sentido. */
  logoDataUrl: z.string().max(4_000_000).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Pedido inválido.',
        details: parsed.error.issues.map((issue) => issue.path.join('.')).slice(0, 6),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const provider = resolveImageProvider();

  if (!provider) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Não há fornecedor de imagem configurado. Os visuais da identidade são gerados por IA e não têm alternativa local.',
      },
      { status: 503 },
    );
  }

  /*
    O logótipo segue preparado, como na geração das publicações: recortado,
    sobre um fundo que contrasta com ele e ampliado a 1024 px. Ver
    `prepareLogoReference` para o porquê de cada passo.

    O tom medido no servidor só serve quando o cliente não mandou o dele —
    num "Gerar novo" sem o ficheiro em mão, por exemplo.
  */
  const preparedLogo =
    provider.acceptsReferences && input.logoDataUrl
      ? await prepareLogoReference(input.logoDataUrl)
      : null;

  const prompt = buildVisualPrompt({
    ...input,
    logoTone: input.logoTone ?? preparedLogo?.tone ?? null,
  });

  /*
    Só o logótipo vai como referência.

    Nenhum modelo de composição: a folha de identidade não tem estrutura
    herdada de outra arte, e anexar uma referência de composição fazia o
    gerador copiar a encenação do produto em vez de montar material de
    marca.
  */
  const references =
    provider.acceptsReferences && input.logoDataUrl
      ? [preparedLogo?.dataUrl ?? input.logoDataUrl]
      : [];

  try {
    const image = await provider.generate({ prompt, format: input.format, references });

    return NextResponse.json({
      ok: true,
      provider: `${provider.id}:${provider.model}`,
      usedLogo: references.length > 0,
      prompt,
      dataUrl: `data:${image.mime};base64,${image.base64}`,
      costUsd: image.costUsd ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'A geração deste visual falhou. Os restantes ficaram intactos.',
      },
      { status: 502 },
    );
  }
}

type VisualInput = z.infer<typeof requestSchema>;

/**
 * Monta a instrução final.
 *
 * O briefing criativo vem do modelo de texto, que conhece a empresa. Aqui
 * acrescentamos o que é invariável: o acabamento de fotografia profissional,
 * o contraste do logótipo, as cores por palavras e as proibições.
 */
function buildVisualPrompt(input: VisualInput): string {
  const palette = [
    `dominante ${describeColor(input.colors.primary)}`,
    `apoio ${describeColor(input.colors.secondary)}`,
    input.colors.accent ? `realce ${describeColor(input.colors.accent)}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const lines: string[] = [
    'Fotografia profissional de material de marca, para apresentação de identidade visual de uma empresa real.',
    '',
    'BRIEFING',
    input.prompt.trim(),
    '',
    ANGLE[input.variant % ANGLE.length],
    '',
  ];

  /*
    ────────────────────────────────────────────────────────────────────────
    CONTRASTE DO LOGÓTIPO — a correcção mais importante desta rota.

    O resultado que obrigou a escrevê-lo: um logótipo azul-marinho escuro
    aplicado num envelope azul-marinho escuro, numa caixa azul-marinho e num
    ecrã de telemóvel azul-marinho. A marca desaparecia na peça feita para a
    mostrar — e as regras da própria identidade diziam que o logótipo precisa
    de fundo claro.

    O gerador não deduz isto: a paleta diz-lhe "dominante azul-marinho" e ele
    pinta tudo de azul-marinho, logótipo incluído. A instrução tem de separar
    explicitamente a cor das PEÇAS da cor da CENA.
    ────────────────────────────────────────────────────────────────────────
  */
  const escuro = input.logoTone !== 'claro';
  lines.push(
    'TOM DAS PEÇAS — regra obrigatória',
    escuro
      ? 'O logótipo desta empresa é ESCURO e é aplicado sem mudar de cor. Todas as peças onde ele assenta são de tom CLARO: papel cru, creme, branco quebrado, cinza pálido, cartão natural. Nenhuma peça com o logótipo é escura ou da mesma família de cor que ele.'
      : 'O logótipo desta empresa é CLARO e é aplicado sem mudar de cor. Todas as peças onde ele assenta são de tom ESCURO e uniforme: cartão preto, papel antracite, material em tom profundo. Nenhuma peça com o logótipo é clara ou da mesma família de cor que ele.',
    escuro
      ? 'A cor da marca entra na SUPERFÍCIE debaixo das peças, nos detalhes, nos forros e nas sombras — nunca no material onde o logótipo está impresso.'
      : 'A cor da marca entra na SUPERFÍCIE debaixo das peças e nos detalhes — o material onde o logótipo está impresso mantém-se escuro e sóbrio.',
    'O logótipo tem de se ler à primeira, sem esforço, em cada peça onde aparece.',
    '',
  );

  lines.push(
    'LOGÓTIPO',
    'A imagem anexada é o logótipo real e registado desta empresa.',
    '· Aplica-o tal e qual: mesmas formas, mesmas cores, mesmas proporções.',
    '· Não o redesenhes, não o simplifiques, não lhe mudes a cor, não lhe retires elementos.',
    '· Impresso nas peças com acabamento real: relevo seco, tinta mate ou verniz localizado, a apanhar a luz como tinta sobre papel.',
    '· Fica nítido, bem alinhado, com espaço livre generoso em volta.',
    '· É a ÚNICA marca ou texto em toda a imagem. Não escrevas o nome da empresa por baixo nem ao lado dele.',
    '',
  );

  lines.push(
    'CORES',
    `Cores da marca: ${palette}.`,
    // Lição paga com gerações estragadas: hexadecimais no prompt são
    // tratados como texto a desenhar.
    'Usa-as na superfície, nos detalhes e na luz, respeitando a regra do tom das peças. Nunca as escrevas, nem mostres amostras, nem etiquetas de cor.',
    '',
  );

  lines.push(
    'ACABAMENTO',
    `Negócio: ${input.company || 'empresa'} (${input.segment}).`,
    'Fotografia única de estúdio, tirada com objectiva macro de 50 mm, pouca profundidade de campo nas extremidades.',
    'Luz de estúdio direccional com difusor, uma fonte dominante e um preenchimento suave do lado oposto. Sombras curtas, nítidas e coerentes com essa luz.',
    'Materiais reais e reconhecíveis: grão do papel, gramagem, fibra do cartão, relevo da tinta. Bordos com espessura.',
    'Composição arrumada de agência: alinhamentos deliberados, sobreposições leves entre peças, uma zona vazia a respirar.',
    'Qualidade de catálogo impresso. Nada de maquete plana, nada de renderização de computador.',
    `Não incluir: ${NEGATIVE.join(', ')}.`,
  );

  return lines.join('\n');
}

/**
 * Enquadramentos alternativos, para "Gerar novo" dar outra fotografia.
 *
 * O briefing do modelo de texto é o mesmo entre tentativas: é a proposta
 * aprovada. Variar o ângulo e a encenação aqui é o que faz a segunda
 * geração ser uma alternativa real em vez da mesma imagem com outro grão.
 */
const ANGLE = [
  'ENQUADRAMENTO: vista de cima a prumo, peças alinhadas numa grelha ligeiramente irregular, sombra curta e difusa.',
  'ENQUADRAMENTO: ângulo de trinta graus, peças em diagonal da base para o canto superior, uma delas sobreposta à outra, profundidade de campo curta.',
  'ENQUADRAMENTO: perspectiva rasante quase ao nível da mesa, peça principal em primeiro plano nítida e as restantes a perder foco atrás.',
  'ENQUADRAMENTO: vista de cima em ângulo leve, peças agrupadas de um lado e dois terços da superfície vazios do outro, luz lateral longa.',
];

const NEGATIVE = [
  'texto inventado',
  'palavras sem sentido',
  'letras deformadas',
  'o nome da empresa escrito ao lado ou por baixo do logótipo',
  'logótipos de outras empresas',
  'marcas de água',
  'amostras de cor',
  'paletas de cor',
  'códigos hexadecimais',
  'etiquetas como "primary" ou "logo"',
  'molduras decorativas',
  'colagens de várias imagens',
  'aspecto de banco de imagens genérico',
  // O gerador enchia a cena de telemóveis com interface inventada.
  'ecrãs de telemóvel ou de computador com interface',
  'maquetes planas sem volume',
  'aspecto de renderização 3D',
  // O resultado que motivou a regra do tom das peças.
  'logótipo escuro sobre material escuro',
  'logótipo claro sobre material claro',
  'o logótipo a desaparecer no fundo por falta de contraste',
];
