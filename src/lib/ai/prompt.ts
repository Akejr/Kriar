/**
 * Instruções para o gerador de IMAGEM.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Os prompts de PLANEAMENTO saíram deste ficheiro.
 *
 * `buildPlanSystemPrompt` e `buildPlanUserPrompt` apresentavam ao modelo de
 * texto a lista de modelos da biblioteca, com a instrução "Escolhe
 * obrigatoriamente um destes. Qualquer outro identificador é rejeitado." Com
 * um único modelo disponível, isso não era uma escolha — era uma imposição
 * com passos extra.
 *
 * Foram substituídos por `directionPrompt.ts`, que pede ao modelo que CRIE
 * direcções a partir do pedido e da marca, sem lhe mostrar biblioteca
 * nenhuma.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { accentHex, baseHex, isMonochromeBrand, oppositeBase } from '@/lib/composition/base';
import { LOGO_SIZE_SHARE } from '@/lib/composition/layouts';
import { describeColor } from '@/lib/composition/palette';
import type {
  ArtBase,
  ContactsPlacement,
  FormatId,
  LogoSize,
  StyleId,
} from '@/lib/domain/types';
import { getReference } from '@/lib/references/catalog';
import type { ReferenceRole } from './schema';


/**
 * Prompt para o gerador de imagens.
 *
 * Nunca pede a publicação inteira: pede um fundo. Os textos, o logótipo, os
 * contactos, o preço e as fotografias aprovadas ficam em camadas que a
 * aplicação controla, e é por isso que corrigir o preço depois de gerar não
 * obriga a refazer o fundo.
 */
/**
 * Instrução para gerar a PUBLICAÇÃO COMPLETA.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O gerador produz a arte inteira: cena, produtos, composição e texto.
 *
 * O que manda aqui é a DIRECÇÃO CRIATIVA — a ideia criada para este pedido.
 * As referências visuais entram no fim, e só como orientação de acabamento.
 *
 * Isto é a inversão de uma arquitectura anterior, e vale explicar porquê. A
 * versão antiga abria com "REFERÊNCIA DE COMPOSIÇÃO (primeira imagem
 * anexada) — segue-a de perto" e injectava o `scenePrompt` do modelo, que
 * descrevia por palavras a cena da referência. Com uma única referência
 * activa — uma mão a colocar uma peça num tabuleiro —, o sistema devolvia
 * tabuleiros a quem pedia perfumes. A referência não estava a demonstrar
 * qualidade: estava a ditar o conteúdo.
 *
 * O logótipo e os contactos também são desenhados aqui — a camada que a
 * aplicação colava por cima saiu, porque parecia colada. A fidelidade do
 * logótipo vem de três sítios: a referência preparada em primeiro lugar
 * (`prepareLogoReference`), a transcrição soletrada no bloco MARCA
 * (`readLogo`) e a verificação depois de gerar (`/api/ai/review-art`).
 * ──────────────────────────────────────────────────────────────────────────
 */
