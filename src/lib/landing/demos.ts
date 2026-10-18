/**
 * Manifesto das artes de demonstração da página pública.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * REGRA: tudo o que a página mostra como "resultado" tem de ser uma arte
 * VERDADEIRA, produzida pela Kriar a partir do pedido escrito aqui. Nada de
 * maquetas desenhadas à mão a fazer de resultado, e NUNCA as imagens de
 * `src/referencias` ou `src/Referencias visuais`: são referências de
 * direcção artística de terceiros, não são resultados da Kriar e não podem
 * ser servidas ao browser (ver `next.config.ts`).
 *
 * Todas as entradas começam com `image: null`. Enquanto não houver ficheiro:
 *  · em DESENVOLVIMENTO, o lugar da arte mostra um esboço técnico com
 *    "Arte por gerar" e o identificador, e um aviso no canto da página lista
 *    os ficheiros em falta;
 *  · em PRODUÇÃO, os cartões sem imagem desaparecem, a galeria e o trio da
 *    mesma empresa só aparecem com pelo menos 3 imagens, a arte final da
 *    demonstração do topo fica como esboço com a etiqueta "Demonstração", e
 *    a última chamada aparece sem arte.
 * Para ver em desenvolvimento o que um visitante vê, abre `/?vista=producao`.
 *
 * COMO GERAR CADA ARTE (custa créditos de IA: é para o dono fazer, uma vez)
 * -----------------------------------------------------------------------
 * 1. Prepara a empresa indicada em `setup`. As três da Perfumaria Kianda
 *    usam a conta de demonstração: em /entrar, "Entrar com dados de
 *    exemplo" cria a empresa com o logótipo, as cores e duas publicações
 *    com as fotografias do perfume e do difusor (`src/kianda/`) já
 *    anexadas. As outras são empresas novas
 *    ("Nova empresa" no selector de empresas), com as cores sugeridas.
 *    As artes vão ficar públicas: nos contactos das marcas fictícias usa
 *    valores que não pertençam a ninguém, ou desliga-os na revisão.
 * 2. Na publicação, escreve o pedido EXACTAMENTE como está em `request` —
 *    a página mostra este texto como o pedido que originou a arte. Escolhe o
 *    formato "Instagram e Facebook · 1080 × 1350" e o estilo de `style`.
 * 3. "Preparar proposta". Na revisão, escreve os textos de `review` nos
 *    campos com o mesmo nome (título, texto de apoio, chamada para acção,
 *    preço, etiqueta) — assim o que a página mostra na revisão é o que está
 *    na arte. Gera.
 * 4. Confirma o resultado (logótipo, textos, nada inventado). Se não estiver
 *    à altura da página, "Gerar outra" ou edita a zona — esta é a montra.
 * 5. "Descarregar PNG". O aviso diz as medidas do ficheiro.
 * 6. Converte para WebP e dá-lhe o nome do identificador, na pasta
 *    `public/demonstracoes/`. Com o `sharp`, que já vem com o Next:
 *
 *      node -e "require('sharp')('C:/caminho/kriar-....png').webp({ quality: 86 }).toFile('public/demonstracoes/<id>.webp').then((i) => console.log(i.width + ' x ' + i.height))"
 *
 *    (Um `.png` também serve; o WebP pesa menos de metade.)
 * 7. Aqui, na entrada: `image: '/demonstracoes/<id>.webp'`, confirma
 *    `width` e `height` com as medidas impressas pelo comando e reescreve o
 *    `alt` a descrever o que a arte MOSTRA (o produto, a cena, o título).
 *
 * As selecções no fim (`DEMO_SELECTION`) dizem que entrada vai para cada
 * sítio da página; trocar uma arte de sítio é trocar o identificador.
 * ──────────────────────────────────────────────────────────────────────────
 */
import type { FormatId, StyleId } from '@/lib/domain/types';

export type DemoReviewTexts = {
  headline: string;
  subheadline?: string;
  cta?: string;
  price?: string;
  badge?: string;
};

