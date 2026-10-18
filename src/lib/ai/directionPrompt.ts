import { LAYOUTS } from '@/lib/composition/layouts';
import { describeColor } from '@/lib/composition/palette';
import { CONTACT_TYPES, SEGMENTS, STYLES } from '@/lib/domain/catalog';
import { TECHNIQUES } from './directionSchema';
import type { AttachmentKind, ContactType, StyleId } from '@/lib/domain/types';
import { detectPrices, formatKz } from '@/lib/utils/money';

/**
 * Instruções para interpretar o pedido e propor direcções criativas.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Substitui o prompt de planeamento antigo, que apresentava ao modelo uma
 * lista de MODELOS da biblioteca e lhe pedia que escolhesse um. Com um único
 * modelo disponível, a escolha era uma formalidade e a cena saía sempre a
 * mesma.
 *
 * Aqui o modelo não escolhe nada de uma biblioteca: cria. Recebe o pedido, a
 * marca e o estilo, e propõe direcções próprias. A biblioteca de referências
 * entra depois, do lado do servidor, e só para orientar o acabamento.
 *
 * Nada neste prompt menciona uma referência, uma cena existente ou um
 * objecto a reutilizar. É de propósito: mencionar o tabuleiro ao modelo que
 * propõe conceitos era oferecer-lhe o tabuleiro.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function buildDirectionSystemPrompt(): string {
  return [
    'És um director criativo que prepara publicações para redes sociais de pequenas e médias empresas em Angola.',
    'Respondes SEMPRE em português europeu, com vocabulário usado em Angola (ficheiro, telemóvel, descarregar, guardar).',
    'Tratas o leitor por TU, nunca por "você" nem na terceira pessoa.',
    'Não usas pontos de exclamação.',
    'Devolves EXCLUSIVAMENTE um objecto JSON válido, sem texto antes ou depois, sem blocos de código.',
    '',
    'PRIORIDADE DA INFORMAÇÃO, por ordem. Não a inverte nunca:',
    '1. Informações confirmadas e alterações aprovadas pelo cliente.',
    '2. Restrições obrigatórias da marca.',
    '3. Objectivo e conteúdo do pedido.',
    '4. Estilo escolhido e preferências visuais.',
    '5. Características úteis das referências.',
    '6. As tuas sugestões criativas.',
    '',
    'REGRAS QUE NÃO PODES QUEBRAR',
    '1. Não inventes preços, descontos, percentagens, prazos, condições de venda, características de produtos, contactos, endereços, qualificações, prémios nem resultados. Se o pedido não o disser e o perfil da empresa não o tiver, não existe.',
    '2. O campo "price" só pode conter um valor que apareça no pedido. Sem preço no pedido, devolve "".',
    '3. "items" são nomes curtos de produtos ou serviços, e cada um tem de vir do pedido ou do perfil da empresa. Não acrescentes opções que a empresa não mencionou.',
    '4. Se faltar informação indispensável, acrescenta uma entrada em "missingFields" com uma pergunta curta. Pergunta APENAS o que impede uma decisão segura — não uses este campo para pedir detalhes que consegues resolver.',
    '5. Não reescrevas os textos marcados como protegidos: devolve-os exactamente como foram dados.',
    '6. Os nomes de "items" são desenhados nas peças da arte. Não os repitas no título nem no subtítulo: aí escreve a mensagem, não a lista.',
    /*
      O modelo criativo evitava as marcas que o cliente revende: "Paga a tua
      subscrição em kwanzas" para um pedido sobre a Netflix. Para uma loja
      que vende subscrições, o nome do serviço É o anúncio.
    */
    '7. O produto, o serviço ou a marca que o cliente anuncia aparece no título ou no texto de apoio, escrito como ele o escreveu. Se o pedido é sobre a Netflix, a palavra Netflix está nos textos.',
    '8. Os preços estão sempre em kwanzas (Kz). Nunca dólares, euros nem outra moeda — nem num ecrã da cena.',
    '',
    /*
      Numa geração real: título "Perfumaria Kianda com elegância ao teu
      alcance", com o nome que o logótipo já mostra ao lado; botão
      "Encomenda pelo WhatsApp: +244 923 000 000", com o número repetido na
      linha dos contactos logo por baixo. Duas linhas da arte gastas a dizer
      o que já lá estava.
    */
    'TEXTOS DA ARTE — escritos como numa agência:',
    '· "headline": a ideia desta publicação em 3 a 8 palavras. Não repete o nome da própria empresa, que o logótipo já mostra, a não ser que o pedido o peça. Não leva o preço: o preço tem campo próprio.',
    '· "subheadline": uma frase concreta, até 14 palavras: o que o cliente ganha ou como compra.',
    '· "cta": uma acção de 1 a 4 palavras, como "Encomenda já" ou "Fala connosco". Nunca um número de telefone, um website nem um endereço — esses vão na linha de contactos da arte.',
    '· "badge": opcional, até 4 palavras, só com um facto do pedido ou do perfil da empresa.',
    '',
    'DIRECÇÕES CRIATIVAS',
    /*
      A contagem é repetida e explícita de propósito.

      Com um pedido brando — "propões 2 ou 3 direcções" — o modelo devolvia
      consistentemente UMA, e a validação tolerante aceitava-a. O resultado
      era "Outra ideia" sem nada em banco: cada pedido de alternativa custava
      uma chamada nova. A forma da resposta mostra agora dois objectos, que é
      o sinal mais forte que um exemplo pode dar.
    */
    'Em "concepts" devolves OBRIGATORIAMENTE 3 direcções. Não 1, não 2: três. Uma resposta com menos de três entradas em "concepts" está incompleta.',
    'Cada uma é uma IDEIA própria, criada a partir deste pedido e desta marca.',
    '',
    'As três têm de diferir na IDEIA ou na COMPOSIÇÃO, não na cor do fundo. Duas variações da mesma cena não são duas direcções.',
    'Usa abordagens diferentes entre elas: se a primeira é "produto-em-contexto", a segunda não pode ser outra vez "produto-em-contexto" com outro ângulo.',
    '',
    /*
      ────────────────────────────────────────────────────────────────────────
      O NÍVEL DE QUALIDADE vem antes das abordagens.

      O prompt dizia "a maior parte das publicações resolve-se com o produto
      bem fotografado" e oferecia "tipografica — a mensagem resolvida com
      tipografia, sem cena montada" como abordagem igual às outras. Para um
      serviço sem produto físico — pagar a Netflix em kwanzas — o modelo
      escolheu-a, escreveu "fundo azul escuro com texto em amarelo muito
      claro", e a arte foi exactamente isso: um cartaz de texto, ao lado de
      uma biblioteca de referências cheia de cenas com pessoas, dispositivos,
      luz e profundidade.

      A frase contra metáforas e efeitos especiais fica, reformulada: o
      excesso de cenas encenadas era um defeito real. Mas uma imagem forte
      não é um efeito especial — é o mínimo.
      ────────────────────────────────────────────────────────────────────────
    */
    'NÍVEL DE QUALIDADE — o padrão de uma agência de publicidade, não o de um cartaz de texto:',
    '· Cada direcção tem um PROTAGONISTA VISUAL concreto e fotográfico: uma pessoa, o produto, um dispositivo, ou um objecto 3D que represente a oferta.',
    '· Volume real: a fotografia tem planos — primeiro plano, plano médio, fundo — ou, quando o protagonista vai recortado sobre a cor de base, sombras e sobreposições que lhe dão volume. Nunca um fundo liso só com texto.',
    '· Luz desenhada: uma luz principal, luz de recorte e reflexos que puxam as cores da marca.',
    /*
      Esta linha dizia "mostra-se EM USO: alguém a usá-lo num telemóvel ou
      num ecrã". Resolveu o cartaz de texto e criou outro defeito: todas as
      ideias de serviços digitais passaram a ser uma mão a segurar um
      telemóvel — a imagem mais genérica que um banco de imagens tem.
    */
    '· Um serviço digital — subscrições, pagamentos, aplicações, software — mostra-se pelo que PROPORCIONA: o resultado, o momento, a vantagem concreta para quem o compra. Um dispositivo pode aparecer, mas como parte de uma ideia, nunca como a ideia toda. Nunca o reduzas a texto.',
    '',
    /*
      ────────────────────────────────────────────────────────────────────────
      ORIGINALIDADE. O cliente recusou, com razão, "imagem genérica": a mão
      a segurar o telemóvel, o portátil desfocado ao fundo. Uma agência não
      é paga por isso — é paga pelo ÂNGULO.
      ────────────────────────────────────────────────────────────────────────
    */
    'ORIGINALIDADE — o que separa uma agência de um banco de imagens:',
    '· Cada direcção tem um ÂNGULO próprio desta mensagem: uma situação, um gesto, uma metáfora visual ou um objecto que só faz sentido para ESTE pedido e ESTA marca.',
    '· Teste da troca: se a cena servisse para anunciar outra empresa só trocando o logótipo, é genérica. Refaz antes de responder.',
    '· Clichés proibidos, porque qualquer banco de imagens os tem: uma mão a segurar um telemóvel em primeiro plano; alguém a sorrir para o portátil; um aperto de mãos; uma lâmpada acesa; um foguetão; um cérebro digital ou um robô para falar de IA; engrenagens; um gráfico a subir; um telemóvel a flutuar com ícones à volta; uma pessoa de fato a apontar para um ecrã; o produto sozinho num pedestal, pódio, bloco ou balcão com uma loja desfocada ao fundo; um frasco rodeado de pétalas, fumo ou salpicos.',
    '· O contexto é Angola: pessoas, lugares, luz e situações de cá, sem folclore nem estereótipos.',
    /*
      O segundo lote de referências tem bússolas, foguetões, diamantes,
      calendários e moedas — bem feitos, e por isso tentadores. Nenhum é a
      resposta automática a "estratégia", "crescimento" ou "premium".
    */
    '· Metáforas automáticas também são clichés: crescimento não pede dinheiro nem foguetões; planeamento não pede um calendário; estratégia não pede uma bússola; premium não pede diamantes nem dourado; tecnológico não pede néon; profissional não pede um render 3D. Um símbolo só entra quando nasce deste pedido e desta marca.',
    '',
    /*
      O gerador inventou a interface de um telemóvel com "USD 20 / mês" —
      preços que ninguém pediu, numa moeda que não é a do cliente. O ecrã é
      cena, e a cena também obedece à regra 1.
    */
    'ECRÃS NA CENA — num telemóvel, portátil ou televisão só aparecem os logótipos dos serviços anunciados, imagens do serviço, ou a captura de ecrã que o cliente anexou. Nunca preços, valores, moedas, nem texto inventado num ecrã.',
    'OBJECTOS NA CENA — um cartão, um saco ou uma caixa que a ideia acrescente são lisos: a mensagem vai nos textos da arte, não escrita em objectos. Os produtos do cliente mantêm os rótulos reais.',
    '',
    'DISPOSIÇÃO — cada direcção escolhe uma em "layout", e as três usam disposições DIFERENTES:',
    ...LAYOUTS.map((layout) => `· "${layout.id}" — ${layout.prompt}`),
    'Em "composition" descreves a cena DENTRO dessa disposição: onde fica o protagonista e para onde olha, e que zona da imagem fica calma para o texto assentar.',
    'Em "subject" dizes o que a imagem protagonista mostra: "pessoa", "produto", "dispositivo", "cena" (um objecto ou uma metáfora construída) ou "tipografia".',
    '',
    'Escolhe a abordagem que serve a mensagem, de entre estas:',
    '· "produto-em-contexto" — o produto ou o serviço no ambiente onde é usado;',
    '· "fotografia-simples" — o produto sozinho, com uma ideia de luz, de enquadramento ou de material que só sirva este pedido (nunca o pedestal de catálogo);',
    '· "editorial" — composição de revista, com grelha, imagem forte e texto;',
    '· "cena-conceptual" — uma ideia representada por uma cena construída;',
    '· "varios-produtos" — um conjunto organizado de produtos;',
    '· "tipografica" — SÓ quando o cliente pedir expressamente uma arte só de texto.',
    '',
    'Equilíbrio: nem todas as artes precisam de metáfora, mãos ou efeitos especiais — mas todas precisam de uma imagem forte. As três direcções usam protagonistas diferentes: por exemplo, uma com uma pessoa, outra com o produto ou o dispositivo em destaque, outra conceptual.',
    '',
    /*
      ────────────────────────────────────────────────────────────────────────
      O DESIGN DA PEÇA. As artes saíam como uma fotografia com o título, o
      logótipo e o botão pousados por cima — "não vejo comunicação nas
      artes", disse o cliente, e com razão. As referências de agência que a
      biblioteca tem são DESENHADAS: o produto recortado sobre a cor da
      marca, uma forma que liga a fotografia ao título, uma palavra em
      destaque. Era isso que faltava pedir.
      ────────────────────────────────────────────────────────────────────────
    */
    'DESIGN DA PEÇA — cada direcção é um ANÚNCIO DESENHADO, não uma fotografia com texto pousado por cima.',
    'Em "graphics" descreves 2 ou 3 recursos de design concretos, numa ou duas frases:',
    '· como a fotografia assenta no fundo: o protagonista recortado sobre a cor de base; dentro de uma forma da marca (círculo, arco, faixa inclinada, rectângulo de cantos redondos); ou a fotografia inteira, com uma zona calma onde o texto assenta;',
    '· uma forma que LIGA o texto à imagem: uma faixa na cor de realce que passa por trás do produto e do título, um arco que enquadra a pessoa, uma linha que conduz o olhar até ao botão, camadas que se sobrepõem;',
    '· a tipografia como elemento gráfico: uma palavra do título destacada na cor de realce, um título grande que o protagonista sobrepõe em parte, um número grande.',
    'Fala das cores pelo PAPEL, nunca pelo nome: "cor de base" (o fundo e as grandes áreas) e "cor de realce" (as formas, o botão, a palavra destacada). Qual das cores da marca é cada uma decide-se depois.',
    'As três direcções usam tratamentos DIFERENTES: se uma recorta o produto sobre a cor de base, outra usa a fotografia inteira e outra uma forma da marca.',
    'Cada forma tem uma função — agrupa, liga, enquadra ou conduz o olhar. Nada de enfeites soltos.',
    '',
    /*
      O cliente lê a ideia e a razão na revisão, e tinha texto a mais: "tem
      coisas que o cliente nem precisa de saber". A cena, a luz e os
      materiais seguem para o gerador; o cliente lê duas frases curtas.
    */
    '"idea" é a ideia central numa frase curta, ATÉ 16 PALAVRAS, nas palavras do cliente — sem termos técnicos (nada de "plano médio", "luz de recorte", "profundidade de campo", "cor de base").',
    '"scene" descreve o que se vê, como um director de fotografia: o protagonista, o ambiente, o que está em primeiro plano e ao fundo, as fontes de luz e a cor delas, o enquadramento da câmara. Concreta e visualizável.',
    '"composition" descreve a organização: onde assenta o assunto, onde assenta o texto, onde fica o espaço livre.',
    '"brandApplication" diz como as cores e a tipografia da empresa entram nesta arte.',
    '"rationale" é UMA frase curta, até 20 palavras, para o CLIENTE ler, a explicar porque esta direcção comunica a mensagem dele. Não escrevas raciocínio interno nem menciones referências.',
    '',
    'Em "techniquesWanted" indicas as qualidades visuais que esta direcção precisa de ver bem executadas. Serve para o sistema ir buscar exemplos de acabamento adequados. Escolhe 2 a 4, honestamente — não peças iluminação dramática para uma arte clean.',
    // A lista fechada, dita por extenso. Sem ela, um modelo melhor inventava
    // nomes — e um nome inventado não aponta para referência nenhuma.
    `Usa SÓ estes valores em "techniquesWanted": ${TECHNIQUES.join(', ')}.`,
    '',
    /*
      Era "a que melhor comunica, pesando clareza e viabilidade" — e o modelo
      escolhia a mais segura: o frasco num bloco de acrílico, com uma loja
      desfocada ao fundo. É a primeira ideia que o cliente vê.
    */
    'Em "chosen" indicas o índice da direcção com o ÂNGULO mais forte que ainda se percebe à primeira leitura. Nunca uma que falhe o teste da troca. A mais segura não é automaticamente a melhor, e a mais invulgar também não.',
  ].join('\n');
}

