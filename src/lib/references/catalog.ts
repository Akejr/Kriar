import type {
  ReferenceStatus,
  ReferenceUsage,
  VisualReference,
} from '@/lib/domain/references';

/**
 * O catálogo de referências visuais: as nove sementes (`ref1`–`ref9`) e o
 * lote cadastrado pelo administrador da conta (`ref10`–`ref30`).
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Todas entram já `aprovada`, e pela mesma razão: a descrição de cada uma
 * foi escrita por um humano que olhou para a imagem, não produzida por
 * análise automática. As sementes entram por `seed`; o lote, por `curated`.
 * O estado `pendente` existe para o que a IA analisar a partir de agora.
 *
 * Os números do lote têm falhas — não há `ref17` nem `ref29` — e ficam
 * assim. O identificador é estável e não representa ordem nem qualidade.
 *
 * AVISO QUE PERTENCE A ESTE FICHEIRO.
 *
 * As nove sementes estão concentradas em tecnologia e entretenimento, e
 * todas trazem a marca DOT mais logótipos de serviços de streaming. O lote
 * alarga os sectores — desporto, alimentação, electrónica, serviços
 * digitais, bem-estar, finanças —, mas traz outra concentração: verde, roxo,
 * objectos 3D e luz intensa aparecem nele com uma frequência que NÃO pode
 * virar padrão da Kriar. A paleta de cada arte segue a marca do cliente,
 * nunca a das referências.
 *
 * Nenhuma destas equivalências é verdadeira, por mais que as imagens as
 * sugiram:
 *
 *   · tecnológico ≠ néon;
 *   · elegante ≠ pedras preciosas;
 *   · cinematográfico ≠ fundo escuro;
 *   · clean ≠ fundo branco;
 *   · profissional ≠ render 3D;
 *   · crescimento ≠ dinheiro ou foguetões;
 *   · planeamento ≠ calendário;
 *   · estratégia ≠ bússola.
 *
 * O que as referências demonstram é cuidado de luz, hierarquia e acabamento
 * — e é só isso que a biblioteca empresta. O sector de onde uma imagem vem
 * (`sectors`) é informação para quem revê, nunca um filtro.
 *
 * A biblioteca aceita referências de outros sectores sem qualquer alteração
 * de arquitectura: basta acrescentar entradas.
 * ──────────────────────────────────────────────────────────────────────────
 */

const SEED_AT = '2026-01-01T00:00:00.000Z';

function seed(partial: Omit<VisualReference, 'version' | 'status' | 'analysis'>): VisualReference {
  return {
    ...partial,
    version: 1,
    status: 'aprovada',
    analysis: {
      source: 'semente',
      model: null,
      at: SEED_AT,
      editedByAdmin: true,
    },
  };
}

/** Data em que o administrador entregou o lote e ele foi conferido. */
const CURATED_AT = '2026-10-15T00:00:00.000Z';

/**
 * Entrada cuja descrição foi escrita pelo administrador da conta.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Entra em uso pela mesma regra das sementes: a descrição foi escrita por
 * um humano que olhou para a imagem — o administrador, que é o cliente — e
 * foi conferida contra a própria imagem ao ser cadastrada aqui. Não é uma
 * análise automática à espera de quem a confirme.
 *
 * O modelo de metadados do cliente trazia `review_status: "pending"`. Fica
 * traduzido assim: escrita pelo administrador, confirmada contra a imagem e
 * revisível mais tarde mudando o `status`, numa linha — aqui, para o lote
 * inteiro, ou com `status: 'pendente'` (ou `'inactiva'`) na própria
 * entrada, para uma só.
 * ──────────────────────────────────────────────────────────────────────────
 */
function curated(
  partial: Omit<VisualReference, 'version' | 'status' | 'analysis'> & {
    status?: ReferenceStatus;
  },
): VisualReference {
  return {
    ...partial,
    version: 1,
    status: partial.status ?? 'aprovada',
    analysis: {
      source: 'administrador',
      model: null,
      at: CURATED_AT,
      editedByAdmin: true,
    },
  };
}