export function buildArtworkPrompt(input: {
  /** A ideia criada para ESTE pedido. É a autoridade da geração. */
  direction: {
    /** `tipografica` dispensa a imagem protagonista; as outras não. */
    approach?: string;
    idea: string;
    scene: string;
    focus: string;
    hierarchy: string;
    composition: string;
    lighting: string;
    materials: string;
    brandApplication: string;
    /** Os recursos de design da peça. Vazio em direcções antigas. */
    graphics?: string;
  };
  format: FormatId;
  style: StyleId;
  /** Descrição do estilo escolhido. Vazia quando o estilo é `auto`. */
  styleGuidance: string;
  /** A cor que pinta o fundo e as grandes áreas. Ver `composition/base.ts`. */
  base?: ArtBase;
  /** O tamanho do logótipo escolhido na revisão. */
  logoSize?: LogoSize;
  /** Contactos no bloco de texto (omissão) ou numa linha de rodapé. */
  contactsPlacement?: ContactsPlacement;
  /** As fontes da marca, pelo nome e pelo tipo. */
  typography?: {
    display: string;
    body: string;
    displayKind: 'sans' | 'serif';
    bodyKind: 'sans' | 'serif';
  } | null;
  /**
   * O que aproveitar de cada referência e o que nunca transferir.
   *
   * As proibições vêm do cadastro da referência, não do que o modelo de
   * texto se lembrar de escrever.
   */
  referenceUsage: Array<{
    referenceId: string;
    take: string[];
    doNotTransfer: string[];
    mode: 'descricao' | 'imagem';
  }>;
  company: string;
  segment: string;
  colors: { primary: string; secondary: string; accent?: string | null };
  texts: { headline: string; subheadline: string; cta: string; badge: string; price: string };
  items: Array<{ name: string; highlighted: boolean; hasImage: boolean }>;
  /**
   * `true` quando o logótipo faz parte da arte E a imagem dele vai anexada
   * em primeiro lugar. A rota garante as duas coisas: sem o ficheiro, este
   * bloco diria ao gerador que a imagem 1 é um logótipo — e a imagem 1 seria
   * a fotografia de um produto.
   */
  drawLogo: boolean;
  /**
   * O que sabemos do logótipo enviado como imagem 1.
   *
   * `tone` vem da análise de píxeis do ficheiro; o resto, de uma
   * transcrição por visão. Qualquer parte pode faltar sem impedir a geração.
   */
  logo?: {
    /** `null` quando o ficheiro não pôde ser analisado. */
    tone: 'claro' | 'escuro' | null;
    /**
     * `true` quando a transcrição respondeu. Sem ela, um `text` vazio não
     * quer dizer "logótipo sem letras" — quer dizer "não sabemos".
     */
    read: boolean;
    text: string;
    letters: string[];
    symbols: string;
    description: string;
  } | null;
  /**
   * Defeitos encontrados na tentativa anterior, quando esta é uma correcção.
   * Vazio na primeira geração.
   */
  correction?: string[];
  /**
   * Contactos a escrever na arte, cada um com o seu nome.
   *
   * Substituiu `contactLine`, que era uma linha já montada. Ver o bloco
   * CONTACTOS para o motivo.
   */
  contacts: Array<{ label: string; value: string }>;
  /** Imagens anexadas ao pedido, com o papel de cada uma. */
  references: Array<{ role: ReferenceRole; label: string }>;
  /**
   * Margens que o gerador tem de respeitar, em percentagem da imagem DELE.
   *
   * Já contam com o que a moldura da publicação corta — ver `safeMargins`.
   * Sem elas, a regra "8% da largura" valia na imagem 3:4 e não na
   * publicação 4:5, e os contactos ficavam na faixa que a moldura corta.
   */
  frame: { topBottom: number; sides: number };
  /**
   * A memória da empresa: regras curtas que o uso ensinou. Vazio quando não
   * há ou o cliente a desligou.
   */
  memory?: string[];
  /**
   * A disposição aprovada no esboço da revisão, zona a zona. O esboço em si
   * vai nas imagens, com o papel `esboco`.
   */
  layout?: { label: string; zones: string[] } | null;
  /** Os preços que a arte pode mostrar. Qualquer outro é invenção. */
  prices?: string[];
  /**
   * O estilo aprendido com as artes que a empresa já publicou.
   *
   * `null` quando a marca não o tem ou o cliente o desligou. As duas artes
   * de referência, quando existem, vêm em `references` com o papel
   * `estilo-marca`.
   */
  brandStyle?: {
    analysedCount: number;
    summary: string;
    composition: string;
    typography: string;
    color: string;
    imagery: string;
    graphics: string;
    copy: string;
    logo: string;
    recurring: string[];
  } | null;
  /** Regras da identidade aprovada. `null` quando não há identidade. */
  guidelines: {
    lighting: string;
    framing: string;
    photoTreatment: string;
    decorationLevel: string;
    tone: string;
    avoid: string[];
    cornerRadius: string;
    shadow: string;
    fixedRules: string[];
    /**
     * Papéis de superfície e de texto da paleta aprovada.
     *
     * A empresa tem uma paleta com funções, não três cores soltas. Sem estes
     * papéis o gerador escolhia o tom do fundo e do texto por sua conta, e
     * duas publicações da mesma empresa saíam com fundos de famílias
     * diferentes.
     */
    surfaces?: {
      bgLight: string | null;
      bgDark: string | null;
      textOnLight: string | null;
      textOnDark: string | null;
    };
  } | null;
}): string {
  const aspect = FORMAT_WORDS[input.format];

  /*
    Cores por PALAVRAS, nunca por código hexadecimal.

    Com os códigos no prompt, o gerador tratou-os como texto a desenhar e
    produziu uma tabela de amostras — "Primary #1B2A4A / Secondary #E8DCC8" —
    na faixa que lhe tínhamos mandado deixar vazia. Um modelo de imagem não
    lê hexadecimal: lê caracteres.

    E por PAPEL: a cor de base (o fundo e as grandes áreas, escolhida na
    revisão) e a cor de realce (as formas, o botão, a palavra destacada).
    "Dominante" e "apoio" não diziam o que pintar com cada uma.
  */
  const base: ArtBase = input.base ?? 'primaria';
  const ground = baseHex(input.colors, base);
  const baseWords = describeColor(ground);
  const accent = accentHex(input.colors, base);
  const accentWords = describeColor(accent);
  // As outras cores da marca — nem base nem realce —, para detalhes.
  const otherColors = [baseHex(input.colors, oppositeBase(base)), input.colors.accent ?? null]
    .filter((hex): hex is string => typeof hex === 'string' && hex.trim().length > 0)
    .map((hex) => hex.trim().toUpperCase())
    .filter((hex, index, list) => list.indexOf(hex) === index)
    .filter((hex) => hex !== accent.toUpperCase() && hex !== ground.toUpperCase());
  const monochrome = isMonochromeBrand(input.colors);

  /*
    Sem botão, o botão não é mencionado em sítio nenhum além da linha que
    diz que não há. "O botão continua uma linha", "usa a cor de realce no
    botão" — cada menção era um convite a desenhar um.
  */
  const hasCta = Boolean(input.texts.cta.trim());
  const hasExamples =
    input.references.some((reference) => reference.role === 'estetica') ||
    input.referenceUsage.length > 0;

  const destaque = input.items.find((item) => item.highlighted);
  const outras = input.items.filter((item) => !item.highlighted);

  const direction = input.direction;

  /*
    A arte a RECRIAR, quando o cliente anexou uma.

    É a única imagem anexada de onde a composição pode vir. Muda três
    blocos: a composição passa a segui-la, o nível de acabamento passa a ser
    o dela, e a lista negativa ganha o que nunca se copia de outra empresa.
  */
  const recreate = input.references
    .map((reference, index) => (reference.role === 'recriar' ? index + 1 : null))
    .filter((index): index is number => index !== null);
  const recreateWhich =
    recreate.length === 1 ? `a imagem ${recreate[0]}` : `as imagens ${joinPt(recreate)}`;

  /*
    O ESBOÇO aprovado na revisão, quando vai anexado.

    Manda na disposição: onde fica o protagonista, o título, o botão, o
    logótipo e os contactos. Sem ele, era o gerador a decidir, e uma arte
    saiu com o logótipo colado à aresta e o website empilhado por cima.
  */
  const sketchIndex = input.references.findIndex((reference) => reference.role === 'esboco') + 1;
  const layout = input.layout && input.layout.zones.length > 0 ? input.layout : null;

  const lines: string[] = [
    `Publicação profissional para redes sociais, formato ${aspect}.`,
    '',
  ];

  /*
    CORRECÇÃO de uma tentativa anterior, logo a abrir.

    Só existe quando a verificação automática reprovou a primeira geração.
    Vem antes de tudo porque é o que esta tentativa tem de fazer diferente,
    e uma instrução no topo de um prompt longo pesa mais do que no fim.
  */
  if (input.correction && input.correction.length > 0) {
    lines.push(
      'CORRECÇÃO OBRIGATÓRIA — a tentativa anterior desta arte falhou nestes pontos, e esta tem de os resolver:',
      ...input.correction.map((issue) => `· ${issue}`),
      'Mantém a mesma ideia, os mesmos textos e os mesmos produtos. Muda só o que for preciso para corrigir isto.',
      '',
    );
  }

  lines.push(
    /*
      A IDEIA abre o prompt.

      Esta posição era da referência de composição, com a instrução de a
      seguir de perto. A troca é a mudança de arquitectura inteira resumida
      em três linhas: o que determina a arte é a ideia criada para este
      pedido, não a cena de uma imagem da biblioteca.
    */
    'IDEIA DESTA PUBLICAÇÃO',
    direction.idea,
    '',
    'CENA',
    direction.scene,
    // Sem o ponto final do modelo: saía "vidro..".
    `Elemento principal: ${endless(direction.focus)}.`,
    `Materiais: ${endless(direction.materials)}.`,
    `Iluminação: ${endless(direction.lighting)}.`,
    '',
    'COMPOSIÇÃO',
    /*
      Com um esboço aprovado, a composição e a hierarquia são as dele. As
      frases livres do modelo criativo contradiziam-no: "a zona superior
      direita fica mais calma para contactos" e "primeiro o preço", numa
      arte cujo esboço punha os contactos no fundo e o título como o maior
      texto.
    */
    ...(layout ? [] : direction.composition.trim() ? [direction.composition] : []),
    ...(layout ? [] : [`Hierarquia: ${endless(direction.hierarchy)}.`]),
    recreate.length > 0
      ? `A composição segue a da arte a recriar (${recreateWhich}): a mesma organização, a mesma hierarquia e o mesmo tipo de cena, adaptados a esta marca. De nenhuma outra imagem anexada se importa a composição.`
      : sketchIndex > 0
        ? `A disposição vem do esboço aprovado (imagem ${sketchIndex}). De nenhuma outra imagem anexada se importa a composição.`
        : 'A composição é desta publicação. Não a importes de nenhuma imagem anexada.',
    '',
  );

  if (layout) {
    lines.push(
      `DISPOSIÇÃO APROVADA — ${layout.label}`,
      sketchIndex > 0
        ? `O cliente aprovou esta disposição num esboço (imagem ${sketchIndex}). Cumpre-a, zona a zona:`
        : 'O cliente aprovou esta disposição. Cumpre-a, zona a zona:',
      ...layout.zones.map((zone) => `· ${zone}`),
      '',
    );
  }

  if (input.styleGuidance.trim()) {
    lines.push('ESTILO', input.styleGuidance.trim(), '');
  }

  /*
    ──────────────────────────────────────────────────────────────────────────
    O NÍVEL MÍNIMO, logo a seguir à ideia.

    Nada no prompt exigia uma imagem. Havia margens, cores, texto exacto e
    logótipo fiel — tudo restrições —, e a forma mais segura de as cumprir
    todas é um cartaz de texto sobre fundo liso. Foi o que o gerador
    devolveu: "Paga a tua Netflix em kwanzas" em creme sobre azul-marinho,
    sem uma única imagem.

    Este bloco diz o que a arte TEM de ter, não só o que não pode ter. Só
    uma direcção tipográfica, pedida pelo cliente, o dispensa.
    ──────────────────────────────────────────────────────────────────────────
  */
  const typographic = direction.approach === 'tipografica';
  if (recreate.length > 0) {
    /*
      Com uma arte a recriar, o nível é o dela — ou melhor. Exigir uma
      fotografia protagonista a quem pediu para refazer um cartaz
      tipográfico era contrariar o pedido.
    */
    lines.push(
      'NÍVEL DE ACABAMENTO — pelo menos o da arte a recriar:',
      '· A mesma qualidade de imagem, de luz e de tipografia, ou melhor.',
      '· Tudo o que é imagem é feito de novo: as pessoas, os objectos e o cenário são novos, nunca recortados nem copiados da arte original.',
      '',
    );
  } else if (!typographic) {
    lines.push(
      hasExamples
        ? 'NÍVEL DE ACABAMENTO — publicidade de agência, ao nível dos exemplos de direcção artística anexados:'
        : 'NÍVEL DE ACABAMENTO — publicidade de agência:',
      '· Um protagonista fotográfico (ou 3D fotorrealista) com presença forte: a pessoa, o produto ou o dispositivo da cena acima.',
      '· Volume e profundidade: planos de foco, sombras de contacto e sobreposições — também quando o protagonista vai recortado sobre a cor de base.',
      '· Luz desenhada: luz principal, luz de recorte nos contornos e reflexos coerentes com a cor de base.',
      '· Nunca um cartaz só de texto sobre um fundo de cor lisa, e nunca uma fotografia com o texto simplesmente pousado por cima.',
      '',
    );
  }

  /*
    ──────────────────────────────────────────────────────────────────────────
    O DESIGN DA PEÇA.

    "As artes são imagem, texto e logótipo tudo por cima da imagem. Não vejo
    comunicação nas artes." O cliente tinha razão, e a causa estava neste
    ficheiro: o prompt pedia "UMA fotografia contínua", proibia painéis,
    caixas, blocos de cor e colagens, e mandava o texto assentar "numa zona
    calma da própria imagem". Sobrava exactamente o que ele viu — uma
    fotografia com letras por cima.

    As artes de agência da biblioteca são o contrário: o produto recortado
    sobre a cor da marca, uma faixa que liga a fotografia ao título, uma
    palavra em destaque, camadas. A ideia traz agora os seus recursos de
    design (`graphics`); sem eles, pede-se um design por omissão.

    Fica de fora o que era defeito real e continua a ser: a arte partida em
    duas metades sem ligação, e as caixas cinzentas do esboço.
    ──────────────────────────────────────────────────────────────────────────
  */
  if (recreate.length === 0) {
    const graphics = direction.graphics?.trim() ?? '';
    lines.push(
      'DESIGN DA PEÇA — um anúncio desenhado, não uma fotografia com texto por cima',
      graphics
        ? `Recursos de design desta ideia: ${graphics}`
        : typographic
          ? 'Recursos de design: o título é a imagem — tipografia grande e confiante, com uma palavra destacada na cor de realce, e uma forma da marca que o enquadra ou o sublinha.'
          : 'Recursos de design: escolhe dois que sirvam esta ideia — o protagonista recortado sobre a cor de base ou dentro de uma forma da marca (círculo, arco, faixa inclinada); uma forma na cor de realce que liga o título à imagem; uma palavra do título destacada.',
      `· A fotografia, as formas e o texto são UMA composição: as formas passam por trás e à frente do protagonista, o título encosta-se à imagem${hasCta ? ', o botão continua uma linha ou uma forma' : ''}. Nada parece colado por cima.`,
      '· Formas geométricas e limpas, nas cores da marca, cada uma com uma função — agrupar, ligar, enquadrar ou conduzir o olhar. Duas ou três, nunca um amontoado.',
      '· Hierarquia que se lê em três segundos: o título, o protagonista e só depois o resto. O título grande e confiante; o texto de apoio claramente menor; o logótipo pequeno, como uma assinatura.',
      ...(layout
        ? [
            '· O design cabe na disposição aprovada: as formas podem passar por trás do texto e do protagonista, mas não mudam onde cada coisa fica.',
          ]
        : []),
      '',
    );
  }

  /*
    ──────────────────────────────────────────────────────────────────────────
    AS CORES: a marca pinta o DESIGN; a fotografia tem cor natural.

    A regra era "nas superfícies, no texto e nos realces usa SÓ as cores da
    marca" — e uma empresa de teste com preto e branco recebeu três artes a
    preto e branco, fotografia incluída. O gerador cumpriu: não havia outra
    cor autorizada.

    A paleta continua a mandar no fundo, nas formas, no texto e no botão. A
    fotografia — pele, materiais, produtos, luz — tem as cores reais,
    afinadas para combinar com a base. Era o que as referências mostravam.
    ──────────────────────────────────────────────────────────────────────────
  */
  lines.push(
    `Negócio: ${input.company} (${input.segment}).`,
    'CORES DESTA ARTE',
    `· Cor de base: ${baseWords} — pinta o fundo e as grandes áreas de design. É a cor que domina a arte.`,
    `· Cor de realce: ${accentWords} — nas formas gráficas,${hasCta ? ' no botão,' : ''} numa palavra destacada e nos pequenos detalhes.`,
    ...(otherColors.length > 0
      ? [
          `· ${otherColors.length === 1 ? 'A outra cor da marca' : 'As outras cores da marca'}, ${joinPt(otherColors.map((hex) => describeColor(hex)))}, ${otherColors.length === 1 ? 'pode' : 'podem'} entrar com moderação, num detalhe.`,
        ]
      : []),
    '· O texto vai na cor de realce ou no tom — claro ou escuro — que melhor se lê sobre o fundo onde assenta.',
    /*
      A paleta manda no design, NÃO nos produtos.

      Aplicada aos objectos, pintou de azul-escuro os três perfumes de um
      pedido cuja opção principal se chamava "Âmbar". O produto tem de
      continuar a parecer-se com o que é — é isso que o cliente está a
      anunciar.
    */
    '· A FOTOGRAFIA mantém as cores naturais — pele, materiais, produtos e luz —, afinadas para combinar com a cor de base. Nunca pintada com as cores da marca, nunca dessaturada. Os PRODUTOS mantêm as cores próprias, coerentes com o que são e com o nome que têm.',
    ...(monochrome
      ? [
          '· Esta marca é a preto e branco: o design vive do contraste forte entre a base e o realce, e a cor da arte vem da fotografia, com cor natural e calor. Uma arte inteira em cinzentos não é o que a marca pede.',
        ]
      : []),
    'As cores servem para pintar a arte. Nunca as escrevas, nem mostres amostras, nem etiquetas de cor.',
    `Aplicação da identidade nesta arte: ${direction.brandApplication}`,
    '',
  );

  /*
    ──────────────────────────────────────────────────────────────────────────
    ESTILO DA MARCA — o que a empresa já publica.

    Vem logo depois da ideia e das cores, e antes dos produtos e do texto:
    é o que faz uma arte nova parecer DESTA empresa e não de outra qualquer.

    A frase que importa é a do fim. As duas artes de referência são
    publicações reais, com produtos, preços e promoções — e um gerador que
    recebe uma promoção como exemplo devolve a mesma promoção. Por isso o
    prompt diz o que se aproveita (a linguagem) e o que nunca passa (o
    conteúdo), e a lista negativa repete o conteúdo de cada uma.
    ──────────────────────────────────────────────────────────────────────────
  */
  const style = input.brandStyle;
  const styleImages = input.references
    .map((reference, index) => (reference.role === 'estilo-marca' ? index + 1 : null))
    .filter((index): index is number => index !== null);

  if (style && style.summary.trim()) {
    const count =
      style.analysedCount === 1
        ? 'com 1 arte'
        : style.analysedCount > 1
          ? `com ${style.analysedCount} artes`
          : 'com as artes';
    lines.push(`ESTILO DA MARCA — aprendido ${count} que a empresa já publicou`);
    lines.push(
      'É a linguagem visual que faz esta publicação parecer desta empresa. Segue-a; o conteúdo vem da ideia acima.',
    );
    const entries: Array<[string, string]> = [
      ['Linguagem geral', style.summary],
      ['Composição habitual', style.composition],
      ['Tipografia', style.typography],
      ['Uso da cor', style.color],
      ['Tratamento da imagem', style.imagery],
      ['Grafismos', style.graphics],
      ['Texto', style.copy],
    ];
    // A aplicação habitual do logótipo só faz sentido quando a arte o leva.
    if (input.drawLogo && style.logo) entries.push(['Aplicação habitual do logótipo', style.logo]);
    for (const [label, value] of entries) {
      if (value.trim()) lines.push(`· ${label}: ${value.trim()}`);
    }
    if (style.recurring.length > 0) {
      lines.push(`· Elementos que se repetem: ${style.recurring.join('; ')}.`);
    }
    if (styleImages.length > 0) {
      const which =
        styleImages.length === 1
          ? `A imagem ${styleImages[0]} é uma arte anterior da marca`
          : `As imagens ${joinPt(styleImages)} são artes anteriores da marca`;
      lines.push(
        `${which}. Servem SÓ para mostrar este estilo — não é para fazer igual. Não copies a composição, os textos, os produtos, os preços nem a cena: esta é uma publicação nova da mesma marca, não uma cópia de uma antiga.`,
      );
    }
    lines.push(
      'O estilo da marca define a linguagem (tipografia, cor, grafismos, composição habitual); a ideia define o conteúdo; o acabamento é sempre de nível profissional.',
      '',
    );
  }

  if (input.items.length > 0) {
    lines.push('PRODUTOS NA CENA');
    if (destaque) {
      lines.push(
        `· Em primeiro plano, claramente a escolha principal: "${destaque.name}".`,
      );
    }
    for (const item of outras) {
      lines.push(`· Em segundo plano, a apoiar sem competir: "${item.name}".`);
    }
    lines.push(
      'Cada produto é um objecto real e fotográfico na cena, com volume, material e sombra própria. Não são formas geométricas planas nem ícones.',
      '',
    );
  }

  lines.push('TEXTO A COMPOR NA ARTE');
  lines.push(
    'Escreve exactamente estas palavras, em português, com os acentos tal como estão. Não acrescentes texto nenhum que não esteja nesta lista.',
  );
  if (input.texts.badge) lines.push(`· Etiqueta pequena: "${input.texts.badge}"`);
  lines.push(`· Título, o maior elemento de texto: "${input.texts.headline}"`);
  if (input.texts.subheadline) lines.push(`· Texto de apoio: "${input.texts.subheadline}"`);
  if (input.texts.price) lines.push(`· Preço, destacado: "${input.texts.price}"`);
  /*
    Sem botão, dito uma vez e pela positiva. O cliente retirou a chamada
    para acção e a arte saiu com uma: o gerador põe um botão por hábito em
    qualquer anúncio. O verificador confere (`noCta`).
  */
  if (input.texts.cta) lines.push(`· Chamada para acção, dentro de um botão: "${input.texts.cta}"`);
  else lines.push('· Sem chamada para acção: esta arte não tem botão.');

  /*
    Contactos NOMEADOS, um por linha.

    Iam numa só linha pré-montada — "www.exemplo.com · +244 923 000 000" —, e
    o gerador tratava-a como um bloco de texto decorativo: dava-lhe o tamanho
    que lhe apetecia e às vezes trocava os separadores. Dizer "website:" e
    "WhatsApp:" dá-lhe o significado de cada valor, e um valor com significado
    é escrito com mais cuidado do que uma tira de caracteres.
  */
  /*
    ──────────────────────────────────────────────────────────────────────────
    CONTACTOS OBRIGATÓRIOS, não "pequenos e discretos".

    O bloco dizia "vão na zona de rodapé, pequenos e discretos". O gerador
    obedeceu à letra: escreveu o website minúsculo, encostado à aresta de
    baixo da imagem dele — e a moldura 4:5 cortou-o. O cliente viu meia
    linha de texto por baixo do botão e nenhum website, numa arte de
    subscrições que se compram precisamente no website.

    Agora: todos, por inteiro, com tamanho de leitura num telemóvel, ACIMA
    da margem de baixo. E o verificador confere cada um, na moldura que o
    cliente vê.
    ──────────────────────────────────────────────────────────────────────────
  */
  if (input.contacts.length > 0) {
    const website = input.contacts.find((contact) => /web|site/i.test(contact.label));
    lines.push('');
    lines.push('CONTACTOS — obrigatórios, fazem parte da arte');
    lines.push('Escreve-os TODOS, por inteiro, e copia cada valor carácter por carácter:');
    for (const contact of input.contacts) {
      lines.push(`· ${contact.label}: "${contact.value}"`);
    }
    lines.push(
      /*
        Com esboço, os contactos são a última linha do bloco de texto, por
        baixo do botão. "Na parte de baixo da composição" levava o gerador a
        pô-los na aresta de baixo da imagem dele — e a moldura cortou-os
        inteiros numa geração real.
      */
      layout && input.contactsPlacement === 'rodape'
        ? `Ficam onde o esboço os põe: numa linha própria no rodapé, ACIMA da margem de baixo (${input.frame.topBottom}% da altura) e com a mesma folga que o logótipo. O erro habitual é descê-los até à aresta da imagem — não os desças.`
        : layout
          ? `Ficam onde o esboço os põe: logo por baixo ${input.texts.cta ? 'do botão' : 'do último texto'}, com o mesmo alinhamento do texto, como a última linha do bloco de texto. Não descem para a parte de baixo da arte.`
          : `Ficam juntos, numa linha ou em duas, na parte de baixo da composição e ACIMA da margem de baixo (${input.frame.topBottom}% da altura). Nunca encostados à aresta, nunca cortados por ela.`,
      'Legíveis num telemóvel: letra do tamanho do texto de apoio ou pouco menor, nunca minúscula, com contraste forte sobre uma zona calma da imagem.',
    );
    if (website) {
      lines.push(
        `O website ("${website.value}") é onde o cliente compra ou fala com a empresa: tem de se ler à primeira.`,
      );
    }
  }

  /*
    As fontes da marca, pelo nome. O gerador não tem os ficheiros, mas sabe
    desenhar "uma serifada de alto contraste, como a Playfair Display" — e
    sem nome desenhava a letra que lhe apetecia, diferente em cada arte.

    A palavra em destaque é o recurso tipográfico mais comum nas artes de
    agência; a condição que a acompanha é a que protege o texto aprovado.
  */
  const typography = input.typography;
  const kindWords = (kind: 'sans' | 'serif') => (kind === 'serif' ? 'serifada' : 'sem serifa');
  lines.push('', 'TIPOGRAFIA');
  if (typography?.display && typography.body) {
    lines.push(
      typography.display === typography.body
        ? `· Uma família só, ${kindWords(typography.displayKind)}, como a ${typography.display}: o título em peso forte, o resto em peso normal ou médio.`
        : `· Título numa letra ${kindWords(typography.displayKind)} como a ${typography.display}; texto de apoio${hasCta ? ', botão' : ''} e contactos numa ${kindWords(typography.bodyKind)} como a ${typography.body}.`,
    );
  }
  lines.push(
    '· Hierarquia clara, espaçamento generoso, alinhamento consistente; o texto lê-se sem esforço.',
    '· Podes destacar UMA palavra do título — na cor de realce ou com mais peso — sem mudar nenhuma letra nem a ordem das palavras.',
    '',
  );

  /*
    ──────────────────────────────────────────────────────────────────────────
    ECRÃS E PREÇOS.

    O gerador desenhou num telemóvel a interface inteira de uma loja —
    "Cursor, USD 20 / mês", "Claude, USD 20 / mês" —, com preços que
    ninguém pediu, numa moeda que não é a do cliente. Sabia quanto custam
    aqueles serviços nos Estados Unidos e escreveu-o. O ecrã é cena, e na
    cena também não se inventa.
    ──────────────────────────────────────────────────────────────────────────
  */
  const prices = (input.prices ?? []).filter((price) => price.trim());
  lines.push(
    'ECRÃS E PREÇOS',
    '· Num ecrã da cena (telemóvel, portátil, televisão) só aparecem os logótipos dos serviços anunciados, imagens do serviço ou a captura de ecrã anexada, com interface mínima. Nada de texto pequeno inventado.',
    /*
      Dito pela positiva, como o §25 manda. Numa arte real, o "cartão de
      encomenda" da ideia saiu com "KIANDA · ENCOMENDA PELO WHATSAPP" e o
      frasco com um rótulo "KIANDA EAU DE PARFUM" — de uma perfumaria que
      vende marcas de outros.
    */
    '· Os objectos que a cena acrescenta — cartões, sacos, caixas, embalagens — têm superfícies lisas, numa cor da marca. Cada produto anexado mantém o rótulo que tem na fotografia, tal como está.',
    prices.length > 0
      ? `· O único preço da arte é ${prices.map((price) => `"${price}"`).join(' e ')}, em kwanzas, onde a lista de texto o põe. Nenhum outro valor, nenhuma outra moeda — nem dentro de um ecrã.`
      : '· Esta arte não tem preço. Não escrevas nenhum valor, percentagem nem moeda — nem dentro de um ecrã.',
    '',
  );

  /*
    ──────────────────────────────────────────────────────────────────────────
    NUNCA pedimos ao gerador zonas reservadas nem ausências.

    Três tentativas, três falhanços, a mesma causa: mencionar um elemento
    fá-lo desenhá-lo.

      · "não desenhes logótipo, a aplicação aplica-o depois"
        → escreveu a palavra "Logo" na imagem;
      · "a faixa dos 15% superiores fica vazia"
        → desenhou barras de cor a delimitar a faixa;
      · "o terço superior é a parte mais calma da fotografia"
        → esvaziou um terço da arte e empurrou a cena para baixo.

    Por isso o logótipo só é mencionado quando existe e vai anexado: aí faz
    parte da arte, e quem decide onde assenta é quem compõe a imagem. Sem
    ficheiro, este bloco não existe — e não há nenhuma frase a dizer "sem
    logótipo", que era exactamente a frase que o fazia aparecer.
    ──────────────────────────────────────────────────────────────────────────
  */
  if (input.drawLogo) {
    /*
      ────────────────────────────────────────────────────────────────────────
      O LOGÓTIPO, dito três vezes.

      Duas razões para esta insistência, e ambas vêm de resultados.

      A primeira: com a aplicação a sobrepor o logótipo por cima da arte
      acabada, ele caía em cima do texto gerado — duas camadas a disputar o
      mesmo canto, porque o gerador não sabia que aquele espaço estava
      reservado. Passou a fazer parte da arte, e quem decide onde assenta é
      quem compõe a imagem.
      
      A segunda: o gerador REDESENHA logótipos. Simplifica formas, muda
      pesos, inventa letras, acrescenta o nome da empresa por baixo. Uma
      única instrução não chega. A repetição em três posições do prompt — na
      secção da marca, na identificação da imagem anexada e na lista negativa
      — é a única coisa que mostrou diferença.
      ────────────────────────────────────────────────────────────────────────
    */
    const logo = input.logo;
    const logoRange = (LOGO_SIZE_SHARE[input.logoSize ?? 'pequeno'] ?? LOGO_SIZE_SHARE.pequeno).range;
    lines.push('MARCA — O LOGÓTIPO É A IMAGEM 1');
    lines.push(
      'A primeira imagem anexada é o logótipo real e registado desta empresa. Aplica-o na arte como se fosse colado do ficheiro: uma cópia exacta, não uma interpretação.',
    );

    /*
      A transcrição: a segunda fonte que confirma a imagem.

      Um gerador que só vê a imagem tem de a reinterpretar. Um que lê também
      "lê-se D · O · T, da esquerda para a direita" tem duas fontes a
      dizerem a mesma coisa — e uma palavra soletrada é muito mais difícil
      de espelhar do que uma forma vista de relance.
    */
    if (logo?.text) {
      const spelled = logo.letters.length > 0 ? logo.letters.join(' · ') : logo.text;
      lines.push(
        `O texto do logótipo é exactamente «${logo.text}» — lê-se ${spelled}, da esquerda para a direita. Nenhuma letra a mais, nenhuma a menos, nenhuma trocada de lugar.`,
      );
    } else if (logo?.read) {
      /*
        Só com uma transcrição que respondeu. Quando a leitura falha, o
        texto vem vazio por falta de informação — e dizer ao gerador que o
        logótipo não tem letras fazia-o apagá-las de um logótipo que as tem.
      */
      lines.push('O logótipo não tem texto: é um símbolo. Não lhe acrescentes letras nem o nome da empresa.');
    }
    if (logo?.symbols) lines.push(`Elementos gráficos do logótipo: ${logo.symbols}.`);
    if (logo?.description) lines.push(`Descrição do logótipo: ${logo.description}`);

    lines.push(
      '· Mesmas formas, mesmas proporções, mesmas cores, mesmos pesos de traço do ficheiro.',
      '· NUNCA espelhado, invertido, rodado nem em perspectiva.',
      '· NÃO o redesenhes, NÃO o simplifiques, NÃO o modernizes, NÃO o completes.',
      '· NÃO lhe acrescentes o nome da empresa por baixo nem ao lado.',
      '· NÃO lhe mudes a cor. É a cena que se organiza em volta dele.',
      '',
      /*
        Como é APLICADO — é onde os geradores mais erram.

        Um logótipo impresso num objecto em perspectiva, com relevo ou com
        luz por cima, é um logótipo que o gerador tem de redesenhar para o
        deformar. Plano e de frente, é um logótipo que ele pode copiar. E
        abaixo de um certo tamanho as letras deixam de ter píxeis suficientes
        para sair certas — daí o intervalo explícito.
      */
      'APLICAÇÃO DO LOGÓTIPO — cumpre à risca:',
      '· Plano e de frente, como impressão gráfica sobre a arte. Sem relevo, sem sombra projectada, sem brilho, sem textura por cima, sem o colocar dentro de um objecto da cena.',
      /*
        Era "entre 15% e 20%", e em muitas artes o logótipo competia com o
        título. As artes de agência assinam com 8 a 12%. O intervalo é o
        do tamanho escolhido na revisão (`LOGO_SIZE_SHARE`).
      */
      layout
        ? `· Tamanho: o do esboço aprovado — uma assinatura, nunca mais de ${logoRange[1]}% da largura da arte nem maior do que o título. Pequeno, mas com cada letra nítida.`
        : `· Largura entre ${logoRange[0]}% e ${logoRange[1]}% da largura da arte: uma assinatura, nunca maior do que o título nem a competir com ele — pequeno, mas com cada letra nítida.`,
      logo?.tone === 'claro'
        ? '· O logótipo é CLARO: assenta numa zona ESCURA e uniforme da arte, para se ler sem esforço.'
        : logo?.tone === 'escuro'
          ? '· O logótipo é ESCURO: assenta numa zona CLARA e uniforme da arte, para se ler sem esforço.'
          : '· Assenta numa zona uniforme da arte que contraste com as cores do logótipo, para se ler sem esforço.',
      '· Dentro das margens da regra MARGEM, inteiro, sem tocar na aresta, longe do título e de qualquer outro texto. Nunca sobreposto a texto nem a uma zona de muito detalhe.',
      ...(layout
        ? [
            '· Posição e tamanho: os do esboço aprovado (ver DISPOSIÇÃO APROVADA). Entre o logótipo e a aresta mais próxima fica sempre um espaço maior do que a altura do próprio logótipo.',
          ]
        : []),
      '',
      'Repito, porque é o erro mais comum: o logótipo é uma cópia fiel da imagem 1.',
      '',
    );
  }

  /*
    ──────────────────────────────────────────────────────────────────────────
    REFERÊNCIAS: qualidades a aproveitar, conteúdos a não transferir.

    Esta secção substituiu "segue esta estrutura de perto" e a diferença é a
    razão de ser de toda a mudança.

    Cada referência entra com duas listas explícitas: o que se aproveita
    (luz, hierarquia, profundidade, acabamento) e o que nunca passa para a
    arte (a cena, os objectos, as marcas, as personagens). A segunda lista
    vem do cadastro, escrita por quem olhou para a imagem — não depende de o
    modelo se lembrar.

    E vem DEPOIS da ideia, dos produtos e do texto, de propósito. Uma
    instrução no fim de um prompt longo tem menos peso do que no início, e é
    exactamente esse o peso que uma referência deve ter.
    ──────────────────────────────────────────────────────────────────────────
  */
  /*
    Só as que NÃO vão como imagem. As que vão levam o que se aproveita e o
    que não se copia ao lado da própria imagem, no bloco das imagens
    anexadas — repetir aqui era dizer o mesmo duas vezes, longe da imagem.
  */
  const attachedAesthetic = new Set(
    input.references.filter((entry) => entry.role === 'estetica').map((entry) => entry.label),
  );
  const describedOnly = input.referenceUsage.filter(
    (usage) => !attachedAesthetic.has(usage.referenceId),
  );
  if (describedOnly.length > 0) {
    lines.push('REFERÊNCIAS DE QUALIDADE VISUAL');
    lines.push(
      'As referências abaixo demonstram acabamento profissional. Aproveitas as qualidades indicadas e mais nada.',
    );

    for (const usage of describedOnly) {
      lines.push(`· Aproveitar: ${usage.take.join('; ')}.`);
      const bans = transferBans(usage.doNotTransfer);
      if (bans.length > 0) lines.push(`· NÃO transferir para esta arte: ${bans.join(', ')}.`);
      const cautions = referenceCautions(usage.referenceId);
      if (cautions) lines.push(`· Cuidado: ${cautions}.`);
    }

    lines.push(
      'Nenhuma destas referências define o conteúdo, a cena nem a composição desta publicação. O conteúdo vem da ideia e dos produtos acima.',
      '',
    );
  }

  if (input.references.length > 0) {
    lines.push('IMAGENS ANEXADAS — o papel de cada uma');
    input.references.forEach((reference, index) => {
      if (reference.role === 'estetica') {
        /*
          Uma referência estética NUNCA é imagem-base de uma edição.

          É a distinção que o §9 da especificação exige: o gerador tem de
          saber que aquela imagem é um exemplo de acabamento e não um ponto
          de partida a modificar.

          O rótulo é o identificador da referência: é com ele que cada
          imagem leva, ao lado, o que dela se aproveita e o que não se
          copia. Dito em bloco, longe da imagem, o gerador não sabia a qual
          das duas cada proibição pertencia.
        */
        const usage = input.referenceUsage.find((entry) => entry.referenceId === reference.label);
        const take = usage?.take.length ? ` Aproveita: ${usage.take.join('; ')}.` : '';
        const bans = transferBans(usage?.doNotTransfer ?? []);
        const avoid = bans.length ? ` NÃO copies desta imagem: ${bans.join(', ')}.` : '';
        const cautions = referenceCautions(reference.label);
        const care = cautions ? ` Cuidado: ${cautions}.` : '';
        /*
          As palavras da imagem, ditas à parte. Numa geração real o frasco do
          cliente saiu com «CLAUDE» no rótulo — o nome de um dos serviços
          escritos no painel da referência. "Não copies os serviços" não
          chegava: o gerador não os leu como serviços, leu-os como palavras.
        */
        /*
          "Exemplo de acabamento" passou a "exemplo de direcção artística".

          Dizia "não é uma arte a modificar nem a composição a seguir: nada
          do conteúdo dela entra" — e o gerador, com razão, deixava-a de
          lado por inteiro. Três artes de teste e nenhuma seguia o padrão
          das referências. Agora segue-se a LINGUAGEM GRÁFICA (como a
          fotografia, as formas e a tipografia se combinam); a disposição
          continua a vir do esboço e o conteúdo desta publicação.
        */
        lines.push(
          `${index + 1}. EXEMPLO DE DIRECÇÃO ARTÍSTICA — o nível e a linguagem gráfica que esta arte tem de atingir: como a fotografia, as formas e a tipografia se combinam numa peça desenhada, a luz e o acabamento.${take}${avoid}${care} Segue essa linguagem gráfica; a disposição vem ${sketchIndex > 0 ? 'do esboço' : 'desta ideia'} e o conteúdo vem desta publicação. As palavras, os números e as marcas escritos nesta imagem não são texto desta arte, nem em rótulos nem em ecrãs. Nada do conteúdo dela — pessoas, produtos, cena, textos — entra nesta publicação.`,
        );
      } else if (reference.role === 'logotipo') {
        // Segunda das três repetições. Ver o bloco MARCA.
        lines.push(
          `${index + 1}. LOGÓTIPO REAL E REGISTADO de ${input.company}. Reproduz exactamente esta forma e estas cores na arte. Não é uma sugestão de estilo nem um ponto de partida: é o logótipo, e tem de sair igual.`,
        );
      } else if (reference.role === 'estilo-marca') {
        /*
          Arte anterior da própria empresa. O rótulo é o que ela MOSTRA,
          escrito na leitura do estilo — e é exactamente o que não passa.
        */
        lines.push(
          `${index + 1}. ARTE ANTERIOR DA MARCA — referência de ESTILO, não de conteúdo. Aproveita a tipografia, o uso da cor, os grafismos e o acabamento. NÃO copies o que ela mostra (${reference.label}): nem a composição, nem os textos, nem os produtos.`,
        );
      } else if (reference.role === 'recriar') {
        /*
          ──────────────────────────────────────────────────────────────────
          ARTE A RECRIAR — "faz assim, mas da minha empresa".

          Aproveita-se a ESTRUTURA: a organização, a hierarquia, o tipo de
          cena e de imagem, o ritmo do texto. Troca-se tudo o que pertence a
          quem a fez — e as pessoas e as fotografias também, porque são
          trabalho de outra pessoa e não passam a ser desta empresa por
          estarem numa arte que o cliente gostou.
          ──────────────────────────────────────────────────────────────────
        */
        const note = reference.label && reference.label !== 'arte a recriar' ? ` O cliente diz: "${reference.label}".` : '';
        lines.push(
          `${index + 1}. ARTE A RECRIAR PARA ${input.company.toUpperCase()} — o cliente quer uma publicação como esta, mas da empresa dele.${note} Mantém a composição, a hierarquia, o enquadramento, o tipo de cena e o tratamento visual. Troca TUDO o que é da outra marca: o logótipo, o nome, as cores, os textos, os produtos, as pessoas e as fotografias. As pessoas e os objectos são novos, gerados de raiz; as cores passam a ser as desta marca; os textos são os da lista acima.`,
        );
      } else if (reference.role === 'esboco') {
        /*
          ──────────────────────────────────────────────────────────────────
          O ESBOÇO: diz ONDE, nunca COMO.

          É cinzento e sem palavras de propósito — um esboço com "TÍTULO"
          escrito fazia escrever "TÍTULO". O risco que sobra é o gerador
          copiar o aspecto do esboço: caixas lisas, barras, a cruz. Por isso
          a frase final, a lista negativa e a verificação dizem o mesmo.
          ──────────────────────────────────────────────────────────────────
        */
        /*
          O cinzento à volta ERA "cena que continua: a arte é UMA fotografia
          contínua". Foi escrito contra a arte partida em dois painéis, e
          tirou ao gerador a liberdade de desenhar — fundo de cor da marca,
          formas, camadas. Passou a ser a base ou a fotografia, conforme o
          design da ideia; o que continua proibido é a mancha virar painel.
        */
        const contactsWhere = input.contactsPlacement === 'rodape'
          ? 'as barras finas no fundo são os contactos'
          : input.texts.cta
            ? 'as barras finas logo por baixo dele são os contactos'
            : 'as barras finas no fim do texto são os contactos';
        const parts = [
          'A mancha cinzenta mais escura, de contornos suaves, é onde assenta o protagonista da imagem',
          'as barras escuras são as linhas de texto (as mais grossas são o título, com o número de linhas certo)',
          ...(input.texts.cta ? ['o rectângulo arredondado escuro e comprido é o botão'] : []),
          ...(input.contacts.length > 0 ? [contactsWhere] : []),
          ...(input.drawLogo
            ? ['o rectângulo escuro pequeno é o logótipo, no sítio e no tamanho exactos']
            : []),
        ];
        lines.push(
          `${index + 1}. ESBOÇO DA DISPOSIÇÃO aprovado pelo cliente — mostra só ONDE fica cada coisa e com que tamanho. ${parts.join('; ')}. O cinzento claro à volta é a cor de base da arte ou a fotografia que continua, conforme o design desta ideia — a mancha não é um painel nem uma moldura, é só onde o protagonista fica. A arte final mantém a GEOMETRIA deste esboço: cada forma é substituída pelo elemento real no mesmo sítio, com o mesmo tamanho e à mesma distância das arestas — não as aproximes das arestas. NÃO é uma referência de estilo nem de cor: não desenhes cinzentos lisos, barras, caixas, cruzes nem contornos — a arte final é uma publicação acabada, com fotografia, design e as cores da marca.`,
        );
      } else if (reference.role === 'captura') {
        lines.push(
          `${index + 1}. Captura de ecrã do cliente — "${reference.label}". Aparece no ecrã de um dispositivo da cena (telemóvel, portátil, televisão), fiel ao que lá está, com o ecrã de frente o suficiente para se reconhecer.`,
        );
      } else {
        /*
          O rótulo pode ser a explicação que o cliente escreveu sobre a
          fotografia. Vai tal e qual: ele sabe o que quer daquela imagem
          melhor do que nós.
        */
        /*
          "Embalagem" servia um produto, e o cliente também anexa capturas
          de ecrã do site, fotografias do espaço, imagens de serviço. Uma
          captura de ecrã descrita como embalagem não tinha onde entrar na
          cena — e não entrava.
        */
        lines.push(
          `${index + 1}. Imagem do cliente — "${reference.label}". Material real, que entra na arte: um produto aparece com a embalagem, a cor e a forma reais; uma captura de ecrã de um site ou de uma aplicação aparece no ecrã de um dispositivo da cena (telemóvel, portátil, televisão), fiel ao que lá está.`,
        );
      }
    });
    /*
      Dois exemplos de acabamento não são duas direcções a misturar. A
      biblioteca tem agora referências com técnicas que não combinam — uma
      colagem desportiva e um produto em estúdio, por exemplo —, e a arte
      tem de escolher uma linguagem só.
    */
    const examples = input.references.filter((entry) => entry.role === 'estetica').length;
    if (examples + describedOnly.length > 1) {
      lines.push(
        'Com mais de um exemplo de direcção artística: de cada um aproveita só o que está indicado ao lado dele. A arte segue UMA linguagem visual coerente — a desta ideia —, não uma mistura de linguagens.',
      );
    }
    lines.push('');
  }

  /*
    Identidade aprovada no cadastro.

    Vem depois da cena e antes das regras gerais, de propósito: é o que faz
    duas publicações da mesma empresa parecerem da mesma empresa. Sem este
    bloco, cada geração reinventava a luz e o nível de decoração.
  */
  const guidelines = input.guidelines;
  if (guidelines) {
    const entries = [
      guidelines.lighting && `luz: ${guidelines.lighting}`,
      guidelines.framing && `enquadramento: ${guidelines.framing}`,
      guidelines.photoTreatment && `tratamento fotográfico: ${guidelines.photoTreatment}`,
      guidelines.decorationLevel && `decoração: ${guidelines.decorationLevel}`,
      guidelines.cornerRadius && `cantos dos elementos: ${guidelines.cornerRadius}`,
      guidelines.shadow && `sombras: ${guidelines.shadow}`,
    ].filter(Boolean) as string[];

    /*
      Superfícies e texto por PALAVRAS, como o resto da paleta.

      `describeColor` traduz o hexadecimal para linguagem natural pela mesma
      razão que o faz acima: um gerador de imagem que vê `#F4F2EE` desenha
      "#F4F2EE". Os papéis só entram quando a identidade os declara — não
      inventamos um fundo que o cliente não aprovou.
    */
    const surfaces = guidelines.surfaces;
    if (surfaces) {
      if (surfaces.bgLight) {
        entries.push(`superfície clara da marca: ${describeColor(surfaces.bgLight)}`);
      }
      if (surfaces.bgDark) {
        entries.push(`superfície escura da marca: ${describeColor(surfaces.bgDark)}`);
      }
      if (surfaces.textOnLight) {
        entries.push(
          `texto sobre fundo claro: ${describeColor(surfaces.textOnLight)}`,
        );
      }
      if (surfaces.textOnDark) {
        entries.push(`texto sobre fundo escuro: ${describeColor(surfaces.textOnDark)}`);
      }
    }

    if (entries.length > 0 || guidelines.fixedRules.length > 0) {
      lines.push('IDENTIDADE DA MARCA (aprovada pelo cliente)');
      lines.push('Estas regras valem para todas as publicações desta empresa.');
      for (const entry of entries) lines.push(`· ${entry}`);
      for (const rule of guidelines.fixedRules) lines.push(`· ${rule}`);
      if (guidelines.tone) lines.push(`· tom da comunicação: ${guidelines.tone}`);
      if (guidelines.avoid.length > 0) {
        lines.push(`· o cliente pediu para evitar: ${guidelines.avoid.join(', ')}`);
      }
      lines.push('');
    }
  }

  /*
    A MEMÓRIA DA EMPRESA, depois da identidade.

    São preferências aprendidas com o uso — o que o cliente corrige, recusa
    e aprova —, e algumas escritas por ele. Valem menos do que a identidade
    aprovada e do que esta publicação pede: são tendências, não regras de
    marca.
  */
  const memory = (input.memory ?? []).filter((rule) => rule.trim());
  if (memory.length > 0) {
    lines.push('PREFERÊNCIAS DESTA EMPRESA — aprendidas com o uso');
    lines.push(
      'O cliente tem mostrado o que prefere. Segue estas preferências sempre que não contrariem o que esta publicação pede:',
    );
    for (const rule of memory.slice(0, 10)) lines.push(`· ${rule.trim()}`);
    lines.push('');
  }

  /*
    ──────────────────────────────────────────────────────────────────────────
    MARGEM DE SEGURANÇA.

    Bloco novo, e cada linha responde a um defeito visto numa arte real: o
    logótipo cortado a meio pela aresta de cima, os cartões a tocar na borda
    lateral, e nada a separar o conteúdo do limite da imagem.

    O número é explícito porque "deixa margem" não significa nada para um
    gerador — "oito por cento de cada lado" significa. E é repetido na
    proibição final, que é o bloco tratado de forma mais literal.
    ──────────────────────────────────────────────────────────────────────────
  */
  /*
    O logótipo só aparece nestas regras quando vai anexado. Sem ficheiro,
    cada menção era um convite a inventar um — ver o bloco MARCA.
  */
  /*
    As margens já contam com o recorte da moldura (`safeMargins`).

    Eram "8% da largura em todos os lados", medidos na imagem do gerador. Na
    publicação de Instagram, a imagem vem em 3:4 e a moldura é 4:5: perdem-se
    cerca de 4% em cima e em baixo, e o que estava a 5% da aresta de baixo —
    os contactos, "pequenos e discretos no rodapé" — ficava cortado ao meio.
    Os números vêm calculados; o prompt não explica o recorte, porque
    mencionar uma faixa já fez o gerador desenhá-la.
  */
  lines.push('MARGEM — regra de acabamento');
  const marginItems = [
    'texto',
    ...(input.drawLogo ? ['logótipo'] : []),
    'contactos',
    ...(hasCta ? ['botão'] : []),
    'produto',
  ];
  lines.push(
    `Reserva uma margem livre de ${input.frame.topBottom}% da altura em cima e em baixo, e de ${input.frame.sides}% da largura de cada lado. Nada de ${marginItems.join(', de ').replace(/, de (?!.*, de )/, ' ou de ')} entra nessas margens.`,
    'A cena e o fundo continuam até às arestas; a margem só afasta o conteúdo delas.',
    'Nenhum elemento é cortado pela aresta da imagem. Se algo não cabe dentro da margem, reduz o tamanho desse elemento em vez de o deixar sair da moldura.',
  );
  if (input.drawLogo) {
    lines.push(
      'O logótipo fica inteiro e com folga em volta: a assinatura de uma marca cortada ao meio é um erro de produção, não um enquadramento ousado.',
    );
  }
  lines.push('');

  lines.push('REGRAS');
  lines.push(
    '· Uma peça única e integrada: fotografia, formas e texto na mesma composição, com luz e sombras coerentes.',
  );
  lines.push(
    input.drawLogo
      ? '· Espaço livre suficiente para o texto e para o logótipo.'
      : '· Espaço livre suficiente para o texto.',
  );
  lines.push('· Fidelidade aos produtos e às informações fornecidas.');
  lines.push('· Nenhuma palavra fora da lista de texto acima.');
  lines.push('· Sem marcas de água, sem assinaturas, sem molduras à volta da arte.');
  /*
    Disciplina de cor — no DESIGN.

    A arte saiu com um amarelo que ninguém escolheu: a secundária da marca é
    um creme quente, e o gerador leu-a como amarelo saturado. As cores dos
    PRODUTOS são legítimas — o cartão laranja é a cor da própria Crunchyroll
    — e as da fotografia também (ver CORES DESTA ARTE); o fundo, as formas,
    o texto e o botão é que têm de ser da paleta da empresa.
  */
  lines.push(
    `· No design — fundo, formas, texto${hasCta ? ', botão' : ''} e realces — usa SÓ as cores da marca acima e o tom claro ou escuro que o texto precisar. Não introduzas outra cor no design.`,
    '· Respeita o tom exacto de cada cor: um creme não é amarelo, um azul-marinho não é azul vivo.',
  );

  /*
    As proibições de cada referência repetidas na lista negativa.

    Redundância deliberada. A lista negativa é o último bloco do prompt e o
    que os geradores respeitam de forma mais literal; a secção das
    referências é prosa. Um objecto que não pode aparecer tem mais garantias
    nos dois sítios do que num só.
  */
  /*
    Numa entrada só, presa aos exemplos. Soltas, "a mulher", "as mãos" e
    "os logótipos visíveis" eram proibições gerais: a lista negativa de uma
    ideia com uma mulher a escolher um perfume dizia "não incluir: a
    mulher".
  */
  const referenceBanList = [
    ...new Set(input.referenceUsage.flatMap((usage) => transferBans(usage.doNotTransfer))),
  ];
  const referenceBans =
    referenceBanList.length > 0
      ? [`elementos copiados dos exemplos de acabamento (${referenceBanList.join(', ')})`]
      : [];
  // O cartaz de texto sobre fundo liso, na lista que o gerador lê à letra.
  // Com uma arte a recriar, manda o nível dela.
  const flatBans =
    typographic || recreate.length > 0
      ? []
      : ['cartaz só de texto', 'fundo de cor lisa sem imagem', 'arte sem imagem protagonista'];
  // O que nunca passa da arte de outra empresa, também na lista negativa.
  const recreateBans =
    recreate.length > 0
      ? [
          'o logótipo da arte a recriar',
          'o nome da empresa da arte a recriar',
          'as pessoas da arte a recriar',
          'as fotografias da arte a recriar',
          'os textos da arte a recriar',
        ]
      : [];
  const contactBans =
    input.contacts.length > 0
      ? [
          'contactos cortados pela aresta',
          'contactos em letra minúscula ilegível',
          'contactos empilhados por cima ou por baixo do logótipo',
        ]
      : [];
  const priceBans = [
    'preços inventados',
    'valores em dólares, euros ou outra moeda estrangeira',
    'texto pequeno inventado dentro de ecrãs',
  ];
  // O aspecto do esboço não pode passar para a arte.
  const sketchBans =
    sketchIndex > 0
      ? [
          'caixas cinzentas lisas',
          'barras cinzentas no lugar do texto',
          'cruzes de esboço',
          'aspecto de wireframe ou de maqueta',
        ]
      : [];

  /*
    O conteúdo das artes anteriores da marca, na lista negativa.

    A mesma redundância das referências da biblioteca: dito em prosa no
    bloco do estilo e repetido aqui, onde os geradores obedecem mais à
    letra.
  */
  const styleBans = input.references
    .filter((reference) => reference.role === 'estilo-marca' && reference.label.trim())
    .map((reference) => `o conteúdo da arte anterior da marca (${reference.label.trim()})`);
  if (styleBans.length > 0) styleBans.push('cópia de uma arte anterior da marca');

  // Sem botão: o cliente retirou-o, e o gerador põe um por hábito.
  const ctaBans = input.texts.cta ? [] : ['botões', 'chamadas para acção'];
  /*
    A fotografia a preto e branco, que três artes de teste trouxeram. Fica
    de fora quando a marca a usa de propósito — é o estilo dela.
  */
  const monochromeStyle = /preto e branco|monocrom/i.test(
    `${input.brandStyle?.imagery ?? ''} ${input.brandStyle?.color ?? ''}`,
  );
  const colorBans = monochromeStyle
    ? []
    : ['fotografia dessaturada ou a preto e branco', 'arte inteira em tons de cinzento'];

  lines.push(
    `· Não incluir: ${[
      ...new Set([
        ...ARTWORK_NEGATIVE,
        ...(input.drawLogo ? LOGO_NEGATIVE : []),
        ...flatBans,
        ...ctaBans,
        ...colorBans,
        ...contactBans,
        ...priceBans,
        ...sketchBans,
        ...recreateBans,
        ...referenceBans,
        ...styleBans,
        ...(guidelines?.avoid ?? []),
      ]),
    ].join(', ')}.`,
  );

  return lines.join('\n');
}