export type DirectionRequest = {
  brief: string;
  style: StyleId;
  format: string;
  imageCount: number;
  itemCount: number;
  attempt: number;
  brand: {
    name: string;
    segment: string;
    description: string;
    contacts: Array<{ type: ContactType; value: string }>;
    colors: { primary: string; secondary: string; accent?: string | null };
  };
  /** Regras da identidade aprovada, em palavras. */
  identity: {
    tone: string;
    avoid: string[];
    fixedRules: string[];
    constraints: string;
  } | null;
  lockedTexts: Partial<Record<string, string>>;
  /** Ideias recentes da mesma marca, para não repetir. */
  recentIdeas: string[];
  /** Ideia actual, quando o cliente pediu outra — ou pediu para a melhorar. */
  currentIdea: string | null;
  /**
   * "Melhorar a ideia": o que o cliente quer diferente. Com isto, a ideia
   * actual é para MELHORAR, não para evitar.
   */
  refinement?: string;
  /** Os textos actuais, que a melhoria mantém salvo se o pedido falar deles. */
  currentTexts?: Partial<Record<string, string>>;
  /** Os papéis de texto que o cliente apagou e que não podem voltar. */
  removedTexts?: string[];
  /** As outras ideias que o cliente já viu e trocou nesta publicação. */
  seenIdeas?: string[];
  /**
   * O estilo das artes que a empresa já publicou, em palavras. Vazio quando
   * não há. Opcional para os chamadores que não o conhecem.
   */
  learnedStyle?: string;
  /**
   * As imagens anexadas, pela ordem em que seguem no pedido, com a nota do
   * cliente e o tipo que ele lhes deu. `seen` diz se o modelo as recebe.
   */
  attachments?: Array<{ note: string; seen: boolean; kind?: AttachmentKind }>;
  /** A memória da empresa: regras curtas que o uso ensinou. */
  memory?: string[];
};

