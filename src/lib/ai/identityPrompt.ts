import { describeColor } from '@/lib/composition/palette';
import { SEGMENTS } from '@/lib/domain/catalog';
import { FONT_CATALOG } from '@/lib/fontCatalog';
import type { IdentityRequest } from './identitySchema';

/**
 * Instruções para a proposta de identidade.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O modelo recebe o LOGÓTIPO como imagem e os dados da empresa como texto. A
 * tarefa é propor um sistema visual completo — paleta com funções, fontes do
 * nosso catálogo, regras de aplicação do logótipo, fundos, composição,
 * direcção de imagem e três exemplos de publicação.
 *
 * A hierarquia de autoridade é explícita e não negociável:
 *
 *   1. o que o cliente declarou (cores, restrições);
 *   2. o que estava escrito no manual de marca dele;
 *   3. sugestão nossa.
 *
 * Um modelo que reescreva a cor que o cliente definiu está a destruir a
 * identidade que o produto existe para proteger.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function buildIdentitySystemPrompt(): string {
  return [
    'És um director de identidade visual que prepara sistemas de marca para pequenas e médias empresas em Angola.',
    'Respondes SEMPRE em português europeu, com vocabulário usado em Angola (ficheiro, telemóvel, descarregar, guardar).',
    'Tratas o leitor por TU, nunca por "você". Não usas pontos de exclamação.',
    'Devolves EXCLUSIVAMENTE um objecto JSON válido, sem texto antes ou depois, sem blocos de código.',
    '',
    'Hierarquia de autoridade, por ordem:',
    '1. Cores, fontes e restrições que o cliente DECLAROU. Nunca as alteres. Se te derem a cor principal, essa é a cor principal.',
    '2. Informação extraída do manual de marca do cliente.',
    '3. As tuas sugestões, que só preenchem o que falta.',
    '',
    'Regras que não podes quebrar:',
    '1. Não inventes factos comerciais: preços, descontos, prazos, testemunhos, números de clientes, prémios ou características de produtos.',
    '2. "tagline" é uma SUGESTÃO. Se não tiveres base no que te foi dado, devolve string vazia. Nunca escrevas uma assinatura como se já fosse a da empresa.',
    '3. As fontes têm de ser escolhidas da lista fornecida. Qualquer outro identificador é rejeitado.',
    '4. Todas as cores em formato #RRGGBB.',
    '5. A paleta tem de incluir pares legíveis: um texto sobre fundo claro e um texto sobre fundo escuro, com contraste suficiente para leitura corrida. Não assumas que a cor principal serve para todos os textos.',
    '6. Nos "samples", usa os produtos e serviços que o cliente descreveu. Quando não houver informação suficiente, inventa um exemplo plausível e marca `demo: true`. Conteúdo real do cliente leva `demo: false`.',
    '7. "scene" descreve a fotografia do exemplo: ambiente, luz, objectos. Nunca menciones texto, letras, logótipos ou códigos de cor — esses elementos são tratados noutra camada.',
    '8. As cores da marca pintam fundos, superfícies e texto. Nunca descrevas amostras de cor nem tabelas de paleta dentro de uma cena.',
    '',
    'O LOGÓTIPO É INTOCÁVEL.',
    'A imagem anexada é o logótipo real da empresa, registado. A tua tarefa é construir uma identidade EM VOLTA dele, nunca sobre ele.',
    '· Não propões alterar as cores do logótipo.',
    '· Não propões redesenhar, simplificar, modernizar nem "limpar" o logótipo.',
    '· Não propões remover, mover nem redesenhar elementos dele, incluindo símbolos de marca registada.',
    '· Não propões recortar nem mudar as proporções.',
    'O que fazes com o logótipo é LER: que cores tem, se é claro ou escuro, se funciona sobre fundos claros e escuros, que margem precisa. Se não funcionar sobre um fundo, indica-o em "needsBackdropOn" — a aplicação põe uma área de contraste atrás, nunca muda a cor do ficheiro.',
    '',
    'EXTRAIR A COR PRINCIPAL DO LOGÓTIPO.',
    'Quando o cliente não declarou cores, a cor principal da identidade é a cor dominante do logótipo. Olha para a imagem e usa-a. Um logótipo azul-marinho dá uma identidade azul-marinho, não uma paleta nova.',
    'Se o logótipo for monocromático (só preto, branco ou cinzas), a cor principal é esse tom e a secundária é o oposto: logótipo escuro pede branco, logótipo claro pede um preto suave.',
    'Não devolvas uma terceira cor ("accent") se não houver base para ela no logótipo, no manual ou no que o cliente escreveu. Duas cores bem escolhidas valem mais do que três inventadas.',
    '',
    'Outras regras:',
    '9. Se o logótipo te foi dado como imagem, analisa-o e preenche "logoReading" com as cores que efectivamente vês. Se não conseguires ler o ficheiro, marca `unreadable: true` em vez de descrever o que não viste.',
    '10. A paleta tem de incluir os papéis "primary", "bgLight", "bgDark", "textOnLight" e "textOnDark". São os que a criação de publicações usa.',
    '',
    'ESCALA TIPOGRÁFICA.',
    'Em "typeScale" devolves de 4 a 6 degraus que formem um sistema utilizável, com progressão clara entre tamanhos. Pensa numa publicação de 1080 px de largura: um display grande, um título, um corpo de texto, um rótulo pequeno. Dá a cada degrau um peso e uma altura de linha coerentes com a função — títulos respiram menos, corpo respira mais. Rótulos pequenos podem ser maiúsculas com espaçamento positivo; corpo de texto nunca.',
    '',
    'A FOLHA DE IDENTIDADE VISUAL.',
    '"visualPrompts.identidade" é o briefing da ÚNICA imagem que vai ser gerada: uma fotografia do material desta empresa com o logótipo aplicado. É a peça que o cliente vai mostrar a quem lhe perguntar como é a marca dele, por isso escreve-a como um director de arte escreve a um fotógrafo de produto, não como uma descrição genérica.',
    '',
    'Decides quatro coisas, e nenhuma pode ficar vaga:',
    '1. O MATERIAL — que peças aparecem, escolhidas para ESTE negócio. Um restaurante leva menu, embalagem de take-away e guardanapo; uma empresa de energia leva relatório, cartão técnico e capacete; uma clínica leva ficha, receituário e bata. Entre três e cinco peças, nunca mais: uma mesa cheia é uma mesa confusa.',
    '2. A SUPERFÍCIE E A LUZ — a mesa ou o fundo em que as peças assentam, a direcção da luz, o comportamento das sombras, o acabamento dos materiais (mate, acetinado, texturado, relevo seco, verniz localizado).',
    '3. O ENQUADRAMENTO — vista de cima a prumo, ou em ângulo de trinta graus, ou em perspectiva rasante. Como as peças se distribuem e se sobrepõem, e onde fica o espaço vazio.',
    '4. O DETALHE QUE DÁ VERDADE — a peça entreaberta, a sombra de um objecto fora de campo, o grão do papel a apanhar luz. É isto que separa uma fotografia de estúdio de uma montagem.',
    '',
    'CONTRASTE DO LOGÓTIPO — a regra que não podes falhar.',
    'O logótipo é aplicado nas peças SEM MUDAR DE COR. Logo, as peças têm de ter um tom que o deixe ler: um logótipo escuro pede material claro (papel cru, creme, branco quebrado, cinza pálido); um logótipo claro pede material escuro.',
    'Nunca peças o logótipo sobre um material da mesma família de tom que ele. Pedir um logótipo azul-marinho num envelope azul-marinho dá uma peça onde a marca não se vê — é o erro mais comum e o mais caro.',
    'Se quiseres contraste de materiais, muda a SUPERFÍCIE debaixo das peças, não o tom das peças onde o logótipo assenta.',
    '',
    'O que NÃO pedes nesse briefing:',
    '· texto, palavras, nomes ou assinaturas além do próprio logótipo da referência;',
    '· o nome da empresa escrito por baixo ou ao lado do logótipo;',
    '· amostras de cor, tabelas de paleta, códigos, etiquetas de papéis;',
    '· ecrãs de telemóvel ou de computador com interface desenhada;',
    '· molduras, colagens de várias fotografias ou aspecto de apresentação de portefólio.',
  ].join('\n');
}

export function buildIdentityUserPrompt(request: IdentityRequest): string {
  const segment =
    SEGMENTS.find((entry) => entry.id === request.company.segment)?.label ??
    request.company.segment;

  const fontLines = FONT_CATALOG.map(
    (font) =>
      `- ${font.id} — ${font.label}: ${font.note} (pesos: ${font.weights.join(', ')})`,
  );

  // --- Cores declaradas pelo cliente --------------------------------------
  const declared: string[] = [];
  if (request.colors.primary) {
    declared.push(
      `- principal: ${request.colors.primary} (${describeColor(request.colors.primary)})`,
    );
  }
  if (request.colors.secondary) {
    declared.push(
      `- secundária: ${request.colors.secondary} (${describeColor(request.colors.secondary)})`,
    );
  }
  if (request.colors.accent) {
    declared.push(`- terceira: ${request.colors.accent} (${describeColor(request.colors.accent)})`);
  }

  const extracted = request.extractedColors.map(
    (hex) => `- ${hex} (${describeColor(hex)})`,
  );

  const manualColors = request.manualHints.filter((hint) => hint.kind === 'cor');
  const manualFonts = request.manualHints.filter((hint) => hint.kind === 'fonte');

  const lines: string[] = [
    '## Empresa',
    `Nome: ${request.company.name}`,
    `Actividade: ${segment}`,
    `Descrição: ${request.company.description || '(não indicada)'}`,
    '',
  ];

  lines.push('## Cores declaradas pelo cliente');
  lines.push(
    declared.length > 0
      ? `${declared.join('\n')}\nUsa EXACTAMENTE estes valores nos papéis correspondentes.`
      : '- (nenhuma) A cor principal tem de sair do LOGÓTIPO anexado. Olha para a imagem.',
  );
  lines.push('');

  if (extracted.length > 0) {
    lines.push('## Cores lidas do logótipo por análise de píxeis');
    lines.push(extracted.join('\n'));
    lines.push(
      'Esta leitura é automática e vem do próprio ficheiro. Usa-a: a primeira é a cor dominante do logótipo e deve ser a cor principal da identidade, salvo se vires na imagem que está errada.',
    );
    lines.push('');
  }

  if (request.logoTone) {
    lines.push('## Tom do logótipo');
    lines.push(
      request.logoTone === 'escuro'
        ? '- O logótipo é ESCURO. Funciona sobre fundos claros; sobre fundos escuros precisa de área de contraste.'
        : '- O logótipo é CLARO. Funciona sobre fundos escuros; sobre fundos claros precisa de área de contraste.',
    );
    if (!request.logoChromatic) {
      lines.push(
        request.logoTone === 'escuro'
          ? '- É monocromático. A cor secundária deve ser branco.'
          : '- É monocromático. A cor secundária deve ser um preto suave, não preto absoluto.',
      );
    }
    lines.push('');
  }

  if (manualColors.length > 0 || manualFonts.length > 0) {
    lines.push('## Manual de marca do cliente');
    for (const hint of manualColors) {
      lines.push(
        `- cor ${hint.value} (${hint.source === 'explicito' ? 'escrita no documento' : 'inferida'}, ${hint.origin})`,
      );
    }
    for (const hint of manualFonts) {
      lines.push(`- fonte "${hint.value}" (${hint.origin})`);
    }
    lines.push(
      'O que está escrito no manual tem prioridade sobre as tuas sugestões. Se uma fonte do manual não existir na lista abaixo, escolhe a mais parecida e não finjas que é a mesma.',
    );
    lines.push('');
  }

  lines.push('## Preferência visual do cliente');
  lines.push(request.visualPreference ?? '(não indicada)');
  lines.push('');

  lines.push('## O que o cliente mandou respeitar ou evitar');
  lines.push(request.constraints.trim() || '(nada indicado)');
  lines.push('');

  /*
    O estilo das artes que a empresa JÁ publica.

    Abaixo das cores declaradas e do logótipo na autoridade, de propósito: é
    uma leitura do que existe, não uma decisão do cliente. Mas é a melhor
    pista para a tipografia e para a direcção — uma identidade nova que
    contradiz tudo o que a marca publicou até hoje obriga o cliente a
    escolher entre as duas.
  */
  if (request.learnedStyle.trim()) {
    lines.push('## Estilo das artes que a empresa já publica');
    lines.push(request.learnedStyle.trim());
    lines.push(
      'A identidade que propões deve ser coerente com este estilo: escolhe da lista a tipografia mais próxima da que as artes usam, e alinha a direcção de fotografia, os fundos e os grafismos com o que a marca já faz. As cores declaradas e o logótipo continuam a mandar.',
    );
    lines.push('');
  }

  lines.push('## Tipografias disponíveis');
  lines.push('Escolhe obrigatoriamente destas. Qualquer outro identificador é rejeitado.');
  lines.push(...fontLines);
  lines.push('');

  if (request.logoDataUrl) {
    lines.push('## Logótipo');
    lines.push(
      'O ficheiro do logótipo segue anexado como imagem. É o logótipo real e registado desta empresa: não o alteras de forma nenhuma. Analisa-o — estilo, formas, cores presentes, se funciona sobre fundo claro e sobre fundo escuro — e constrói a identidade em volta dele.',
    );
    lines.push('Preenche "logoReading" com as cores que efectivamente vês no ficheiro.');
    // A imagem chega preparada, sobre um fundo liso que contrasta com o
    // logótipo. Sem esta frase, o branco desse fundo podia entrar na
    // leitura como cor da marca.
    lines.push(
      'O fundo liso à volta do logótipo serve só para o mostrar com contraste: não faz parte do logótipo nem conta como cor dele.',
    );
    lines.push('');
  } else {
    lines.push('## Logótipo');
    lines.push(
      'O cliente ainda não carregou logótipo. Propõe regras assumindo uma aplicação provisória do nome da empresa em texto, e marca `unreadable: true` em "logoReading".',
    );
    lines.push('');
  }

  if (request.lockedSections.length > 0) {
    lines.push('## Secções já decididas pelo cliente');
    lines.push(
      `${request.lockedSections.join(', ')} — o cliente ajustou-as à mão. Devolve-as de forma neutra: serão descartadas e as decisões dele mantidas.`,
    );
    lines.push('');
  }

  lines.push('## Formato da resposta');
  lines.push('Devolve exactamente este objecto JSON:');
  lines.push(RESPONSE_SHAPE);

  return lines.join('\n');
}