export type DemoEntry = {
  /** Identificador estável. É também o nome do ficheiro em `public/demonstracoes/`. */
  id: string;
  /** Sector, como aparece no cartão da galeria. */
  sector: string;
  /** Nome da empresa. */
  brand: string;
  /** Marca inventada para a demonstração. A página di-lo sempre que é verdade. */
  fictitious: boolean;
  /** O pedido que originou a arte, palavra por palavra. */
  request: string;
  /** Caminho em `/demonstracoes/`, ou `null` enquanto a arte não existir. */
  image: string | null;
  /** Medidas reais do ficheiro, para reservar o espaço sem saltos. */
  width: number;
  height: number;
  /** Descrição do que a arte mostra, para quem não a vê. */
  alt: string;
  /** Formato a escolher no editor. */
  format: FormatId;
  /** Estilo a escolher no editor. */
  style: StyleId;
  /** Textos a escrever na revisão antes de gerar. */
  review: DemoReviewTexts;
  /** Como preparar a empresa na Kriar antes de gerar. */
  setup: string;
};

const ENTRIES = [
  // --- Perfumaria Kianda: a marca fictícia da conta de demonstração ---------
  {
    id: 'beleza-kianda-lancamento',
    sector: 'Beleza',
    brand: 'Perfumaria Kianda',
    fictitious: true,
    request: 'Quero anunciar o novo perfume da minha loja.',
    image: null,
    width: 1080,
    height: 1350,
    alt: 'Arte de demonstração da Perfumaria Kianda a apresentar o perfume Noite de Luanda, nas cores azul-marinho, creme e âmbar da marca.',
    format: 'vertical',
    style: 'elegante',
    review: {
      headline: 'Noite de Luanda. O novo perfume.',
      subheadline: 'Uma fragrância de autor, já à tua espera na Maianga.',
      cta: 'Encomenda pelo WhatsApp',
    },
    setup:
      'Conta de demonstração. Abre o projecto «Perfumes de autor», que já tem a fotografia do perfume anexada, e substitui o pedido por este.',
  },
  {
    id: 'beleza-kianda-fim-de-semana',
    sector: 'Beleza',
    brand: 'Perfumaria Kianda',
    fictitious: true,
    // O pedido do segundo projecto de exemplo (`src/lib/data/seed.ts`).
    request:
      'Promoção de fim de semana nos difusores de ambiente a 7.500 Kz. Mostra que temos entrega em Luanda.',
    image: null,
    width: 1080,
    height: 1350,
    alt: 'Arte de demonstração da Perfumaria Kianda com a promoção de fim de semana nos difusores de ambiente a 7.500 Kz.',
    format: 'vertical',
    style: 'vibrante',
    review: {
      headline: 'Fim de semana perfumado',
      subheadline: 'Difusores de ambiente com entrega em Luanda.',
      cta: 'Encomenda pelo WhatsApp',
      price: '7.500 Kz',
    },
    setup:
      'Conta de demonstração. Abre o projecto «Promoção de fim de semana» (já tem as fotografias do perfume e do difusor anexadas) e muda o formato para 1080 × 1350.',
  },
  {
    id: 'beleza-kianda-entrega',
    sector: 'Beleza',
    brand: 'Perfumaria Kianda',
    fictitious: true,
    request:
      'Fazemos entregas no mesmo dia em toda a Luanda. Quero uma publicação que diga isso, com o WhatsApp para as encomendas.',
    image: null,
    width: 1080,
    height: 1350,
    alt: 'Arte de demonstração da Perfumaria Kianda a anunciar entregas no mesmo dia em Luanda.',
    format: 'vertical',
    style: 'clean',
    review: {
      headline: 'Encomenda hoje. Recebe hoje.',
      subheadline: 'Entregas no mesmo dia em toda a Luanda.',
      cta: 'Encomenda pelo WhatsApp',
    },
    setup:
      'Conta de demonstração, publicação nova na Perfumaria Kianda. Anexa a fotografia do perfume (`src/kianda/perfume.webp`) se quiseres; sem anexo também serve.',
  },

  // --- Outros sectores: empresas fictícias, a criar como empresas novas -----
  {
    id: 'restaurante-mufete',
    sector: 'Restaurante',
    brand: 'Mesa da Ilha',
    fictitious: true,
    request:
      'Quero anunciar o mufete de sexta-feira: peixe grelhado, feijão de óleo de palma, banana-pão e batata-doce, por 8.500 Kz. Aceitamos reservas.',
    image: null,
    width: 1080,
    height: 1350,
    alt: 'Arte de demonstração do restaurante Mesa da Ilha a anunciar o mufete de sexta-feira por 8.500 Kz.',
    format: 'vertical',
    style: 'auto',
    review: {
      headline: 'Sexta-feira é dia de mufete',
      subheadline: 'Peixe grelhado, feijão de óleo de palma, banana-pão e batata-doce.',
      cta: 'Reserva a tua mesa',
      price: '8.500 Kz',
    },
    setup:
      'Empresa nova «Mesa da Ilha» (Restauração), na Ilha de Luanda. Cores sugeridas: #0F4C5C, #F2E6CF, #E0703A. Uma fotografia de um prato ajuda, se tiveres uma com direitos de uso.',
  },
  {
    id: 'moda-samakaka',
    sector: 'Moda',
    brand: 'Casa Welwitschia',
    fictitious: true,
    request:
      'Chegou a nova colecção de vestidos em samakaka. Quero uma publicação elegante, com o endereço da loja em Talatona.',
    image: null,
    width: 1080,
    height: 1350,
    alt: 'Arte de demonstração da boutique Casa Welwitschia a apresentar a nova colecção de vestidos em samakaka.',
    format: 'vertical',
    style: 'elegante',
    review: {
      headline: 'A nova colecção chegou',
      subheadline: 'Vestidos em samakaka, para todas as ocasiões.',
      cta: 'Visita-nos em Talatona',
    },
    setup:
      'Empresa nova «Casa Welwitschia» (Lojas e produtos), em Talatona. Cores sugeridas: #1E3B2F, #EFE7DA, #C8553D. No endereço, só "Talatona, Luanda".',
  },
  {
    id: 'tecnologia-reparacao',
    sector: 'Tecnologia',
    brand: 'Kilamba Tech',
    fictitious: true,
    request:
      'Reparamos telemóveis e portáteis no próprio dia, no Kilamba. Quero uma arte moderna que mostre isso.',
    image: null,
    width: 1080,
    height: 1350,
    alt: 'Arte de demonstração da Kilamba Tech a anunciar reparações de telemóveis e portáteis no próprio dia.',
    format: 'vertical',
    style: 'tecnologico',
    review: {
      headline: 'Reparado no próprio dia',
      subheadline: 'Telemóveis e portáteis, aqui no Kilamba.',
      cta: 'Traz o teu equipamento',
    },
    setup:
      'Empresa nova «Kilamba Tech» (Serviços), no Kilamba. Cores sugeridas: #0B1F3A, #E8EEF5, #2BB673.',
  },
  {
    id: 'formacao-excel',
    sector: 'Formação',
    brand: 'Centro de Formação Horizonte',
    fictitious: true,
    request:
      'Abriram as inscrições para o curso de Excel para empresas, aos sábados de manhã, em Benguela. Quero destacar o certificado no fim do curso.',
    image: null,
    width: 1080,
    height: 1350,
    alt: 'Arte de demonstração do Centro de Formação Horizonte com as inscrições abertas para o curso de Excel para empresas.',
    format: 'vertical',
    style: 'vibrante',
    review: {
      badge: 'Inscrições abertas',
      headline: 'Excel para empresas',
      subheadline: 'Aos sábados de manhã, em Benguela. Com certificado no fim.',
      cta: 'Inscreve-te já',
    },
    setup:
      'Empresa nova «Centro de Formação Horizonte» (Serviços), em Benguela. Cores sugeridas: #23395B, #F4F1EA, #F2A541.',
  },
  {
    id: 'servicos-contabilidade',
    sector: 'Serviços profissionais',
    brand: 'Ndala & Associados',
    fictitious: true,
    request:
      'Somos um escritório de contabilidade em Luanda. Quero divulgar a contabilidade mensal para pequenas empresas, com um estilo sóbrio.',
    image: null,
    width: 1080,
    height: 1350,
    alt: 'Arte de demonstração do escritório Ndala & Associados a divulgar a contabilidade mensal para pequenas empresas.',
    format: 'vertical',
    style: 'clean',
    review: {
      headline: 'As contas da tua empresa em dia',
      subheadline: 'Contabilidade mensal para pequenas empresas.',
      cta: 'Marca uma reunião',
    },
    setup:
      'Empresa nova «Ndala & Associados» (Serviços), em Luanda. Cores sugeridas: #1B2A41, #E9E4DA, #9C7A3C.',
  },
] as const satisfies readonly DemoEntry[];

