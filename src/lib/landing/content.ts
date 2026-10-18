/**
 * Conteúdo da página pública que não é texto corrido das secções.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Três coisas vivem aqui por serem dados e não composição:
 *
 *  · a marca fictícia das demonstrações animadas (a Perfumaria Kianda, a
 *    mesma da conta de demonstração);
 *  · os testemunhos — VAZIOS até haver clientes reais que autorizem;
 *  · as perguntas frequentes, montadas a partir do catálogo e da
 *    configuração dos planos para nunca dizerem outra coisa que não o que o
 *    sistema faz.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { PLAN_RULES, PLANS } from '@/config/plans';
import { FORMATS } from '@/lib/domain/catalog';
import { DEMO_SELECTION, demoById } from './demos';

// --- Marca fictícia das demonstrações ---------------------------------------

/**
 * A Perfumaria Kianda, tal como a conta de demonstração a cria.
 *
 * As cores, o nome e os contactos são os de `src/lib/data/seed.ts`; estão
 * repetidos aqui porque a sementeira não os exporta. O logótipo e as
 * fotografias dos produtos são os mesmos nos dois sítios: os ficheiros de
 * `src/kianda/`, em `src/lib/landing/kianda.ts`. Se a sementeira mudar,
 * muda isto também.
 */
export const DEMO_BRAND = {
  name: 'Perfumaria Kianda',
  colors: { primary: '#152A4A', secondary: '#E7DCC8', accent: '#C98A3C' },
  fonts: { display: 'Playfair Display', body: 'Inter' },
  contacts: { whatsapp: '+244 923 000 000', instagram: '@kianda.ao', website: 'www.kianda.ao' },
  /**
   * Os dois produtos da sementeira. `bottle` é a forma do protagonista na
   * planta da revisão: o perfume é alto, o difusor é largo.
   */
  products: [
    { id: 'perfume', name: 'Noite de Luanda · 50 ml', bottle: 'alto' },
    { id: 'difusor', name: 'Difusor de ambiente', bottle: 'largo' },
  ],
} as const;

export type DemoProductId = (typeof DEMO_BRAND.products)[number]['id'];

/**
 * O guião da demonstração do topo.
 *
 * O pedido e os textos finais vêm da entrada do manifesto que dá a arte
 * final (`DEMO_SELECTION.hero`): a arte que o dono gerar tem de dizer o que a
 * animação mostrou. O título "proposto" é o que a animação mostra antes de o
 * visitante o ver ser editado.
 */
const heroEntry = demoById(DEMO_SELECTION.hero);

export const HERO_SCRIPT = {
  request: heroEntry.request,
  idea: 'O frasco em primeiro plano, sobre seda azul-marinho, com luz quente de fim de tarde.',
  proposedHeadline: 'Chegou o novo perfume Kianda',
  headline: heroEntry.review.headline,
  subheadline: heroEntry.review.subheadline ?? '',
  cta: heroEntry.review.cta ?? '',
} as const;

// --- Testemunhos --------------------------------------------------------------

/**
 * Testemunhos de clientes REAIS.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Vazio de propósito. Com a lista vazia, a secção "Prova social" é
 * substituída por uma demonstração completa de uma marca fictícia, e diz que
 * é uma demonstração. Nunca acrescentes testemunhos inventados, números de
 * clientes nem logótipos de empresas que não autorizaram por escrito.
 *
 * Cada testemunho leva o nome e a empresa como a pessoa autorizou, a frase
 * dela sem retoques de sentido, e as artes que essa empresa fez na Kriar
 * (ficheiros em `public/`, com as medidas reais).
 * ──────────────────────────────────────────────────────────────────────────
 */
export type Testimonial = {
  name: string;
  /** Cargo ou função, opcional. */
  role?: string;
  company: string;
  quote: string;
  arts: Array<{ image: string; width: number; height: number; alt: string }>;
};

export const TESTIMONIALS: Testimonial[] = [];