/** Os papéis de texto apagados, como o modelo os deve ler. */
const REMOVED_WORDS: Record<string, string> = {
  headline: 'headline — o título',
  subheadline: 'subheadline — o texto de apoio',
  price: 'price — o preço',
  cta: 'cta — o botão (sem chamada para acção nenhuma)',
  badge: 'badge — a etiqueta',
};

const ATTACHMENT_WORDS: Record<AttachmentKind, string> = {
  produto: 'material da empresa',
  captura: 'captura de ecrã',
  recriar: 'ARTE PARA RECRIAR com esta marca',
};

export function buildDirectionUserPrompt(request: DirectionRequest): string {
  const segment =
    SEGMENTS.find((entry) => entry.id === request.brand.segment)?.label ??
    request.brand.segment;

  const contactLines =
    request.brand.contacts.length > 0
      ? request.brand.contacts
          .map((contact) => {
            const label =
              CONTACT_TYPES.find((entry) => entry.type === contact.type)?.label ?? contact.type;
            return `- ${label}: ${contact.value}`;
          })
          .join('\n')
      : '- (nenhum contacto escolhido para esta publicação)';

  const prices = detectPrices(request.brief ?? '');
  const priceLine =
    prices.length > 0
      ? `Preço indicado pelo cliente: ${formatKz(prices[0].value)} — usa exactamente este valor.`
      : 'O cliente não indicou preço. O campo "price" tem de ficar vazio.';

  const lockedEntries = Object.entries(request.lockedTexts ?? {}).filter(([, value]) => value);

  const lines: string[] = [
    '## Pedido do cliente',
    request.brief?.trim() || '(vazio)',
    '',
    '## Empresa',
    `Nome: ${request.brand.name}`,
    `Actividade: ${segment}`,
    `Descrição: ${request.brand.description || '(não indicada)'}`,
    `Cores da marca: dominante ${describeColor(request.brand.colors.primary)}, apoio ${describeColor(
      request.brand.colors.secondary,
    )}${request.brand.colors.accent ? `, realce ${describeColor(request.brand.colors.accent)}` : ''}`,
    '',
    '## Contactos escolhidos para esta publicação',
    contactLines,
    '',
  ];

  if (request.identity) {
    lines.push('## Identidade aprovada da marca');
    if (request.identity.tone) lines.push(`Tom da comunicação: ${request.identity.tone}`);
    for (const rule of request.identity.fixedRules) lines.push(`- ${rule}`);
    if (request.identity.constraints.trim()) {
      lines.push(`- O cliente pediu: ${request.identity.constraints.trim()}`);
    }
    if (request.identity.avoid.length > 0) {
      lines.push(`- Evitar: ${request.identity.avoid.join(', ')}`);
    }
    lines.push(
      'Estas regras são obrigatórias. Se o pedido entrar em conflito com uma delas, não a alteres em silêncio: pergunta em "missingFields".',
      '',
    );
  }

  /*
    O estilo que a marca já usa, lido das artes que publicou.

    Entra no conceito para as três ideias nascerem dentro da linguagem da
    marca. O que varia é a cena e a composição de cada publicação — a
    linguagem visual é a mesma, que é o que torna as publicações
    reconhecíveis lado a lado num perfil.
  */
  if (request.learnedStyle?.trim()) {
    lines.push('## Estilo que a marca já usa nas suas artes');
    lines.push(request.learnedStyle.trim());
    lines.push(
      'As ideias propostas têm de caber neste estilo: cena, composição e enquadramento são novos em cada publicação, mas a linguagem visual é a da marca. Não proponhas uma estética que a marca não usa.',
      '',
    );
  }

  lines.push('## Parâmetros');
  lines.push(`Formato: ${request.format}`);

  /*
    O estilo entra como DESCRIÇÃO, não como etiqueta.

    "Estilo: clean" deixava o modelo preencher a palavra com o que ela lhe
    sugere — normalmente fundo branco. A descrição do catálogo diz o que o
    estilo é e, mais importante, o que não exige.
  */
  if (request.style === 'auto') {
    lines.push(
      'Estilo: AUTOMÁTICO. Escolhes tu, e devolves a escolha no campo "style". Decide pelo pedido e pela marca — nunca pelo estilo que te parece mais seguro.',
      'Estilos possíveis:',
      ...STYLES.filter((style) => style.id !== 'auto').map(
        (style) => `- ${style.id}: ${style.guidance}`,
      ),
    );
  } else {
    const style = STYLES.find((entry) => entry.id === request.style);
    lines.push(`Estilo escolhido pelo cliente: ${request.style}`);
    if (style?.guidance) lines.push(style.guidance);
  }

  lines.push(
    `Fotografias enviadas: ${request.imageCount}`,
    `Produtos já definidos: ${request.itemCount}`,
    priceLine,
    '',
  );

  /*
    As imagens do cliente ENTRAM na ideia.

    Antes a direcção só sabia quantas havia. Uma captura de ecrã da página
    onde se paga, enviada com a nota a explicá-la, era ignorada pelo
    conceito — e o gerador, que a recebia, não tinha uma ideia onde a pôr.
  */
  const attachments = request.attachments ?? [];
  if (attachments.length > 0) {
    const seen = attachments.some((attachment) => attachment.seen);
    const recreating = attachments.some((attachment) => attachment.kind === 'recriar');
    const material = attachments.some((attachment) => attachment.kind !== 'recriar');
    lines.push('## Imagens anexadas pelo cliente');
    lines.push(
      seen
        ? `Recebes ${attachments.length === 1 ? 'a imagem' : `as ${attachments.length} imagens`} junto com este pedido, por esta ordem, cada uma com o tipo que o cliente lhe deu.`
        : 'O cliente anexou estas imagens, cada uma com o tipo que lhe deu.',
    );
    attachments.forEach((attachment, index) => {
      const kind = ATTACHMENT_WORDS[attachment.kind ?? 'produto'];
      lines.push(
        `- Imagem ${index + 1} (${kind}): ${attachment.note ? `nota do cliente — «${attachment.note}»` : 'sem nota'}`,
      );
    });
    if (material) {
      lines.push(
        'O material da empresa e as capturas de ecrã ENTRAM na arte, e cada direcção diz em "scene" onde. Uma captura de ecrã de um site ou de uma aplicação aparece no ecrã de um dispositivo na cena, fiel ao que lá está. Um produto é protagonista, com a embalagem, a cor e a forma reais. Segue o que a nota do cliente pedir.',
      );
    }
    /*
      ────────────────────────────────────────────────────────────────────────
      ARTE PARA RECRIAR — "faz como esta, mas da minha empresa".

      O cliente viu uma publicação que gostou e quer a mesma, com a marca
      dele. Aproveita-se a ESTRUTURA; tudo o que pertence a quem a fez —
      logótipo, nome, pessoas, fotografias, textos — fica de fora. Os textos
      saem do pedido, como sempre: a regra 1 continua a valer, e um preço da
      arte de outra empresa não é um preço desta.
      ────────────────────────────────────────────────────────────────────────
    */
    if (recreating) {
      lines.push(
        'Uma ARTE PARA RECRIAR não entra na arte: é o modelo a seguir. A direcção escolhida em "chosen" mantém a composição, a hierarquia, o tipo de cena, o tipo de imagem e o ritmo do texto dela — com o conteúdo, as cores, a tipografia e os textos desta empresa. A abordagem é a que a arte original usa, mesmo que seja tipográfica.',
        'Os textos vêm do pedido do cliente, nunca da arte original. Da outra empresa não passa nada: nem o logótipo, nem o nome, nem as pessoas, nem as fotografias, nem os preços, nem as frases.',
        'As outras duas direcções podem afastar-se mais da arte original, mas partem dela.',
      );
    }
    lines.push('');
  }

  /*
    A memória da empresa: o que o uso ensinou.

    Depois das imagens e antes dos textos protegidos. São tendências — o que
    o cliente costuma recusar, corrigir e aprovar —, e por isso valem menos
    do que o pedido e do que a identidade aprovada.
  */
  const memory = (request.memory ?? []).filter((rule) => rule.trim());
  if (memory.length > 0) {
    lines.push('## O que já sabemos desta empresa (aprendido com o uso)');
    for (const rule of memory.slice(0, 10)) lines.push(`- ${rule.trim()}`);
    lines.push(
      'Segue estas preferências nas três direcções, sempre que não contrariem o pedido.',
      '',
    );
  }

  lines.push('## Textos protegidos (devolve-os sem alterar)');
  lines.push(
    lockedEntries.length > 0
      ? lockedEntries.map(([role, value]) => `- ${role}: ${value}`).join('\n')
      : '- (nenhum)',
  );
  lines.push('');

  /*
    Os textos que o cliente APAGOU.

    Voltavam: o plano seguinte preenchia tudo o que não estava protegido, e
    uma arte pedida sem botão saía com "Encomenda já". Dizer ao modelo é a
    primeira barreira; o browser não aplica o que ele devolver nesses campos.
  */
  const removed = (request.removedTexts ?? []).filter((role) => REMOVED_WORDS[role]);
  if (removed.length > 0) {
    lines.push('## Textos que o cliente retirou desta arte');
    for (const role of removed) lines.push(`- ${REMOVED_WORDS[role]}`);
    const one = removed.length === 1;
    lines.push(
      `Devolve ${removed.map((role) => `"${role}"`).join(', ')} ${one ? 'vazio' : 'vazios'} (""). Nenhuma direcção pode depender ${one ? 'dele' : 'deles'}${removed.includes('cta') ? ' — esta arte não tem botão nem chamada para acção' : ''}.`,
      '',
    );
  }

  /*
    "Melhorar a ideia" — a mesma ideia, com o que o cliente pediu.

    Não é "outra ideia": essa troca de ideia; esta mantém a que o cliente
    gostou e muda só o que ele pediu. Uma direcção basta — as alternativas
    que ele ainda não viu continuam guardadas no browser.
  */
  const refinement = request.refinement?.trim() ?? '';
  if (request.currentIdea && refinement) {
    lines.push('## O cliente pediu para MELHORAR a ideia actual');
    lines.push(`A ideia actual é: "${request.currentIdea}"`);
    lines.push(`O que o cliente quer: «${refinement}»`);
    lines.push(
      'Devolve A MESMA ideia, melhorada com este pedido: a mesma mensagem e o mesmo protagonista, salvo se o pedido os mudar. Muda o que o pedido manda mudar e afina o resto com o mesmo cuidado — cena, composição, design da peça.',
      'Nesta resposta, "concepts" leva UMA só entrada — a ideia melhorada — e "chosen" é 0. Esta instrução substitui a das três direcções.',
    );
    const texts = Object.entries(request.currentTexts ?? {}).filter(([, value]) => value?.trim());
    if (texts.length > 0) {
      lines.push('Os textos actuais da arte:');
      for (const [role, value] of texts) lines.push(`- ${role}: ${value}`);
      lines.push(
        'Devolve-os em "texts" exactamente assim, a não ser que o pedido do cliente fale deles — aí muda só o que ele pediu.',
      );
    }
    lines.push('');
  } else if (request.currentIdea) {
    /*
      Variedade sem mexer na identidade.

      O que varia é o conceito, o enquadramento e o tratamento — nunca as
      cores, a tipografia ou as regras da empresa. Variar a identidade para
      criar variedade seria destruir aquilo que o produto existe para
      proteger.
    */
    lines.push('## O cliente pediu outra ideia');
    lines.push(`A ideia actual é: "${request.currentIdea}"`);
    /*
      Todas as que ele já viu, não só a última. Com uma só, à terceira troca
      o modelo podia voltar à primeira — e "outra ideia" deixava de o ser.
    */
    const seen = (request.seenIdeas ?? []).filter((idea) => idea && idea !== request.currentIdea);
    if (seen.length > 0) {
      lines.push('Já viu e trocou também estas:');
      for (const idea of seen.slice(0, 8)) lines.push(`- ${idea}`);
    }
    lines.push(
      'Propõe direcções genuinamente diferentes de todas estas — outro ângulo, outro protagonista, outra disposição. Uma variação da mesma cena não é outra ideia. Mantém a mensagem, os produtos e as cores da marca.',
      '',
    );
  }

  if (request.recentIdeas.length > 0) {
    lines.push('## Ideias recentes desta mesma marca');
    for (const idea of request.recentIdeas.slice(0, 5)) lines.push(`- ${idea}`);
    lines.push(
      'Evita repetir estas. A marca mantém-se; o conceito e a composição mudam.',
      '',
    );
  }

  lines.push('## Formato da resposta');
  lines.push('Devolve exactamente este objecto JSON:');
  // Na melhoria, o exemplo também só tem uma direcção: com três no exemplo
  // e "uma só" na instrução, o modelo ficava com dois sinais contrários.
  lines.push(request.currentIdea && refinement ? SINGLE_RESPONSE_SHAPE : RESPONSE_SHAPE);

  return lines.join('\n');
}