export const VISUAL_REFERENCES: VisualReference[] = [
  seed({
    id: 'ref1',
    name: 'Pessoa com painel de serviços',
    file: 'src/referencias/ref1.png',
    payloadFile: 'src/referencias/ref1.ref.webp',
    content:
      'Mulher num ambiente corporativo, a interagir com um painel vertical transparente que apresenta serviços digitais.',
    styles: ['tecnologico'],
    traits: ['corporativo', 'fotografico'],
    techniques: [
      'integracao-pessoa-elemento',
      'presenca-humana',
      'materiais-transparentes',
      'profundidade-por-sobreposicao',
      'iluminacao-controlada',
    ],
    textDensity: 'media',
    elementDensity: 'media',
    layouts: ['titulo-topo'],
    subjects: ['pessoa', 'dispositivo'],
    hierarchy: 'Título separado da cena, com a pessoa a conduzir o olhar para o painel.',
    contrast: 'Médio, com o painel iluminado a destacar-se do ambiente mais escuro.',
    lighting: 'Luz cuidada, com o painel a servir de fonte secundária sobre o rosto e as mãos.',
    depth: 'Profundidade real: pessoa em primeiro plano, painel ao meio, escritório desfocado atrás.',
    typography: 'Título limpo, fora da zona da cena, sem competir com o painel.',
    whitespace: 'Zona de texto claramente separada do elemento visual.',
    textImageIntegration:
      'Texto e cena ocupam territórios distintos e não se sobrepõem.',
    strengths: [
      'integração entre uma pessoa e um elemento visual',
      'relação entre o gesto e o ponto de atenção',
      'profundidade',
      'materiais transparentes',
      'iluminação cuidada',
      'separação entre título e cena',
    ],
    limitations: [
      'Uma lista extensa de serviços no painel compromete a leitura.',
      'O painel é um recurso específico, não uma solução universal.',
    ],
    helpfulWhen: [
      'o pedido relaciona uma pessoa com uma solução ou um benefício',
      'é preciso mostrar um serviço imaterial de forma concreta',
      'o registo pedido é corporativo',
    ],
    doNotTransfer: [
      'a mulher',
      'o escritório',
      'o painel transparente',
      'os serviços apresentados no painel',
      'os logótipos visíveis',
      'a cor azul',
    ],
    directUse: 'com-cuidado',
  }),

  seed({
    id: 'ref2',
    name: 'Escolha sobre um tabuleiro',
    file: 'src/referencias/ref2.png',
    payloadFile: 'src/referencias/ref2.ref.webp',
    content:
      'Mão a colocar uma peça num tabuleiro de jogo do galo, com outras peças a representar opções disponíveis.',
    styles: ['clean', 'elegante'],
    traits: ['conceptual', 'tridimensional'],
    techniques: [
      'metafora-visual',
      'ponto-de-atencao-unico',
      'espaco-livre-para-texto',
      'profundidade-por-sobreposicao',
      'iluminacao-controlada',
    ],
    textDensity: 'baixa',
    elementDensity: 'media',
    layouts: ['titulo-topo'],
    subjects: ['cena'],
    hierarchy: 'Peça em destaque claramente acima das complementares, título no canto livre.',
    contrast: 'Suave, sobre superfície clara, com as peças a ganhar presença pela sombra.',
    lighting: 'Luz direccional de cima, sombras curtas e coerentes entre todas as peças.',
    depth: 'Superfície em ligeiro ângulo, com perspectiva consistente e desfoque no fundo.',
    typography: 'Título grande em duas linhas, com uma palavra destacada por cor.',
    whitespace: 'Terço superior calmo, reservado ao texto.',
    textImageIntegration:
      'O texto assenta numa zona lisa da superfície, sem véu nem caixa por trás.',
    strengths: [
      'ligação entre a mensagem e uma metáfora',
      'um ponto de atenção reconhecível',
      'espaço livre para texto',
      'materiais e sombras coerentes',
      'hierarquia entre o elemento principal e os complementares',
    ],
    limitations: [
      'A metáfora de jogo é inadequada para pedidos sérios, institucionais ou sensíveis.',
      'A cena tem muitas marcas de terceiros aplicadas nas peças.',
    ],
    helpfulWhen: [
      'o pedido apresenta alternativas e quer destacar uma',
      'é preciso clareza conceptual com poucos elementos',
      'há texto curto e precisa de espaço calmo',
    ],
    doNotTransfer: [
      'o tabuleiro',
      'o jogo do galo',
      'a mão',
      'as formas geométricas das peças',
      'a quantidade de peças',
      'as marcas de serviços de streaming',
      'as posições dos elementos',
    ],
    /*
      A razão de `nunca`.

      Esta imagem foi a única referência activa durante semanas, enviada como
      "segue esta estrutura de perto". O resultado era previsível em
      retrospectiva: o gerador devolvia tabuleiros, mãos e peças
      triangulares, com as marcas de streaming incluídas. O valor dela —
      espaço livre, hierarquia, coerência de luz — transmite-se por palavras
      sem arrastar nada disso.
    */
    directUse: 'nunca',
    legacy: {
      templateId: 'modelo-02-proxima-jogada',
      note:
        'Serviu de base ao antigo modelo 02. As coordenadas desse modelo continuam guardadas como descrição e não são impostas a criações novas.',
    },
  }),

  seed({
    id: 'ref3',
    name: 'Telemóvel com catálogo',
    file: 'src/referencias/ref3.png',
    payloadFile: 'src/referencias/ref3.ref.webp',
    content:
      'Telemóvel a mostrar uma loja digital, com cartões de produtos distribuídos ao lado do aparelho.',
    styles: ['clean', 'tecnologico'],
    traits: ['comercial'],
    techniques: [
      'organizacao-modular',
      'profundidade-por-sobreposicao',
      'hierarquia-tipografica-forte',
      'produto-em-contexto',
    ],
    textDensity: 'media',
    elementDensity: 'alta',
    layouts: ['titulo-centro'],
    subjects: ['dispositivo', 'produto'],
    hierarchy: 'Título, depois o produto, depois a chamada para acção.',
    contrast: 'Cartões claros sobre fundo escuro, com separação nítida entre eles.',
    lighting: 'Luz de estúdio uniforme, com sombras suaves por baixo de cada cartão.',
    depth: 'Sobreposição ligeira entre cartões e aparelho a criar camadas.',
    typography: 'Título forte no topo, rótulos pequenos nos cartões.',
    whitespace: 'Espaço regular entre cartões, que é o que os mantém legíveis.',
    textImageIntegration: 'Cada cartão carrega o seu próprio rótulo, sem texto solto.',
    strengths: [
      'organização de vários elementos',
      'hierarquia entre título, produto e chamada para acção',
      'profundidade por sobreposição',
      'separação clara entre produtos',
      'comunicação de variedade',
    ],
    limitations: [
      'Muitos cartões e texto dentro do ecrã ficam pequenos e ilegíveis.',
      'O aparelho ocupa espaço que podia ser do produto.',
    ],
    helpfulWhen: [
      'o pedido tem vários produtos ou pacotes a apresentar',
      'é preciso comunicar variedade sem parecer desarrumado',
    ],
    doNotTransfer: [
      'o telemóvel',
      'os cartões',
      'as interfaces desenhadas',
      'as marcas visíveis',
      'os preços',
      'a quantidade de produtos',
      'as cores',
    ],
    directUse: 'com-cuidado',
  }),

  seed({
    id: 'ref4',
    name: 'Comemoração do Dia da Mulher',
    file: 'src/referencias/ref4.png',
    payloadFile: 'src/referencias/ref4.ref.webp',
    content:
      'Três retratos femininos com mensagem comemorativa e elementos luminosos dourados e magenta.',
    styles: ['vibrante', 'cinematografico'],
    traits: ['humano', 'expressivo'],
    techniques: [
      'presenca-humana',
      'iluminacao-dramatica',
      'contraste-alto',
      'hierarquia-tipografica-forte',
    ],
    textDensity: 'media',
    elementDensity: 'alta',
    layouts: ['texto-esquerda'],
    subjects: ['pessoa'],
    hierarchy: 'Um retrato dominante e dois de apoio, mensagem sobre a zona mais calma.',
    contrast: 'Alto, com luz quente a separar as figuras do fundo escuro.',
    lighting: 'Luz dramática de contorno, com rastos luminosos a reforçar o movimento.',
    depth: 'Figuras em planos diferentes, com desfoque a aumentar com a distância.',
    typography: 'Contraste forte de pesos, com uma palavra manuscrita a dar o tom emocional.',
    whitespace: 'Pouco, compensado pelo escurecimento das zonas de texto.',
    textImageIntegration: 'A mensagem assenta sobre a área escura entre as figuras.',
    strengths: [
      'expressão e presença humana',
      'relação entre emoção e mensagem',
      'hierarquia entre retratos',
      'contraste de pesos tipográficos',
      'ritmo visual',
    ],
    limitations: [
      'Os rastos de luz e a tipografia manuscrita tornam o resultado excessivo com facilidade.',
      'A densidade reduz a leitura em ecrãs pequenos.',
    ],
    helpfulWhen: [
      'o pedido é uma comunicação humana ou celebrativa',
      'as pessoas são o assunto e não o cenário',
    ],
    doNotTransfer: [
      'as pessoas retratadas',
      'a data comemorativa',
      'a mensagem',
      'o vestuário',
      'os efeitos luminosos',
      'as cores dourada e magenta',
      'a composição dos três retratos',
    ],
    directUse: 'com-cuidado',
  }),

  seed({
    id: 'ref5',
    name: 'Curso destacado por uma lupa',
    file: 'src/referencias/ref5.png',
    payloadFile: 'src/referencias/ref5.ref.webp',
    content:
      'Apresentação de um curso com uma lupa colocada sobre parte da informação, a ampliá-la.',
    styles: ['clean', 'tecnologico'],
    traits: ['informativo', 'conceptual'],
    techniques: ['recurso-de-destaque', 'metafora-visual', 'ponto-de-atencao-unico'],
    textDensity: 'alta',
    elementDensity: 'media',
    layouts: ['titulo-centro'],
    subjects: ['cena'],
    hierarchy: 'Benefício no título, detalhe ampliado pela lupa, condições em baixo.',
    contrast: 'Médio, com a lente a aumentar o contraste local da zona ampliada.',
    lighting: 'Luz frontal uniforme, com reflexo controlado no vidro da lupa.',
    depth: 'Pouca: a lupa e a sua sombra são o que cria relevo.',
    typography: 'Título grande e bloco inferior com informação em corpo pequeno.',
    whitespace: 'Escasso na metade inferior.',
    textImageIntegration:
      'A lupa atravessa o conteúdo, o que amplia uma parte e obstrui outra.',
    strengths: [
      'uso de um recurso visual para destacar um detalhe',
      'benefício comunicado no título',
      'relação entre a mensagem e o elemento de foco',
    ],
    limitations: [
      'A lupa atravessa e obstrui texto — não reproduzir essa obstrução.',
      'A metade inferior é densa e não serve de exemplo de legibilidade.',
      'A imagem inteira não deve servir de padrão de composição.',
    ],
    helpfulWhen: [
      'há um detalhe concreto que merece destaque dentro de um conjunto',
      'o pedido é informativo e precisa de um ponto de entrada visual',
    ],
    doNotTransfer: [
      'a lupa',
      'o curso',
      'a interface',
      'o preço',
      'a classificação por estrelas',
      'o número de participantes',
      'os logótipos',
    ],
    directUse: 'nunca',
  }),

  seed({
    id: 'ref6',
    name: 'Parceria representada por puzzle',
    file: 'src/referencias/ref6.png',
    payloadFile: 'src/referencias/ref6.ref.webp',
    content:
      'Duas mãos aproximam peças de puzzle com as bandeiras de Angola e de Espanha, a identificar uma parceria.',
    styles: ['elegante', 'cinematografico'],
    traits: ['institucional', 'conceptual'],
    techniques: [
      'metafora-visual',
      'equilibrio-entre-entidades',
      'ponto-de-atencao-unico',
      'espaco-livre-para-texto',
      'iluminacao-dramatica',
    ],
    textDensity: 'baixa',
    elementDensity: 'baixa',
    layouts: ['titulo-centro'],
    subjects: ['cena'],
    hierarchy: 'Uma ideia central ao centro, texto curto afastado dela.',
    contrast: 'Médio-alto, com o ponto de encontro das peças mais iluminado.',
    lighting: 'Luz a convergir no ponto de ligação, reforçando o significado.',
    depth: 'Fundo escuro e desfocado, com as mãos nítidas em primeiro plano.',
    typography: 'Pouco texto, bem espaçado, sem competir com a cena.',
    whitespace: 'Generoso, o que é o que torna a ideia legível de imediato.',
    textImageIntegration: 'Texto numa zona escura e lisa, claramente fora da acção.',
    strengths: [
      'uma ideia central fácil de reconhecer',
      'poucos elementos principais',
      'equilíbrio entre dois participantes',
      'luz a reforçar o ponto de ligação',
      'espaço livre',
    ],
    limitations: [
      'O puzzle é uma metáfora gasta e não deve tornar-se a resposta automática para parcerias.',
    ],
    helpfulWhen: [
      'o pedido envolve duas entidades em equilíbrio',
      'é preciso sintetizar uma ideia abstracta num só elemento',
    ],
    doNotTransfer: [
      'as mãos',
      'as peças de puzzle',
      'as bandeiras',
      'o mapa',
      'os países',
      'as marcas',
      'qualquer afirmação de parceria',
    ],
    directUse: 'com-cuidado',
  }),

  seed({
    id: 'ref7',
    name: 'Jogos apresentados numa bandeja',
    file: 'src/referencias/ref7.png',
    payloadFile: 'src/referencias/ref7.ref.webp',
    content:
      'Mãos com luvas apresentam jogos numa bandeja de serviço e levantam a tampa que os cobria.',
    styles: ['tecnologico', 'cinematografico'],
    traits: ['conceptual'],
    techniques: [
      'metafora-visual',
      'movimento-implicito',
      'iluminacao-dramatica',
      'profundidade-por-sobreposicao',
      'escala-tipografica-dominante',
    ],
    textDensity: 'baixa',
    elementDensity: 'alta',
    layouts: ['titulo-topo'],
    subjects: ['produto', 'cena'],
    hierarchy: 'Título muito dominante sobre uma cena detalhada.',
    contrast: 'Alto, com luz azul a recortar os objectos do fundo escuro.',
    lighting: 'Iluminação coerente entre bandeja, tampa e luvas, com sombras bem resolvidas.',
    depth: 'Tampa em movimento à frente, conteúdo da bandeja atrás.',
    typography: 'Escala tipográfica forte, que chega a competir com a cena.',
    whitespace: 'Pouco: a cena ocupa quase todo o enquadramento.',
    textImageIntegration: 'O título assenta por cima da cena, apoiado pelo escurecimento do fundo.',
    strengths: [
      'conceito visual ligado à mensagem',
      'integração entre objectos',
      'materiais realistas',
      'sombras e iluminação coerentes',
      'movimento implícito',
      'escala tipográfica forte',
    ],
    limitations: [
      'Cena complexa e título muito dominante: a densidade tem de ser ajustada ao pedido.',
    ],
    helpfulWhen: [
      'o pedido pede uma ideia publicitária encenada',
      'é preciso sugerir revelação ou novidade',
    ],
    doNotTransfer: [
      'a bandeja',
      'a tampa',
      'as luvas',
      'os cartões',
      'os jogos',
      'as marcas',
      'as luzes azuis',
      'as posições',
    ],
    directUse: 'com-cuidado',
  }),

  seed({
    id: 'ref8',
    name: 'Conteúdos agrupados em três painéis',
    file: 'src/referencias/ref8.png',
    payloadFile: 'src/referencias/ref8.ref.webp',
    content:
      'Três faixas horizontais com imagens de entretenimento, separadas por plataforma.',
    styles: ['cinematografico', 'tecnologico'],
    traits: ['editorial'],
    techniques: ['agrupamento-por-categoria', 'organizacao-modular', 'contraste-alto'],
    textDensity: 'media',
    elementDensity: 'alta',
    layouts: ['titulo-baixo'],
    subjects: ['produto'],
    hierarchy: 'Três grupos equivalentes, cada um com o seu rótulo.',
    contrast: 'Alto, com contornos luminosos a delimitar cada faixa.',
    lighting: 'Luz própria de cada painel, com o fundo escuro a unificar o conjunto.',
    depth: 'Planos achatados: a profundidade vem da sobreposição das imagens em cada faixa.',
    typography: 'Rótulos curtos e consistentes entre módulos.',
    whitespace: 'Mínimo, usado apenas para separar os grupos.',
    textImageIntegration: 'Cada rótulo pertence ao seu módulo e não flutua sobre as imagens.',
    strengths: [
      'agrupamento por categorias',
      'separação clara entre conjuntos',
      'consistência entre módulos',
      'contraste',
      'apresentação de abundância',
    ],
    limitations: [
      'Densidade visual alta: não serve de orientação para uma arte clean nem para uma mensagem simples.',
    ],
    helpfulWhen: [
      'o pedido tem vários grupos de conteúdo a mostrar lado a lado',
      'a mensagem é de abundância ou variedade',
    ],
    doNotTransfer: [
      'as personagens',
      'os actores',
      'as plataformas',
      'os logótipos',
      'a estrutura de três faixas',
      'os contornos azuis',
    ],
    directUse: 'nunca',
  }),

  seed({
    id: 'ref9',
    name: 'Serviço apresentado em vários dispositivos',
    file: 'src/referencias/ref9.png',
    payloadFile: 'src/referencias/ref9.ref.webp',
    content:
      'Título dominante sobre um conjunto de dispositivos a mostrar o mesmo serviço, com contraste preto, branco e vermelho.',
    styles: ['tecnologico'],
    traits: ['tipografico', 'alto-impacto'],
    techniques: [
      'escala-tipografica-dominante',
      'contraste-alto',
      'hierarquia-tipografica-forte',
      'produto-em-contexto',
    ],
    textDensity: 'baixa',
    elementDensity: 'media',
    layouts: ['titulo-centro', 'tipografica'],
    subjects: ['dispositivo', 'tipografia'],
    hierarchy: 'Mensagem principal imediatamente visível, produtos agrupados em baixo.',
    contrast: 'Muito alto: branco e vermelho sobre preto.',
    lighting: 'Luz de recorte vermelha por trás dos aparelhos, a separá-los do fundo.',
    depth: 'Aparelhos escalonados em profundidade, do maior ao menor.',
    typography: 'Escala dominante, com uma palavra-chave destacada por cor.',
    whitespace: 'Concentrado em volta do título, o que é o que lhe dá força.',
    textImageIntegration: 'Texto em cima, cena em baixo, territórios separados.',
    strengths: [
      'mensagem principal imediatamente visível',
      'contraste forte',
      'palavra-chave destacada',
      'hierarquia simples',
      'agrupamento coerente de produtos',
    ],
    limitations: [
      'Os textos internos dos ecrãs ficam ilegíveis.',
      'O tamanho do título tem de se adaptar ao conteúdo, não ser sempre máximo.',
    ],
    helpfulWhen: [
      'a mensagem tem de ser lida em menos de um segundo',
      'o pedido pede impacto e uma palavra-chave forte',
    ],
    doNotTransfer: [
      'a Netflix',
      'os dispositivos',
      'as interfaces',
      'a cor vermelha',
      'os textos',
      'o nome pessoal visível',
      'a localização mencionada',
    ],
    directUse: 'com-cuidado',
  }),

  // ── Lote do administrador ─────────────────────────────────────────────
  // Descrições do cliente, conferidas contra cada imagem. Ver `curated`.

  curated({
    id: 'ref10',
    name: 'Composição desportiva com tipografia de impacto',
    file: 'src/referencias/ref10.jpg',
    payloadFile: 'src/referencias/ref10.ref.webp',
    content:
      'Fundo verde com um título muito grande a preto e branco, atletas recortados sobrepostos ao texto e equipamentos desportivos cortados nas margens.',
    styles: ['vibrante'],
    traits: ['tipografico', 'fotografico', 'alto-impacto'],
    techniques: [
      'escala-tipografica-dominante',
      'profundidade-por-sobreposicao',
      'movimento-implicito',
      'integracao-pessoa-elemento',
      'presenca-humana',
    ],
    textDensity: 'baixa',
    elementDensity: 'alta',
    layouts: ['tipografica', 'titulo-topo'],
    subjects: ['pessoa', 'tipografia'],
    hierarchy: 'Título gigante primeiro, atletas entrelaçados com ele e frase de apoio pequena à direita.',
    contrast: 'Alto: branco e preto sobre verde saturado, com os recortes bem destacados do fundo.',
    lighting: 'Luz fotográfica uniforme nos recortes, sem efeitos, sobre um fundo plano com grão.',
    depth: 'Camadas alternadas: atleta entre as linhas do título, ciclista à frente, equipamentos cortados nas margens.',
    typography: 'Letra sem serifa muito pesada, em caixa alta, com linhas alternadas a branco e a preto e entrelinha apertada.',
    whitespace: 'Pouco: título, atletas e equipamentos ocupam quase todo o enquadramento.',
    textImageIntegration:
      'A atleta passa à frente de parte do título e o ciclista sobrepõe-se à última linha, sem impedir a leitura.',
    strengths: [
      'escala tipográfica a comunicar energia',
      'elementos distribuídos em planos diferentes',
      'recortes que dão movimento à composição',
      'integração das pessoas com o título',
      'alternância de cor entre as linhas do título',
    ],
    limitations: [
      'Muitos elementos e sobreposições: num pedido simples, o resultado fica carregado.',
      'O título entrecortado pelas figuras só se lê porque as palavras são curtas e muito grandes.',
    ],
    helpfulWhen: [
      'o pedido divulga um evento ou chama à participação',
      'o pedido é um lançamento que precisa de energia',
      'a comunicação pede movimento, mesmo fora do desporto',
    ],
    doNotTransfer: [
      'os atletas',
      'a bicicleta',
      'as bolas',
      'a raquete',
      'a marca Firula',
      'a cor verde',
      'a composição exacta',
      'as faixas curvas da base',
      'o slogan «Se tem esporte, tem Firula!»',
      'a frase «Organize seu evento esportivo com Firula»',
    ],
    cautions: [
      'não deixar que as sobreposições escondam partes essenciais do texto',
      'ajustar a quantidade de elementos à complexidade do pedido',
    ],
    sectors: ['desporto', 'eventos'],
    directUse: 'com-cuidado',
  }),

  curated({
    id: 'ref11',
    name: 'Pessoa em destaque com benefícios ao redor',
    file: 'src/referencias/ref11.jpg',
    payloadFile: 'src/referencias/ref11.ref.webp',
    content:
      'Fundo claro com título no topo, uma mulher a usar o telemóvel dentro de uma área arredondada, pequenas etiquetas verdes com funcionalidades à volta e uma frase de encerramento na base.',
    styles: ['clean'],
    traits: ['humano', 'fotografico', 'informativo'],
    techniques: [
      'presenca-humana',
      'integracao-pessoa-elemento',
      'hierarquia-tipografica-forte',
      'espaco-livre-para-texto',
    ],
    textDensity: 'media',
    elementDensity: 'media',
    layouts: ['titulo-centro'],
    subjects: ['pessoa'],
    hierarchy: 'Título centrado primeiro, depois a pessoa, depois as etiquetas e, por fim, a frase de encerramento.',
    contrast: 'Médio: verde e preto sobre fundo claro, com a cor concentrada na área da fotografia.',
    lighting: 'Luz natural suave no rosto, com o fundo da fotografia desfocado.',
    depth: 'Pouca: as etiquetas assentam sobre as arestas da fotografia e criam uma camada leve.',
    typography: 'Letra sem serifa arredondada, título em dois tons e etiquetas em corpo pequeno com ícones.',
    whitespace: 'Generoso à volta do título e entre os grupos de informação.',
    textImageIntegration:
      'As etiquetas pousam nas arestas da área arredondada, sem tapar o rosto nem as mãos.',
    strengths: [
      'separação clara entre promessa, imagem e benefícios',
      'etiquetas curtas que facilitam a leitura',
      'fotografia que explica a experiência do serviço',
      'espaçamento entre os grupos de informação',
      'fotografia contida numa área de forma arredondada',
    ],
    limitations: [
      'Com etiquetas a mais, a arte passa a parecer uma lista de funcionalidades.',
      'A fotografia é genérica: ilustra a experiência, não prova resultados.',
    ],
    helpfulWhen: [
      'o pedido apresenta uma plataforma ou um serviço',
      'é preciso explicar poucas funcionalidades de forma rápida',
      'o pedido é de formação ou de atendimento',
    ],
    doNotTransfer: [
      'a mulher',
      'o telemóvel',
      'as etiquetas verdes',
      'os quatro benefícios',
      'as funcionalidades da Firula',
      'a marca Firula',
      'os ícones das etiquetas',
      'o título «Organize seu evento esportivo com o Firula»',
      'a frase «Tudo o que você precisa, em um só lugar»',
    ],
    cautions: [
      'usar apenas benefícios reais fornecidos ou aprovados pelo cliente',
      'evitar etiquetas em excesso',
    ],
    sectors: ['desporto', 'serviços digitais'],
    directUse: 'com-cuidado',
  }),

  curated({
    id: 'ref12',
    name: 'Apresentação de produto digital em perspectiva',
    file: 'src/referencias/ref12.jpg',
    payloadFile: 'src/referencias/ref12.ref.webp',
    content:
      'Dois telemóveis sobrepostos e inclinados em perspectiva, com interfaces escuras de reserva de campos, sobre fundo verde, uma palavra enorme atrás dos aparelhos e uma mensagem curta em baixo.',
    styles: ['tecnologico', 'vibrante'],
    traits: ['comercial', 'tridimensional', 'tipografico'],
    techniques: [
      'produto-em-contexto',
      'profundidade-por-sobreposicao',
      'ponto-de-atencao-unico',
      'espaco-livre-para-texto',
    ],
    textDensity: 'baixa',
    elementDensity: 'media',
    layouts: ['titulo-baixo'],
    subjects: ['dispositivo'],
    hierarchy: 'Os aparelhos primeiro, a palavra de fundo como textura e a mensagem curta a fechar em baixo.',
    contrast: 'Médio-alto: aparelhos escuros e palavra branca sobre verde saturado.',
    lighting: 'Luz de estúdio suave nos aparelhos, com sombra projectada a separá-los do fundo.',
    depth: 'Três planos: palavra de fundo, telemóvel de trás e telemóvel da frente, inclinados em perspectiva.',
    typography: 'Letra sem serifa; a mensagem junta uma linha em negrito e outra em peso regular.',
    whitespace: 'Topo e faixa inferior livres, o que dá ar ao logótipo e à mensagem.',
    textImageIntegration:
      'A palavra de fundo passa por trás dos aparelhos; a mensagem fica num território próprio, abaixo deles.',
    strengths: [
      'dispositivos como suporte para apresentar um produto digital',
      'profundidade por perspectiva, sobreposição e sombra',
      'mensagem curta a complementar o produto',
      'texto de fundo como elemento secundário da composição',
    ],
    limitations: [
      'As interfaces dentro dos ecrãs ficam pequenas e ilegíveis num formato de rede social.',
      'Sem capturas de ecrã reais, o gerador tende a inventar interfaces.',
    ],
    helpfulWhen: [
      'o pedido apresenta uma aplicação ou um website',
      'o pedido divulga um sistema de reservas ou um serviço digital',
      'o cliente fornece capturas de ecrã do seu produto',
    ],
    doNotTransfer: [
      'os dois telemóveis',
      'a interface da Firula',
      'a cor verde',
      'a marca ampliada no fundo',
      'a marca Firula',
      'os preços em reais das interfaces',
      'as datas e os horários das interfaces',
      'os nomes de locais e as moradas das interfaces',
      'a frase «Sua quadra cheia. Sua agenda no controle.»',
    ],
    cautions: [
      'quando o cliente fornecer capturas de ecrã, preservá-las tal como são',
      'não inventar funcionalidades, preços ou interfaces nem apresentá-los como reais',
    ],
    sectors: ['desporto', 'serviços digitais'],
    directUse: 'com-cuidado',
  }),

  curated({
    id: 'ref13',
    name: 'Produto alimentar com apelo sensorial e oferta',
    file: 'src/referencias/ref13.jpg',
    payloadFile: 'src/referencias/ref13.ref.webp',
    content:
      'Embalagem inclinada ao centro, com chocolate em movimento e pedaços em planos diferentes, sobre fundo vermelho; título no topo, etiquetas de atributos dos lados e uma oferta na base.',
    styles: ['vibrante', 'cinematografico'],
    traits: ['comercial', 'expressivo', 'alto-impacto'],
    techniques: [
      'produto-em-contexto',
      'movimento-implicito',
      'profundidade-por-sobreposicao',
      'iluminacao-dramatica',
      'hierarquia-tipografica-forte',
    ],
    textDensity: 'media',
    elementDensity: 'alta',
    layouts: ['titulo-centro'],
    subjects: ['produto'],
    hierarchy: 'Título em cima, embalagem ao centro, atributos dos lados e oferta a fechar em baixo.',
    contrast: 'Alto: texto creme e embalagem iluminada sobre vermelho escuro, com vinheta.',
    lighting: 'Luz de recorte na embalagem e brilhos no chocolate, com os cantos escurecidos.',
    depth: 'Pedaços nítidos junto da embalagem e desfocados nos cantos, entre planos próximos e afastados.',
    typography: 'Título centrado em caixa alta e negrito; atributos em etiquetas pequenas; oferta numa caixa com contorno.',
    whitespace: 'Pouco: a zona do título é a única área calma.',
    textImageIntegration:
      'As etiquetas flutuam ao lado da embalagem sem a tapar; título e oferta ficam fora da acção.',
    strengths: [
      'integração do produto com elementos da sua composição ou utilização',
      'luz e textura que tornam o produto apetecível',
      'separação entre título, atributos e oferta',
      'profundidade com elementos próximos e afastados',
      'movimento sugerido pelos elementos em suspensão',
    ],
    limitations: [
      'Densidade alta: com menos argumentos, as etiquetas e os pedaços a voar tornam-se ruído.',
      'O chocolate em suspensão é um efeito próprio deste produto, não uma solução geral.',
    ],
    helpfulWhen: [
      'o pedido lança um produto alimentar ou uma bebida',
      'a textura ou a experiência do produto é o argumento',
      'o pedido é de cosmética ou de outro produto sensorial',
    ],
    doNotTransfer: [
      'o chocolate',
      'o cupcake',
      'a embalagem Bready',
      'a marca Bready',
      'o desconto «R$20 OFF no lançamento»',
      'os valores nutricionais',
      'os 17 g de proteína e os 90 segundos',
      'a cor vermelha',
      'a quantidade de etiquetas',
      'os atributos «Fofinho» e «Chocolatudo»',
      'o título «O doce mais gostoso que a Bready já fez»',
      'o slogan «Be ready, be healthy»',
    ],
    cautions: [
      'usar ingredientes, composição, benefícios e descontos apenas a partir dos dados do cliente',
      'preservar a embalagem real do produto do cliente',
    ],
    sectors: ['alimentação'],
    directUse: 'com-cuidado',
  }),

  curated({
    id: 'ref14',
    name: 'Produto num ambiente natural com benefício destacado',
    file: 'src/referencias/ref14.jpg',
    payloadFile: 'src/referencias/ref14.ref.webp',
    content:
      'Embalagem e cupcake sobre uma mesa de madeira, com fundo creme desfocado e luz suave; título coral, informação nutricional em destaque e chamada para acção em baixo.',
    styles: ['clean', 'elegante'],
    traits: ['fotografico', 'comercial'],
    techniques: [
      'produto-em-contexto',
      'iluminacao-controlada',
      'hierarquia-tipografica-forte',
      'recurso-de-destaque',
    ],
    textDensity: 'media',
    elementDensity: 'media',
    layouts: ['titulo-centro'],
    subjects: ['produto'],
    hierarchy: 'Título coral dominante, produto ao centro, benefício numérico destacado e chamada para acção em baixo.',
    contrast: 'Baixo a médio: coral e castanho sobre creme, com a embalagem vermelha a concentrar o peso.',
    lighting: 'Luz natural quente e lateral, como de janela, com sombras suaves sobre a madeira.',
    depth: 'Mesa nítida em primeiro plano e interior desfocado ao fundo; o cupcake à frente da embalagem.',
    typography: 'Letra sem serifa arredondada; título grande em coral com gradiente, apoio em castanho e notas em corpo pequeno.',
    whitespace: 'O fundo desfocado dá uma zona calma ao título; os lados da embalagem recebem os números.',
    textImageIntegration:
      'O texto assenta no fundo desfocado e a chamada para acção na frente da mesa, sem tapar o produto.',
    strengths: [
      'produto e contexto de consumo mostrados de forma coerente',
      'proximidade criada pela luz e pelos materiais',
      'um benefício principal com hierarquia clara',
      'área legível reservada para a chamada para acção',
      'fundo desfocado que dá calma ao título',
    ],
    limitations: [
      'O texto desta arte faz alegações de saúde e de nutrição que não servem de modelo.',
      'Há muitos blocos de texto à volta do produto; num pedido simples, sobra informação.',
    ],
    helpfulWhen: [
      'o pedido apresenta um produto alimentar ou natural',
      'o pedido é de cuidados pessoais ou de artigos para casa',
      'há um benefício principal a destacar',
    ],
    doNotTransfer: [
      'o cupcake',
      'a madeira',
      'a colher',
      'os valores nutricionais',
      'as alegações sobre proteína',
      'a referência a medicamentos',
      'a marca Mounjaro',
      'a embalagem Bready',
      'a marca Bready',
      'as 138 kcal e os 90 segundos',
      'a chamada «Conheça o Cupcake Bready»',
    ],
    cautions: [
      'não usar o conteúdo textual desta referência como fonte de afirmações para novas campanhas',
      'usar apenas informações pertinentes e aprovadas para o produto do cliente',
    ],
    sectors: ['alimentação'],
    directUse: 'com-cuidado',
  }),

  curated({
    id: 'ref15',
    name: 'Retrato imersivo com grafismo de marca',
    file: 'src/referencias/ref15.jpg',
    payloadFile: 'src/referencias/ref15.ref.webp',
    content:
      'Retrato feminino em grande escala, com um computador portátil na parte inferior, uma forma curva verde a atravessar a composição e um bloco inferior com título, seta e descrição.',
    styles: ['vibrante', 'tecnologico'],
    traits: ['humano', 'fotografico', 'expressivo'],
    techniques: [
      'presenca-humana',
      'integracao-pessoa-elemento',
      'ponto-de-atencao-unico',
      'profundidade-por-sobreposicao',
    ],
    textDensity: 'baixa',
    elementDensity: 'baixa',
    layouts: ['titulo-baixo'],
    subjects: ['pessoa'],
    hierarchy: 'O rosto primeiro, depois o título curto em baixo e só então a seta e a explicação.',
    contrast: 'Alto na zona de leitura: texto branco e verde-lima sobre a roupa escura.',
    lighting: 'Luz suave e frontal no rosto, com brilho natural na pele e no cabelo.',
    depth: 'A curva passa por trás da cabeça e à frente do tronco, entrelaçando grafismo e fotografia.',
    typography: 'Letra sem serifa, título em dois tons e descrição curta em corpo pequeno ao lado da seta.',
    whitespace: 'Pouco espaço vazio; a calma vem da zona uniforme da roupa, onde assenta o texto.',
    textImageIntegration:
      'O texto pousa directamente sobre a fotografia, numa zona escura e lisa que garante a leitura.',
    strengths: [
      'expressão humana como ponto de atenção',
      'formas gráficas a ligar fotografia e identidade visual',
      'área de leitura protegida por contraste',
      'separação entre título curto e explicação complementar',
      'enquadramento próximo que dá presença à pessoa',
    ],
    limitations: [
      'A curva é um grafismo de uma marca: noutra identidade, tem de nascer das formas dessa empresa.',
      'O enquadramento muito próximo deixa espaço para pouco mais do que um título curto.',
    ],
    helpfulWhen: [
      'o pedido apresenta um serviço, tecnologia ou consultoria',
      'o pedido é de formação',
      'a campanha é centrada na experiência do cliente',
    ],
    doNotTransfer: [
      'a pessoa retratada',
      'o computador',
      'a curva verde',
      'a seta',
      'a promessa de vendas',
      'o título «Sites que vendem»',
      'a promessa de sites optimizados para conversão',
      'o vestuário e as jóias',
      'a moldura fina de cantos arredondados',
    ],
    cautions: [
      'não deixar que o grafismo tape o rosto nem compita com o título',
      'usar formas compatíveis com a identidade da empresa do cliente',
    ],
    sectors: ['serviços digitais'],
    directUse: 'com-cuidado',
  }),

  curated({
    id: 'ref16',
    name: 'Serviço digital com pessoa e elementos flutuantes',
    file: 'src/referencias/ref16.jpg',
    payloadFile: 'src/referencias/ref16.ref.webp',
    content:
      'Fundo claro com uma grande forma curva verde, uma mulher sentada com um portátil ao centro, produtos e pequenos elementos de interface a flutuar à volta, título no topo e uma faixa na base.',
    styles: ['clean', 'tecnologico'],
    traits: ['conceptual', 'humano'],
    techniques: [
      'integracao-pessoa-elemento',
      'presenca-humana',
      'ponto-de-atencao-unico',
      'espaco-livre-para-texto',
    ],
    textDensity: 'baixa',
    elementDensity: 'media',
    layouts: ['titulo-centro'],
    subjects: ['pessoa', 'cena'],
    hierarchy: 'Título em cima, pessoa ao centro com os elementos à volta e faixa de apoio em baixo.',
    contrast: 'Baixo a médio: verde-escuro e verde-lima sobre fundo quase branco.',
    lighting: 'Luz de estúdio difusa e uniforme, coerente entre a pessoa e os objectos.',
    depth: 'Pouca: vem das formas curvas em camadas e de sombras leves sob os elementos.',
    typography: 'Letra sem serifa em verde-escuro, com as palavras-chave a negrito dentro do título.',
    whitespace: 'Generoso entre o título, a cena e a faixa inferior.',
    textImageIntegration:
      'Título e faixa ocupam territórios próprios, acima e abaixo da cena, sem sobreposição.',
    strengths: [
      'serviço visualizado com um conjunto pequeno de elementos relacionados',
      'elementos secundários organizados à volta do assunto principal',
      'formas amplas a conduzir o olhar',
      'espaço livre entre título, cena e informação complementar',
    ],
    limitations: [
      'Com mais elementos a flutuar, a arte passa de arejada a desarrumada.',
      'As fotografias circulares da faixa inferior parecem testemunhos de clientes sem o serem.',
    ],
    helpfulWhen: [
      'o pedido é de comércio electrónico ou de criação de websites',
      'o pedido apresenta um serviço digital ou de produtividade',
      'o pedido é de formação',
    ],
    doNotTransfer: [
      'a mulher',
      'a posição da pessoa',
      'o portátil',
      'a marca Apple',
      'os produtos',
      'o cartão «Smart Watch» com preço',
      'o prazo de 60 dias',
      'as fotografias circulares da faixa inferior',
      'a forma curva verde-lima',
      'a frase «Moderno, responsivo e pronto para gerar resultados»',
    ],
    cautions: [
      'não transformar pessoas decorativas em testemunhos de clientes',
      'usar apenas prazos e resultados fornecidos pelo utilizador',
    ],
    sectors: ['serviços digitais', 'comércio electrónico'],
    directUse: 'com-cuidado',
  }),

  curated({
    id: 'ref18',
    name: 'Composição editorial com texto e retratos',
    file: 'src/referencias/ref18.jpg',
    payloadFile: 'src/referencias/ref18.ref.webp',
    content:
      'Texto alinhado à esquerda, dois retratos em áreas de cantos arredondados à direita, fundo claro, destaques a verde e uma forma curva parcial na base.',
    styles: ['clean'],
    traits: ['editorial', 'humano', 'tipografico'],
    techniques: [
      'hierarquia-tipografica-forte',
      'presenca-humana',
      'organizacao-modular',
      'espaco-livre-para-texto',
    ],
    textDensity: 'media',
    elementDensity: 'baixa',
    layouts: ['texto-esquerda'],
    subjects: ['pessoa'],
    hierarchy: 'Título à esquerda primeiro, depois os retratos à direita e, por fim, a descrição junto da seta.',
    contrast: 'Médio: verde-escuro e verde-lima sobre fundo claro, com os retratos a concentrar a cor.',
    lighting: 'Luz de estúdio suave e uniforme nos dois retratos, sobre fundos lisos.',
    depth: 'Plana: a composição vive da grelha e das margens, não de camadas.',
    typography: 'Letra sem serifa grande, em várias linhas, com as palavras-chave em cor e peso diferentes.',
    whitespace: 'Margens largas e consistentes; a metade inferior fica quase livre.',
    textImageIntegration: 'Texto e retratos ocupam colunas separadas e não se sobrepõem.',
    strengths: [
      'divisão clara entre mensagem e apoio visual',
      'palavras importantes destacadas por peso ou cor',
      'várias fotografias organizadas sem colagem excessiva',
      'margens e espaçamento consistentes',
      'assimetria equilibrada entre as duas colunas',
    ],
    limitations: [
      'A forma curva cortada na base ocupa espaço sem acrescentar informação.',
      'Os retratos a sorrir para o telemóvel são genéricos e não identificam o serviço.',
    ],
    helpfulWhen: [
      'o pedido apresenta um serviço profissional',
      'o pedido é uma campanha educativa ou institucional',
      'é preciso explicar benefícios com texto e fotografias de apoio',
    ],
    doNotTransfer: [
      'os dois retratos',
      'os telemóveis',
      'a cor verde',
      'a referência ao Google',
      'a promessa de primeira posição',
      'a promessa de visibilidade, autoridade e vendas',
      'a forma curva parcial da base',
    ],
    cautions: [
      'não gerar garantias de posicionamento, vendas ou resultados a partir do texto desta referência',
    ],
    sectors: ['serviços digitais', 'marketing'],
    directUse: 'com-cuidado',
  }),

  curated({
    id: 'ref19',
    name: 'Processo explicado através de camadas tridimensionais',
    file: 'src/referencias/ref19.jpg',
    payloadFile: 'src/referencias/ref19.ref.webp',
    content:
      'Placas flutuantes empilhadas, de materiais translúcidos, com o símbolo do Telegram na de cima, etiquetas ligadas a cada camada e uma estrutura envolvente verde de vidro e metal.',
    styles: ['tecnologico'],
    traits: ['tridimensional', 'conceptual', 'informativo'],
    techniques: [
      'materiais-transparentes',
      'profundidade-por-sobreposicao',
      'metafora-visual',
      'iluminacao-controlada',
    ],
    textDensity: 'media',
    elementDensity: 'media',
    layouts: ['titulo-topo'],
    subjects: ['cena'],
    hierarchy: 'Título em cima, pilha de camadas ao centro com legendas ligadas e conclusão curta em baixo, à esquerda.',
    contrast: 'Médio: verde saturado e branco num ambiente claro e esverdeado.',
    lighting: 'Luz difusa e clara, com reflexos e refracções controlados no vidro.',
    depth: 'Camadas empilhadas em perspectiva dentro de uma estrutura que recua para o fundo.',
    typography: 'Letra sem serifa com palavras-chave a verde e a negrito; legendas curtas em etiquetas com contorno.',
    whitespace: 'O topo claro acolhe o título; as legendas ficam afastadas da pilha por linhas finas.',
    textImageIntegration:
      'Linhas pontilhadas ligam cada legenda à sua camada, sem que o texto toque nos objectos.',
    strengths: [
      'etapas ou componentes representados por camadas',
      'legendas curtas ligadas a partes da composição',
      'profundidade criada com materiais e sombras',
      'um serviço abstracto tornado compreensível',
      'materiais translúcidos com reflexos coerentes',
    ],
    limitations: [
      'O título da própria referência tem um erro («comolicada»): o texto dela não serve de exemplo.',
      'O vidro verde e a estrutura envolvente dominam a cor da arte inteira; o que se aproveita são as camadas, não o ambiente.',
    ],
    helpfulWhen: [
      'o pedido explica um processo ou um serviço com etapas distintas',
      'o pedido é de automação, integrações ou plataformas',
    ],
    doNotTransfer: [
      'o Telegram e o seu símbolo',
      'as quatro camadas',
      'a estrutura metálica',
      'a cor verde',
      'a sequência de acções da imagem',
      'a marca Usebot',
      'o título sobre a operação no Telegram',
      'a frase «Quatro passos. Uma operação pronta para rodar.»',
    ],
    cautions: [
      'fazer o número e a ordem das etapas reflectir o serviço real',
      'quando a informação precisar de precisão, usar texto e conectores controlados pela aplicação',
    ],
    sectors: ['tecnologia', 'automação'],
    /*
      `com-cuidado`, e não `nunca`, apesar de ser 3D e conceptual: as
      camadas são uma forma de diagrama, não um símbolo. O que o gerador
      tiraria da imagem — etapas empilhadas, vidro, reflexos — é o que ela
      tem para ensinar; o Telegram, o verde e as quatro placas vão proibidos
      ao lado dela.
    */
    directUse: 'com-cuidado',
  }),

  curated({
    id: 'ref20',
    name: 'Produto premium com iluminação de estúdio',
    file: 'src/referencias/ref20.jpg',
    payloadFile: 'src/referencias/ref20.ref.webp',
    content:
      'Carregador sem fios em grande escala, apoiado numa superfície escura, sobre fundo azul luminoso, com título no topo e pequenas indicações de funcionalidades à volta.',
    styles: ['tecnologico', 'elegante'],
    traits: ['comercial', 'tridimensional'],
    techniques: [
      'ponto-de-atencao-unico',
      'iluminacao-controlada',
      'hierarquia-tipografica-forte',
      'recurso-de-destaque',
    ],
    textDensity: 'media',
    elementDensity: 'baixa',
    layouts: ['titulo-centro'],
    subjects: ['produto'],
    hierarchy: 'Título grande em cima, produto dominante ao centro e indicações técnicas pequenas à volta.',
    contrast: 'Médio-alto: produto metálico e texto branco sobre azul profundo.',
    lighting: 'Luz de estúdio com brilho de contorno nas arestas metálicas e um foco luminoso no topo do fundo.',
    depth: 'Produto visto ligeiramente de baixo, em perspectiva, apoiado numa superfície escura.',
    typography: 'Letra sem serifa geométrica e grande no título; especificações em caixa alta e corpo pequeno.',
    whitespace: 'A zona do título é calma; as indicações ocupam os vazios laterais sem tocar no produto.',
    textImageIntegration:
      'As especificações flutuam nos vazios à volta do produto e o título fica acima dele.',
    strengths: [
      'produto como protagonista',
      'iluminação que revela forma, acabamento e material',
      'poucos elementos secundários',
      'separação entre nome, benefício e especificações',
      'perspectiva que dá presença ao produto',
    ],
    limitations: [
      'As especificações em corpo pequeno ficam ilegíveis em ecrãs pequenos.',
      'O fundo azul luminoso é uma convenção da electrónica, não uma regra para produtos tecnológicos.',
    ],
    helpfulWhen: [
      'o pedido apresenta electrónica ou acessórios',
      'o pedido é de electrodomésticos ou de cosmética',
      'há um produto físico cujo acabamento é argumento',
    ],
    doNotTransfer: [
      'o carregador',
      'o pedestal',
      'a cor azul',
      'a marca Acefast',
      'a potência de 15 W',
      'o ícone do relâmpago',
      'o título «Pure Power»',
      'as especificações técnicas da imagem',
    ],
    cautions: [
      'não alterar a geometria do produto',
      'não inventar portas, acessórios ou funcionalidades',
    ],
    sectors: ['electrónica'],
    directUse: 'com-cuidado',
  }),

  curated({
    id: 'ref21',
    name: 'Apresentação de conjunto de produtos',
    file: 'src/referencias/ref21.jpg',
    payloadFile: 'src/referencias/ref21.ref.webp',
    content:
      'Conjunto de microfones sem fios e o seu estojo, com os componentes suspensos a alturas diferentes sobre tecido azul ondulado, título grande no topo e etiquetas laterais.',
    styles: ['tecnologico', 'elegante'],
    traits: ['comercial', 'tridimensional'],
    techniques: [
      'organizacao-modular',
      'profundidade-por-sobreposicao',
      'iluminacao-controlada',
      'hierarquia-tipografica-forte',
    ],
    textDensity: 'media',
    elementDensity: 'media',
    layouts: ['titulo-centro'],
    subjects: ['produto'],
    hierarchy: 'Título enorme em cima, o receptor no estojo como peça principal e os transmissores à volta.',
    contrast: 'Médio: produtos escuros e texto branco sobre azul profundo, com brilhos a recortar as arestas.',
    lighting: 'Luz suave de estúdio, com reflexos discretos no plástico e no tecido.',
    depth: 'Componentes suspensos a alturas e distâncias diferentes, sobre ondas de tecido que recuam.',
    typography: 'Letra sem serifa: marca pequena sobre um título em caixa alta muito grande; etiquetas em vidro fosco.',
    whitespace: 'Faixas calmas no topo e na base para o texto; o centro é do produto.',
    textImageIntegration:
      'As etiquetas laterais pousam ao lado do produto e o parágrafo final assenta sobre o tecido escuro.',
    strengths: [
      'vários componentes apresentados como um conjunto coerente',
      'protagonismo dado ao elemento principal',
      'acessórios distribuídos sem perder a leitura',
      'superfície de apoio a criar atmosfera',
      'componentes a alturas diferentes a criar profundidade',
    ],
    limitations: [
      'O parágrafo final, em corpo muito pequeno, não se lê num ecrã de telemóvel.',
      'Componentes a flutuar podem sugerir peças que não vêm no conjunto.',
    ],
    helpfulWhen: [
      'o pedido apresenta um kit de equipamentos',
      'o pedido é um conjunto de cosmética ou uma colecção',
      'há um pacote de produtos com uma peça principal',
    ],
    doNotTransfer: [
      'os microfones DJI',
      'a marca DJI',
      'o estojo de carregamento',
      'o tecido',
      'a cor azul',
      'a quantidade de acessórios',
      'as especificações',
      'os textos em inglês da imagem',
    ],
    cautions: [
      'mostrar apenas componentes incluídos ou claramente identificados',
      'não sugerir que um acessório faz parte da oferta quando isso não foi informado',
    ],
    sectors: ['electrónica', 'audiovisual'],
    directUse: 'com-cuidado',
  }),

  curated({
    id: 'ref22',
    name: 'Produto com contraste quente e destaque técnico',
    file: 'src/referencias/ref22.jpg',
    payloadFile: 'src/referencias/ref22.ref.webp',
    content:
      'Bateria externa inclinada sobre uma base escura, com luz laranja intensa por trás, título grande no topo e especificações distribuídas pelas laterais.',
    styles: ['tecnologico', 'vibrante', 'cinematografico'],
    traits: ['comercial', 'alto-impacto'],
    techniques: [
      'iluminacao-dramatica',
      'contraste-alto',
      'hierarquia-tipografica-forte',
      'ponto-de-atencao-unico',
      'recurso-de-destaque',
    ],
    textDensity: 'media',
    elementDensity: 'baixa',
    layouts: ['titulo-centro'],
    subjects: ['produto'],
    hierarchy: 'Título em duas linhas no topo, produto inclinado ao centro e números técnicos nas laterais.',
    contrast: 'Muito alto: luz laranja intensa atrás de um produto escuro, sobre fundo quase preto.',
    lighting: 'Contraluz forte que recorta a silhueta do produto e do pedestal.',
    depth: 'Produto inclinado em perspectiva sobre um cubo, com a luz de fundo a separar os planos.',
    typography: 'Letra sem serifa geométrica em caixa alta, com a segunda linha do título a laranja e números grandes nas especificações.',
    whitespace: 'Laterais livres para as especificações; o produto ocupa o centro e a base.',
    textImageIntegration:
      'Os números assentam nas zonas escuras laterais, afastados do produto, sem tapar a silhueta.',
    strengths: [
      'luz de fundo a separar produto e cenário',
      'hierarquia forte entre título, produto e informação técnica',
      'números usados pontualmente como destaque',
      'composição com presença e energia',
    ],
    limitations: [
      'A contraluz intensa altera a percepção da cor do produto.',
      'Luz forte e fundo escuro são uma escolha desta campanha, não a regra para produtos tecnológicos.',
    ],
    helpfulWhen: [
      'o pedido lança um produto ou um equipamento',
      'o pedido apresenta acessórios com características técnicas a destacar',
      'a campanha fala de desempenho',
    ],
    doNotTransfer: [
      'a bateria externa (power bank)',
      'a cor laranja',
      'o pedestal',
      'a capacidade de 10 000 mAh',
      'a potência de 25 W',
      'o carregamento sem fios',
      'o cabo entrançado',
      'o símbolo Qi2',
      'a frase «Power that moves with you»',
    ],
    cautions: [
      'usar características técnicas apenas com dados reais do cliente',
      'não deixar que a iluminação altere a percepção da cor original do produto',
    ],
    sectors: ['electrónica'],
    directUse: 'com-cuidado',
  }),

  curated({
    id: 'ref23',
    name: 'Narrativa cinematográfica de exploração',
    file: 'src/referencias/ref23.jpg',
    payloadFile: 'src/referencias/ref23.ref.webp',
    content:
      'Astronauta diante de um foguetão num ambiente espacial rochoso, com asteróides e nebulosa sob iluminação violeta, forte profundidade e texto concentrado na parte inferior.',
    styles: ['cinematografico'],
    traits: ['conceptual', 'expressivo', 'alto-impacto'],
    techniques: [
      'metafora-visual',
      'iluminacao-dramatica',
      'profundidade-por-sobreposicao',
      'contraste-alto',
    ],
    textDensity: 'baixa',
    elementDensity: 'media',
    layouts: ['titulo-baixo'],
    subjects: ['cena'],
    hierarchy: 'A cena conta a ideia primeiro; o título curto em baixo confirma-a.',
    contrast: 'Alto: foguetão e nebulosa iluminados contra um espaço quase negro.',
    lighting: 'Luz violeta intensa vinda do alto, a recortar o foguetão e o astronauta e a puxar o olhar para cima.',
    depth: 'Muitos planos: rochas à frente, astronauta, foguetão, asteróides e nebulosa ao fundo.',
    typography: 'Letra sem serifa branca, curta e centrada, com três etiquetas de contorno por cima do título.',
    whitespace: 'Pouco; o texto assenta na faixa escura do chão.',
    textImageIntegration:
      'O texto ocupa a base escura da cena, sem caixa por trás, apoiado pelo escurecimento do chão.',
    strengths: [
      'cena que comunica uma ideia antes da leitura',
      'relação de escala entre personagens, objectos e ambiente',
      'luz a conduzir o olhar',
      'integração entre metáfora visual e mensagem',
    ],
    limitations: [
      'Espaço e foguetões são metáforas gastas para crescimento.',
      'A cena é reconhecível ao ponto de, mostrada ao gerador, ser copiada.',
    ],
    helpfulWhen: [
      'o pedido fala de expansão ou de novos mercados',
      'a campanha comunica descoberta, inovação ou novas possibilidades',
    ],
    doNotTransfer: [
      'o astronauta',
      'o foguetão',
      'os planetas',
      'os asteróides',
      'a cor roxa',
      'o cenário espacial',
      'o logótipo da marca da imagem',
      'as etiquetas «New universe», «New markets» e «New users»',
      'o título «Go Beyond the Market»',
      'a frase sobre entrar em novas galáxias',
    ],
    cautions: [
      'não usar espaço e foguetões como solução automática para pedidos sobre crescimento',
      'fazer a metáfora nascer do contexto do cliente',
    ],
    sectors: ['marketing'],
    /*
      `nunca`: o valor está na narrativa, e a narrativa desta imagem É o
      astronauta e o foguetão. Mostrada ao gerador, voltava como cena
      espacial em qualquer pedido de crescimento. A escala e a luz a guiar
      o olhar passam por palavras.
    */
    directUse: 'nunca',
  }),

  curated({
    id: 'ref24',
    name: 'Objecto conceptual num cenário minimalista',
    file: 'src/referencias/ref24.jpg',
    payloadFile: 'src/referencias/ref24.ref.webp',
    content:
      'Bússola tridimensional de metal sobre uma superfície clara, com o mostrador violeta iluminado, título no topo e uma pequena faixa de texto em baixo.',
    styles: ['clean', 'elegante'],
    traits: ['conceptual', 'tridimensional'],
    techniques: [
      'metafora-visual',
      'ponto-de-atencao-unico',
      'espaco-livre-para-texto',
      'iluminacao-controlada',
    ],
    textDensity: 'baixa',
    elementDensity: 'baixa',
    layouts: ['titulo-centro'],
    subjects: ['cena'],
    hierarchy: 'Título em cima, um único objecto ao centro e uma faixa curta a fechar em baixo.',
    contrast: 'Médio: o mostrador violeta é o ponto mais contrastado sobre o cinzento claro.',
    lighting: 'Luz suave e difusa de cima, com sombra de contacto realista e brilho próprio no mostrador.',
    depth: 'Objecto visto ligeiramente de cima, assente na superfície pela sua sombra.',
    typography: 'Letra sem serifa escura e centrada: título em negrito e apoio em duas linhas de peso regular.',
    whitespace: 'Generoso à volta do objecto e do título.',
    textImageIntegration:
      'Texto e objecto em territórios separados; a faixa inferior fecha a composição sem tocar no objecto.',
    strengths: [
      'uma ideia explicada por um objecto principal',
      'poucos elementos a fortalecer o foco',
      'sombras e materiais com acabamento convincente',
      'título e símbolo relacionados sem excesso de texto',
    ],
    limitations: [
      'A bússola é o símbolo mais previsível para estratégia.',
      'Só funciona com texto curto: a composição não comporta mais informação.',
    ],
    helpfulWhen: [
      'o pedido é de estratégia, orientação ou consultoria',
      'o pedido é de planeamento ou de educação e cabe num só símbolo',
    ],
    doNotTransfer: [
      'a bússola',
      'a cor roxa',
      'o cenário cinzento',
      'a faixa inferior',
      'o logótipo da marca da imagem',
      'o título «Clarity Changes Everything»',
      'a frase sobre construir impérios',
    ],
    cautions: [
      'escolher um objecto específico para o pedido: nem toda a campanha de consultoria deve gerar uma bússola',
    ],
    sectors: ['consultoria'],
    /*
      `nunca`: a referência vale pelo método — um só objecto a carregar a
      ideia —, não pelo objecto. Enviada como imagem, a bússola passava a
      ser a resposta para qualquer pedido de estratégia ou consultoria.
    */
    directUse: 'nunca',
  }),

  curated({
    id: 'ref25',
    name: 'Movimento ascendente com efeitos luminosos',
    file: 'src/referencias/ref25.jpg',
    payloadFile: 'src/referencias/ref25.ref.webp',
    content:
      'Notas de dinheiro suspensas ao longo de um percurso luminoso em espiral, com partículas e fumo, sobre fundo escuro violeta, e título no canto superior esquerdo.',
    styles: ['cinematografico', 'vibrante'],
    traits: ['expressivo', 'alto-impacto', 'conceptual'],
    techniques: [
      'movimento-implicito',
      'iluminacao-dramatica',
      'profundidade-por-sobreposicao',
      'contraste-alto',
      'espaco-livre-para-texto',
    ],
    textDensity: 'baixa',
    elementDensity: 'media',
    layouts: ['titulo-topo'],
    subjects: ['cena'],
    hierarchy: 'O percurso luminoso domina; o título curto no canto superior esquerdo lê-se à parte.',
    contrast: 'Muito alto: rasto violeta e notas iluminadas sobre um fundo quase preto.',
    lighting: 'A própria espiral é a fonte de luz, difundida por partículas e fumo.',
    depth: 'Notas a várias distâncias ao longo da espiral, maiores em baixo e menores no alto.',
    typography: 'Letra sem serifa em negrito, alinhada à esquerda, com apoio curto em peso regular.',
    whitespace: 'O canto superior esquerdo fica escuro e liso, reservado ao texto.',
    textImageIntegration: 'O texto vive numa zona escura própria, fora da trajectória da luz.',
    strengths: [
      'olhar conduzido por uma trajectória',
      'elementos distribuídos em profundidades diferentes',
      'movimento criado com luz de forma controlada',
      'área simples reservada para a mensagem',
    ],
    limitations: [
      'Dinheiro a voar é a metáfora mais óbvia para crescimento e arrasta promessas de lucro.',
      'Os efeitos de luz e de partículas apagam com facilidade um produto ou o texto.',
    ],
    helpfulWhen: [
      'o pedido comunica transformação ou evolução',
      'a campanha pede dinamismo e o conceito justifica um percurso',
    ],
    doNotTransfer: [
      'o dinheiro',
      'as notas de dólar',
      'as notas de euro',
      'a cor roxa',
      'a espiral',
      'a promessa de multiplicação financeira',
      'o código de barras',
      'o logótipo da marca da imagem',
      'o título «Engineered to Multiply»',
      'a frase «Not luck. Precision.»',
    ],
    cautions: [
      'não associar esta referência automaticamente a promessas de lucro',
      'evitar efeitos que prejudiquem a identificação do produto ou a leitura',
    ],
    sectors: ['marketing', 'finanças'],
    /*
      `nunca`: com a imagem à frente, o gerador devolvia notas a voar — e,
      com elas, uma promessa de lucro que ninguém fez. A trajectória e a luz
      controlada transmitem-se por palavras.
    */
    directUse: 'nunca',
  }),

  curated({
    id: 'ref26',
    name: 'Contraste entre materiais e valor percebido',
    file: 'src/referencias/ref26.jpg',
    payloadFile: 'src/referencias/ref26.ref.webp',
    content:
      'Diamante violeta sobre uma rocha escura com uma fissura iluminada, em fundo claro, com título no topo e uma frase em baixo.',
    styles: ['elegante', 'tecnologico'],
    traits: ['conceptual', 'tridimensional'],
    techniques: [
      'metafora-visual',
      'ponto-de-atencao-unico',
      'iluminacao-controlada',
      'hierarquia-tipografica-forte',
    ],
    textDensity: 'baixa',
    elementDensity: 'baixa',
    layouts: ['titulo-centro'],
    subjects: ['cena'],
    hierarchy: 'Título com uma palavra em caixa de destaque, objecto ao centro e frase curta a fechar em baixo.',
    contrast: 'Médio: violeta saturado e pedra escura sobre um fundo cinzento claro.',
    lighting: 'Luz geral suave, com um brilho localizado na fissura a servir de ponto focal.',
    depth: 'Objecto central visto de frente, com partículas e cristais cortados nas margens a sugerir planos.',
    typography: 'Letra sem serifa escura e em negrito, com a palavra-chave a branco numa caixa violeta.',
    whitespace: 'Fundo liso e generoso à volta do objecto.',
    textImageIntegration: 'O texto fica em cima e em baixo, em zonas lisas do fundo, sem tocar na cena.',
    strengths: [
      'superfícies ásperas e polidas em contraponto',
      'ponto focal criado por luz localizada',
      'transformação ou valor representados por uma ideia visual',
      'cena detalhada equilibrada por um fundo simples',
    ],
    limitations: [
      'O diamante é o símbolo mais previsível para valor e para premium.',
      'O brilho violeta e os cristais tornam o resultado ostensivo com facilidade.',
    ],
    helpfulWhen: [
      'o pedido é de posicionamento premium ou de diferenciação',
      'a campanha comunica a transformação de um serviço ou a sua qualidade',
    ],
    doNotTransfer: [
      'o diamante',
      'a pedra partida',
      'as fissuras luminosas',
      'a cor roxa',
      'a ideia de investimento',
      'os cristais cortados nas margens',
      'o logótipo da marca da imagem',
      'o título «Where Strategy Becomes Asset»',
      'a frase «Transform insight into impact»',
    ],
    cautions: [
      'não fazer de premium sinónimo de diamantes ou de brilho',
      'escolher materiais e símbolos adequados à marca do cliente',
    ],
    sectors: ['marketing', 'consultoria'],
    /*
      `nunca`: o diamante é o objecto-metáfora que o gerador copiaria, e
      "premium" acabava a significar pedras preciosas. O contraponto entre
      superfícies e a luz localizada passam por palavras.
    */
    directUse: 'nunca',
  }),

  curated({
    id: 'ref27',
    name: 'Objecto tridimensional para comunicar tempo',
    file: 'src/referencias/ref27.jpg',
    payloadFile: 'src/referencias/ref27.ref.webp',
    content:
      'Calendário 3D com um número grande, sobre fundo claro, com detalhes violeta, título no topo e cristais parcialmente cortados nas margens.',
    styles: ['clean', 'tecnologico'],
    traits: ['tridimensional', 'informativo'],
    techniques: [
      'ponto-de-atencao-unico',
      'metafora-visual',
      'recurso-de-destaque',
      'espaco-livre-para-texto',
    ],
    textDensity: 'baixa',
    elementDensity: 'baixa',
    layouts: ['titulo-centro'],
    subjects: ['cena'],
    hierarchy: 'O número dentro do objecto lê-se primeiro, depois o título entre aspas e a frase de enquadramento.',
    contrast: 'Médio-alto: número preto e topo violeta sobre um fundo cinzento claro.',
    lighting: 'Luz suave de estúdio, com reflexos metálicos nas argolas e sombra difusa por baixo.',
    depth: 'Objecto inclinado em perspectiva, com cristais cortados nas margens a criar planos próximos.',
    typography: 'Letra sem serifa em negrito no título; o número, enorme e condensado, domina dentro do calendário.',
    whitespace: 'Fundo liso e amplo; o objecto respira ao centro.',
    textImageIntegration:
      'O número vive dentro do objecto; o título e as notas ficam fora dele, em zonas lisas.',
    strengths: [
      'informação temporal tornada visualmente evidente',
      'objecto simples como suporte da mensagem',
      'elemento central equilibrado com detalhes discretos nas margens',
      'leitura rápida preservada',
    ],
    limitations: [
      'O calendário é o símbolo mais previsível para tempo e planeamento.',
      'O número dentro do objecto convida a inventar contagens decrescentes.',
    ],
    helpfulWhen: [
      'o pedido comunica uma data, um prazo ou o fim de inscrições',
      'o pedido divulga um evento ou é de planeamento',
    ],
    doNotTransfer: [
      'o calendário',
      'o número 12',
      'a cor roxa',
      'os cristais',
      'o código de barras decorativo',
      'a contagem «Only 12 days»',
      'o logótipo da marca da imagem',
      'o título «Plan Smarter, Scale Faster»',
      'as notas sobre calendários e campanhas',
    ],
    cautions: [
      'não inventar contagens decrescentes nem escassez',
      'fazer corresponder qualquer número ao pedido aprovado',
    ],
    sectors: ['marketing'],
    /*
      `nunca`: um calendário com um número grande é exactamente o que o
      gerador reproduziria, com contagem decrescente incluída. O que se
      aproveita — um objecto simples a tornar evidente uma data — diz-se
      por palavras.
    */
    directUse: 'nunca',
  }),

  curated({
    id: 'ref28',
    name: 'Objecto monumental em cena de impacto',
    file: 'src/referencias/ref28.jpg',
    payloadFile: 'src/referencias/ref28.ref.webp',
    content:
      'Moeda de Bitcoin em grande escala a embater num chão fragmentado, com luz violeta, fundo preto e título amplo no quadrante superior esquerdo.',
    styles: ['cinematografico', 'tecnologico'],
    traits: ['alto-impacto', 'tridimensional'],
    techniques: [
      'ponto-de-atencao-unico',
      'iluminacao-dramatica',
      'contraste-alto',
      'espaco-livre-para-texto',
      'movimento-implicito',
    ],
    textDensity: 'baixa',
    elementDensity: 'media',
    layouts: ['titulo-topo'],
    subjects: ['cena'],
    hierarchy: 'Título amplo no quadrante superior esquerdo e objecto monumental a ocupar a metade inferior.',
    contrast: 'Muito alto: luz violeta e metal brilhante sobre fundo preto.',
    lighting: 'Luz de contorno violeta a recortar a moeda e as arestas dos fragmentos.',
    depth: 'Fragmentos à frente, objecto inclinado ao meio e chão estalado a recuar na escuridão.',
    typography: 'Letra sem serifa grande, em duas linhas paralelas, com gradiente lilás e muito espaço à volta.',
    whitespace: 'Metade superior quase vazia, a funcionar como zona de leitura.',
    textImageIntegration:
      'Texto e cena dividem a arte na diagonal: leitura limpa em cima, impacto em baixo.',
    strengths: [
      'objecto que assume protagonismo pela escala',
      'zona de leitura simples separada de uma zona visual intensa',
      'luz de contorno e textura a dar presença',
      'sensação de impacto quando a campanha a justifica',
    ],
    limitations: [
      'A escala monumental e o fundo preto não servem pedidos sóbrios ou informativos.',
      'O tema financeiro arrasta promessas de rendimento e avisos legais.',
    ],
    helpfulWhen: [
      'o pedido é uma campanha de lançamento com forte presença visual',
      'o pedido é de posicionamento e pede impacto',
    ],
    doNotTransfer: [
      'o Bitcoin e o seu símbolo',
      'a moeda',
      'as rochas partidas',
      'a cor roxa',
      'o logótipo do canto superior direito',
      'a promessa de rendimento',
      'o título «Hold BTC Earn BTC»',
      'os avisos legais sobre produtos financeiros',
    ],
    cautions: [
      'não transformar esta composição numa regra para produtos tecnológicos',
      'não importar afirmações financeiras nem textos legais da referência',
    ],
    sectors: ['finanças', 'criptomoedas'],
    /*
      `nunca`: a moeda monumental e o tema financeiro são reconhecíveis ao
      ponto de arrastarem símbolo, cor e promessa de rendimento para a arte.
      A divisão entre zona de leitura e zona de impacto passa por palavras.
    */
    directUse: 'nunca',
  }),

  curated({
    id: 'ref30',
    name: 'Fotografia de estilo de vida com mensagem aspiracional',
    file: 'src/referencias/ref30.jpg',
    payloadFile: 'src/referencias/ref30.ref.webp',
    content:
      'Mulher a correr numa paisagem costeira, com luz natural e céu amplo, título branco na área superior e logótipo no topo.',
    // Cinematográfico pela narrativa fotográfica — enquadramento, luz,
    // paisagem —, sem depender de efeitos especiais nem de fundo escuro.
    styles: ['clean', 'cinematografico'],
    traits: ['fotografico', 'humano'],
    techniques: [
      'presenca-humana',
      'espaco-livre-para-texto',
      'movimento-implicito',
      'ponto-de-atencao-unico',
    ],
    textDensity: 'baixa',
    elementDensity: 'baixa',
    layouts: ['titulo-centro'],
    subjects: ['pessoa'],
    hierarchy: 'Título grande no céu, a corredora ao centro e o subtítulo a completar a frase.',
    contrast: 'Médio: texto branco sobre céu azul, mais legível onde o céu é mais escuro.',
    lighting: 'Luz natural do sol, quente e lateral, sobre a pessoa e a paisagem.',
    depth: 'Profundidade real de paisagem: caminho em primeiro plano, costa e horizonte ao fundo.',
    typography: 'Letra sem serifa em caixa alta, branca e centrada, com o subtítulo em corpo pequeno.',
    whitespace: 'O céu amplo funciona como espaço livre natural para o texto.',
    textImageIntegration:
      'O texto assenta no céu, sem caixa nem véu, e acaba antes da cabeça da corredora.',
    strengths: [
      'experiência ou aspiração mostrada com fotografia contextual',
      'céu, parede ou outras áreas tranquilas usadas como espaço de leitura',
      'relação natural entre pessoa e ambiente',
      'emoção criada com enquadramento e luz, sem excesso de grafismos',
    ],
    limitations: [
      'Texto branco sobre céu claro perde contraste nas zonas mais luminosas.',
      'Depende de uma fotografia real de boa qualidade; sem ela, a arte perde a força.',
    ],
    helpfulWhen: [
      'o pedido é de bem-estar, desporto ou qualidade de vida',
      'o pedido é de turismo ou de lazer',
      'há uma fotografia real com uma zona calma para o texto',
    ],
    doNotTransfer: [
      'a corredora',
      'a praia e a paisagem costeira',
      'a roupa',
      'a marca Oxy Prime',
      'as afirmações sobre longevidade',
      'o título «Não se trata de viver mais»',
    ],
    cautions: [
      'não produzir promessas de saúde a partir desta referência',
      'garantir contraste do texto sobre a fotografia',
      'garantir uma representação de pessoas adequada ao público da empresa',
    ],
    sectors: ['bem-estar', 'desporto'],
    directUse: 'com-cuidado',
  }),
];