// --- Perguntas frequentes -----------------------------------------------------

export type FaqItem = {
  id: string;
  question: string;
  /** Parágrafos da resposta. */
  answer: string[];
  /** Lista opcional depois dos parágrafos. */
  list?: string[];
};

/** "Instagram e Facebook · 1080 × 1350", pela ordem do catálogo. */
export function formatLines(): string[] {
  return FORMATS.map((format) => `${format.platform} · ${format.hint}`);
}

function plansAnswer(): string[] {
  if (PLANS.length === 0) {
    return [
      'Os planos ainda estão a ser fechados. Cada plano vai dizer quantas gerações inclui e o que acontece quando chegas ao limite.',
    ];
  }
  const lines = PLANS.map((plan) =>
    plan.generations === null
      ? `${plan.name}: o número de gerações ainda está por definir.`
      : `${plan.name}: ${plan.generations} ${plan.generations === 1 ? 'geração' : 'gerações'} por ${plan.period}.`,
  );
  return [...lines, PLAN_RULES.limitReached, PLAN_RULES.retries].filter(
    (line): line is string => Boolean(line),
  );
}

/**
 * As perguntas, com respostas que correspondem ao que o sistema entrega.
 *
 * Antes de mudar uma resposta, confirma no produto: cada frase aqui é uma
 * promessa feita a quem ainda não é cliente.
 */
export function buildFaq(): FaqItem[] {
  const items: FaqItem[] = [
    {
      id: 'design',
      question: 'Preciso de saber design?',
      answer: [
        'Não. Escreves o que queres comunicar, como escreverias a um designer. A Kriar propõe a ideia, os textos e a disposição; tu revês e confirmas antes de gerar.',
      ],
    },
    {
      id: 'marca',
      question: 'Posso usar o meu logótipo e as minhas cores?',
      answer: [
        'Sim. Guardas o logótipo e as cores uma vez, na área Marca, e todas as publicações novas usam-nos. Depois de cada geração verificamos se o logótipo saiu fiel e inteiro; se não saiu, a Kriar corrige uma vez antes de te mostrar a arte.',
      ],
    },
    {
      id: 'produtos',
      question: 'A Kriar consegue utilizar fotografias dos meus produtos?',
      answer: [
        'Sim. Anexas as fotografias ao pedido e a IA coloca o produto na cena, com a forma e as cores dele. Como a arte é criada de novo, confirma o resultado antes de publicar: rótulos com muito texto pequeno podem não sair iguais.',
      ],
    },
    {
      id: 'textos',
      question: 'Posso alterar os textos antes de gerar?',
      answer: [
        'Sim. Na revisão alteras o título, o texto de apoio, a chamada para acção e o preço, escolhes os produtos e dizes onde ficam o logótipo e os contactos. Nada é gerado até confirmares.',
        'Depois de gerada, a arte é uma imagem: para mudar um texto, editas essa zona ou geras outra vez.',
      ],
    },
    {
      id: 'resultado',
      question: 'E se não gostar do resultado?',
      answer: [
        'Voltas à revisão, pedes outra ideia ou ajustas a proposta, e geras outra vez. Também podes editar só uma zona da arte. As versões anteriores ficam guardadas e podes repor qualquer uma.',
      ],
    },
    {
      id: 'quantas',
      question: 'Quantas artes consigo criar com o meu plano?',
      answer: plansAnswer(),
    },
    {
      id: 'formatos',
      question: 'Em que formatos posso descarregar?',
      answer: ['Em PNG, nas medidas de cada rede:'],
      list: formatLines(),
    },
  ];

  // Só quando o pagamento estiver definido: uma pergunta sem resposta
  // verdadeira não entra.
  if (PLAN_RULES.payment) {
    items.push({
      id: 'pagamento',
      question: 'Como posso pagar?',
      answer: [PLAN_RULES.payment, PLAN_RULES.contact].filter(
        (line): line is string => Boolean(line),
      ),
    });
  }

  return items;
}