export type DemoId = (typeof ENTRIES)[number]['id'];

export const DEMOS: readonly DemoEntry[] = ENTRIES;

/**
 * Que arte vai para cada sítio da página.
 *
 * Os identificadores são verificados pelo compilador: um erro de escrita
 * aqui não chega ao browser.
 */
export const DEMO_SELECTION: {
  /**
   * A arte final da demonstração animada (`HeroDemo`). O pedido tem de ser o
   * do guião. A primeira dobra deixou de a usar — mostra as faixas de
   * `heroArts.ts` —; fica para quando a demonstração voltar a outra secção.
   */
  hero: DemoId;
  /** A galeria "pedido → resultado": um sector por cartão. */
  gallery: DemoId[];
  /** Três publicações da MESMA empresa, para mostrar a identidade constante. */
  sameBrand: [DemoId, DemoId, DemoId];
  /** A arte ao lado da última chamada. */
  finalCta: DemoId;
  /** O exemplo completo (pedido → revisão → arte) enquanto não houver clientes reais. */
  walkthrough: DemoId;
} = {
  hero: 'beleza-kianda-lancamento',
  gallery: [
    'restaurante-mufete',
    'moda-samakaka',
    'beleza-kianda-fim-de-semana',
    'tecnologia-reparacao',
    'formacao-excel',
    'servicos-contabilidade',
  ],
  sameBrand: ['beleza-kianda-lancamento', 'beleza-kianda-fim-de-semana', 'beleza-kianda-entrega'],
  finalCta: 'moda-samakaka',
  walkthrough: 'restaurante-mufete',
};