/** Uma frase sem a pontuação final, para lhe pôr a nossa. */
function endless(value: string): string {
  return value.trim().replace(/[\s.;:]+$/, '');
}

/** "4, 5 e 6" — uma lista como se escreve. */
function joinPt(values: Array<string | number>): string {
  if (values.length <= 1) return values.join('');
  return `${values.slice(0, -1).join(', ')} e ${values[values.length - 1]}`;
}

/**
 * O formato por palavras, para o gerador.
 *
 * Não é só a proporção: é onde a mensagem pode assentar. Num story a
 * interface tapa o topo e a base; numa capa de reels tapa mais ainda, e por
 * isso pede-se o peso ao centro. Sem esta nota, o gerador punha o título
 * exactamente onde o Instagram desenha os botões.
 */
const FORMAT_WORDS: Record<FormatId, string> = {
  vertical: 'vertical 4:5, para feed de Instagram e Facebook',
  quadrado: 'quadrado 1:1, para feed de qualquer rede',
  story:
    'vertical 9:16, para story de ecrã inteiro — o peso visual e o texto ficam no terço central, porque a aplicação tapa o topo e a base',
  reels:
    'vertical 9:16, capa de Reels — composição de impacto imediato, com o assunto e o texto ao centro, bem longe das bordas de cima e de baixo onde ficam a legenda e os botões',
  linkedin:
    'deitado panorâmico, para feed de LinkedIn — registo mais sóbrio e profissional, com o assunto de um lado e o texto do outro',
  horizontal:
    'deitado 16:9, para miniatura de vídeo e capas — leitura à distância, com poucos elementos e texto grande',
};