const byId = new Map(VISUAL_REFERENCES.map((reference) => [reference.id, reference]));

export function getReference(id: string): VisualReference | null {
  return byId.get(id) ?? null;
}

export function approvedReferences(): VisualReference[] {
  return VISUAL_REFERENCES.filter((reference) => reference.status === 'aprovada');
}

/**
 * Completa um plano de aproveitamento com as proibições da biblioteca.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O modelo de texto escreve o que quer aproveitar de cada referência. O que
 * NÃO deve ser transferido não fica ao critério dele: vem do cadastro, onde
 * um humano o escreveu depois de olhar para a imagem.
 *
 * É a diferença entre uma proibição que depende de o modelo se lembrar e uma
 * que o sistema garante.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function completeUsage(usage: ReferenceUsage[]): ReferenceUsage[] {
  return usage.flatMap((entry) => {
    const reference = getReference(entry.referenceId);
    if (!reference || reference.status !== 'aprovada') return [];

    return [
      {
        referenceId: entry.referenceId,
        take: entry.take.length > 0 ? entry.take : reference.strengths.slice(0, 3),
        // União das duas listas: o que o modelo notou mais o que o cadastro
        // já sabia.
        doNotTransfer: [...new Set([...reference.doNotTransfer, ...entry.doNotTransfer])],
        /*
          Quem decide se a imagem viaja é o CADASTRO, e só ele.

          Viajava só quando a referência era `segura` — e nenhuma das nove o
          é. Na prática, o gerador nunca viu uma única referência: recebia
          "aproveita a profundidade e a iluminação cuidada" por palavras, sem
          nada que lhe mostrasse o nível. Uma arte da DOT pedida à IA saía
          como um cartaz de texto, com nove artes de agência na biblioteca.

          Agora viaja tudo o que não é `nunca`, como exemplo de acabamento e
          com o que não se copia dito ao lado de cada uma (ver `prompt.ts`).
          As `nunca` continuam só por palavras: são as de cena demasiado
          reconhecível, onde o risco de cópia é maior do que o ganho.
        */
        mode: reference.directUse === 'nunca' ? 'descricao' : 'imagem',
        // O porquê da escolha segue com ela (diagnóstico; nunca vai para o gerador).
        ...(entry.why ? { why: entry.why } : {}),
      },
    ];
  });
}