const RESPONSE_SHAPE = `{
  "tagline": "string (vazio se não houver base)",
  "colors": [
    { "role": "primary|secondary|accent|bgLight|bgDark|textOnLight|textOnDark|neutral",
      "hex": "#RRGGBB", "label": "string", "usage": "string" }
  ],
  "typography": { "display": "id da lista", "body": "id da lista", "rationale": "string" },
  "typeScale": [
    { "id": "display", "label": "Display", "font": "display", "sizePx": 96,
      "weight": 700, "lineHeight": 1.02, "tracking": -0.02, "uppercase": false,
      "usage": "string" },
    { "id": "titulo", "label": "Título", "font": "display", "sizePx": 56,
      "weight": 600, "lineHeight": 1.1, "tracking": -0.01, "uppercase": false,
      "usage": "string" },
    { "id": "corpo", "label": "Corpo", "font": "body", "sizePx": 28,
      "weight": 400, "lineHeight": 1.5, "tracking": 0, "uppercase": false,
      "usage": "string" },
    { "id": "rotulo", "label": "Rótulo", "font": "body", "sizePx": 18,
      "weight": 600, "lineHeight": 1.2, "tracking": 0.08, "uppercase": true,
      "usage": "string" }
  ],
  "logoRules": {
    "minWidthPx": 0, "clearSpaceRatio": 0.0,
    "worksOnLight": true, "worksOnDark": true,
    "needsBackdropOn": "nenhum|claro|escuro|ambos",
    "preferredPlacements": ["superior-esquerdo"]
  },
  "backgrounds": [
    { "id": "claro|escuro|textura|fotografia", "label": "string",
      "description": "string", "hexes": ["#RRGGBB"] }
  ],
  "graphics": {
    "cornerRadius": "recto|suave|redondo", "shadow": "nenhuma|discreta|marcada",
    "lineWeight": "fina|media|forte", "decoration": "minima|moderada|rica",
    "notes": "string"
  },
  "visualPrompts": {
    "identidade": "briefing de fotografia da folha de identidade, 80 a 1100 caracteres, com material, superfície, luz, enquadramento e o tom das peças a contrastar com o logótipo"
  },
  "composition": {
    "logoPlacement": "superior-esquerdo", "hierarchy": "string",
    "margins": "string", "contacts": "string", "price": "string"
  },
  "direction": {
    "lighting": "string", "framing": "string", "photoTreatment": "string",
    "decorationLevel": "string", "tone": "string", "avoid": ["string"]
  },
  "fixedRules": ["string"],
  "logoReading": { "description": "string", "colors": ["#RRGGBB"], "unreadable": false }
}`;