/*
  As palavras das posições do logótipo saíram daqui.

  Traduziam `inferior-direito` em "canto inferior direito" para a instrução
  do gerador. Deixou de haver instrução de posição: é quem compõe a imagem
  que decide onde a marca assenta, porque é quem sabe onde ficou o espaço
  livre.
*/

/**
 * As proibições de uma referência que esta arte pode receber.
 *
 * Saem as de cor: as cores da arte são as da marca, e essa regra já está
 * escrita. "Não copies: a cor azul", vindo de uma referência da DOT, ia para
 * a arte de uma perfumaria cuja cor dominante é azul-escuro.
 */
function transferBans(bans: string[]): string[] {
  return bans.filter((ban) => !/^(a|as|o|os)\s+(cor|cores|tom|tons)\b/i.test(ban.trim()));
}

/**
 * Os cuidados de uma referência do catálogo, numa frase.
 *
 * Vêm do cadastro, como as proibições: "não inventar funcionalidades",
 * "não associar a promessas de lucro". Dizem como usar a referência sem
 * inventar nada — o que ela demonstra fica, a promessa dela não.
 */
function referenceCautions(referenceId: string): string {
  return (getReference(referenceId)?.cautions ?? [])
    .map((caution) => caution.trim().replace(/[.;]+$/, ''))
    .filter(Boolean)
    .join('; ');
}