// --- Regras de apresentação --------------------------------------------------

export type DemoMode = 'development' | 'production';

/** Abaixo disto, a galeria e o trio não aparecem em produção. */
const MIN_FOR_SECTION = 3;

const byId = new Map<string, DemoEntry>(DEMOS.map((entry) => [entry.id, entry]));

export function demoById(id: DemoId): DemoEntry {
  const entry = byId.get(id);
  // O tipo `DemoId` garante que existe; isto só protege contra edições à mão
  // que contornem o compilador.
  if (!entry) throw new Error(`Demonstração desconhecida: ${id}`);
  return entry;
}

export function hasImage(entry: DemoEntry): entry is DemoEntry & { image: string } {
  return typeof entry.image === 'string' && entry.image.length > 0;
}

/**
 * Espaço inseparável entre o valor e a moeda: "8.500 Kz" nunca parte em
 * duas linhas. Só para mostrar — o pedido do manifesto fica como o cliente
 * o escreveria.
 */
export function keepTogether(text: string): string {
  return text.replace(/(\d) (Kz)\b/g, '$1\u00A0$2');
}

/** Onde o dono deve pôr o ficheiro de uma entrada. */
export function expectedFile(entry: DemoEntry): string {
  return `public/demonstracoes/${entry.id}.webp`;
}

export type ResolvedDemos = {
  mode: DemoMode;
  /** A arte final do topo. Sem imagem, o lugar mostra o esboço. */
  hero: DemoEntry;
  /** Vazio quando a galeria não deve aparecer. */
  gallery: DemoEntry[];
  /** Vazio quando o trio não deve aparecer; senão, sempre três. */
  sameBrand: DemoEntry[];
  /** `null` quando a última chamada aparece sem arte. */
  finalCta: DemoEntry | null;
  /** O exemplo completo. Sem imagem, o passo da arte mostra o esboço. */
  walkthrough: DemoEntry;
  /** Entradas sem ficheiro, para o aviso de desenvolvimento. */
  missing: DemoEntry[];
};

/**
 * Aplica as regras de apresentação ao manifesto.
 *
 * Função pura, com o modo passado por fora: assim a pré-visualização de
 * produção (`/?vista=producao`) usa exactamente as mesmas regras.
 */
export function resolveDemos(mode: DemoMode): ResolvedDemos {
  const dev = mode === 'development';

  const galleryAll = DEMO_SELECTION.gallery.map(demoById);
  const galleryReady = galleryAll.filter(hasImage);
  const gallery = dev ? galleryAll : galleryReady.length >= MIN_FOR_SECTION ? galleryReady : [];

  const trio = DEMO_SELECTION.sameBrand.map(demoById);
  const trioReady = trio.filter(hasImage).length >= MIN_FOR_SECTION;
  const sameBrand = dev || trioReady ? trio : [];

  const final = demoById(DEMO_SELECTION.finalCta);

  return {
    mode,
    hero: demoById(DEMO_SELECTION.hero),
    gallery,
    sameBrand,
    finalCta: dev || hasImage(final) ? final : null,
    walkthrough: demoById(DEMO_SELECTION.walkthrough),
    missing: DEMOS.filter((entry) => !hasImage(entry)),
  };
}