const RESPONSE_SHAPE = `{
  "brief": {
    "objective": "string", "message": "string", "mandatory": ["string"],
    "mainSubject": "string", "supporting": ["string"], "callToAction": "string",
    "confirmedFacts": ["string"], "audience": "string", "constraints": ["string"]
  },
  "concepts": [
    {
      "idea": "a ideia central, numa frase",
      "approach": "produto-em-contexto|fotografia-simples|tipografica|editorial|cena-conceptual|varios-produtos",
      "scene": "o que se vê: ambiente, superfície, objectos, enquadramento",
      "focus": "o elemento principal",
      "hierarchy": "o que se lê primeiro, segundo e terceiro",
      "composition": "onde assenta o assunto, o texto e o espaço livre",
      "lighting": "direcção e qualidade da luz",
      "materials": "materiais e acabamentos presentes",
      "brandApplication": "como as cores e a tipografia da empresa entram",
      "rationale": "uma frase curta para o cliente ler",
      "graphics": "os 2 ou 3 recursos de design da peça, com as cores pelo papel (cor de base, cor de realce)",
      "techniquesWanted": ["ponto-de-atencao-unico"],
      "textDensity": "baixa|media|alta",
      "elementDensity": "baixa|media|alta",
      "layout": "titulo-topo|titulo-centro|texto-esquerda|texto-direita|titulo-baixo|tipografica",
      "subject": "pessoa|produto|dispositivo|cena|tipografia"
    },
    { "idea": "SEGUNDA ideia, com outra abordagem e outra disposição", "approach": "...", "scene": "...", "focus": "...", "hierarchy": "...", "composition": "...", "lighting": "...", "materials": "...", "brandApplication": "...", "rationale": "...", "graphics": "outro tratamento de design", "techniquesWanted": ["..."], "textDensity": "...", "elementDensity": "...", "layout": "...", "subject": "..." },
    { "idea": "TERCEIRA ideia, diferente das duas anteriores", "approach": "...", "scene": "...", "focus": "...", "hierarchy": "...", "composition": "...", "lighting": "...", "materials": "...", "brandApplication": "...", "rationale": "...", "graphics": "...", "techniquesWanted": ["..."], "textDensity": "...", "elementDensity": "...", "layout": "...", "subject": "..." }
  ],
  "chosen": 0,
  "style": "clean|elegante|vibrante|tecnologico|cinematografico",
  "texts": {
    "headline": "string", "subheadline": "string", "cta": "string",
    "badge": "string", "price": "string"
  },
  "items": ["string"],
  "highlightedItemIndex": 0,
  "mainImageIndex": 0,
  "missingFields": [{ "field": "string", "question": "string" }]
}`;

/** A mesma forma, com uma só direcção — a ideia melhorada. */
const SINGLE_RESPONSE_SHAPE = RESPONSE_SHAPE.replace(
  /\},\n {4}\{ "idea": "SEGUNDA[^\n]*\n {4}\{ "idea": "TERCEIRA[^\n]*\n/,
  '}\n',
).replace('"idea": "a ideia central, numa frase"', '"idea": "a ideia melhorada, numa frase curta"');