/**
 * Proibições que valem para qualquer modelo na geração de arte completa.
 *
 * Não repetimos aqui o `negative` do modelo: esse descreve o cenário e seria
 * contraditório numa arte que PRECISA de texto e de produtos.
 */
const ARTWORK_NEGATIVE = [
  'texto inventado',
  'palavras sem sentido',
  'letras deformadas',
  'marcas de água',
  'logótipos de outras empresas',
  // "À volta da arte": as formas da marca DENTRO da composição são design.
  'molduras decorativas à volta da arte',
  'aspecto de banco de imagens genérico',
  // O gerador transformou a descrição da paleta numa tabela de amostras.
  // Estas proibições são a resposta directa a esse resultado.
  'amostras de cor',
  'paletas de cor',
  'códigos hexadecimais',
  'etiquetas como "primary" ou "secondary"',
  'barras de cor no topo ou no fundo',
  'faixas decorativas a delimitar o enquadramento',
  'aspecto de apresentação de identidade visual',
  // O gerador escreveu a palavra "Logo" como marcador de posição.
  'a palavra "logo"',
  'marcadores de posição',
  'texto de exemplo',
  /*
    Acabamento. Cada uma destas foi vista numa arte real.
  */
  'elementos cortados pela aresta da imagem',
  'conteúdo encostado à borda sem margem',
  'cores fora da paleta da marca no texto e nos realces',
  'amarelo saturado quando a cor da marca é creme',
  /*
    Sem referência de composição, o gerador partia a arte ao meio: painel de
    cor com o texto em cima, fotografia em baixo. Era "arte dividida em
    painéis", "bloco de cor achatado atrás do texto", "metade da imagem
    ocupada por fundo liso", "colagens" e "caixas aplicadas por cima" — e
    juntas proibiam o design inteiro: as formas da marca, o produto
    recortado sobre a cor de base, as camadas. Ficou o defeito, dito como
    defeito.
  */
  'arte partida em duas metades sem ligação entre elas',
  'caixas cinzentas genéricas por trás do texto',
  'enfeites soltos sem função',
  'aspecto de modelo de apresentação',
];

/**
 * Terceira das três repetições sobre o logótipo.
 *
 * A lista negativa é o bloco que os geradores tratam de forma mais literal,
 * e por isso é aqui que as proibições sobre a marca têm mais efeito. Ver o
 * bloco MARCA para o motivo da redundância.
 *
 * Só entra quando o logótipo vai anexado. Sem ficheiro, seis frases sobre um
 * logótipo eram seis menções a um elemento que não existe — e mencionar um
 * elemento é o que o faz aparecer.
 */
const LOGO_NEGATIVE = [
  // O defeito que abriu esta frente de trabalho: o logótipo da DOT saiu
  // espelhado numa arte real.
  'logótipo espelhado, invertido ou em perspectiva',
  'logótipo redesenhado ou simplificado',
  'logótipo com cores alteradas',
  'o nome da empresa escrito por baixo ou ao lado do logótipo',
  'logótipo sobreposto ao título ou a outro texto',
  'logótipo cortado pela margem',
  'logótipo a tocar no limite da imagem',
  'dois logótipos na mesma arte',
];

export function buildImagePrompt(
  description: string,
  template?: { generation: { scenePrompt: string; negative: string[]; preserve: string[] } },
): string {
  const negative = [
    'texto',
    'letras',
    'números',
    'logótipos',
    'marcas de água',
    ...(template?.generation.negative ?? []),
  ];
  // Sem duplicados: a mesma proibição repetida não a torna mais forte, só
  // consome o orçamento de atenção do modelo.
  const unique = [...new Set(negative.map((term) => term.toLowerCase()))];

  return [
    description.trim() || template?.generation.scenePrompt?.trim() || '',
    template ? `Preservar: ${template.generation.preserve.join('; ')}.` : '',
    `Não incluir: ${unique.join(', ')}.`,
    'A imagem é só o ambiente. Os textos, o logótipo e os produtos são montados por cima, pela aplicação.',
  ]
    .filter(Boolean)
    .join(' ');
}
