import { NextResponse } from 'next/server';
import { z } from 'zod';
import { extractJsonObject, resolveTextProvider } from '@/lib/ai/providers/text';
import { SEGMENTS } from '@/lib/domain/catalog';
import { detectPrices, formatKz } from '@/lib/utils/money';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Melhorar o pedido escrito pelo cliente.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Transforma uma nota apressada num briefing claro, até 500 caracteres.
 *
 * O que esta rota NÃO faz é mais importante do que o que faz: não acrescenta
 * informação. Reescrever "vende giftcards" como "a líder do mercado angolano
 * de entretenimento digital" seria inventar uma posição de mercado que a
 * empresa não afirmou — e o pedido melhorado passa a ser a base de tudo o
 * que vem depois, incluindo os textos que vão impressos na arte.
 *
 * Organiza, clarifica e completa a frase. Não promove.
 * ──────────────────────────────────────────────────────────────────────────
 */

const requestSchema = z.object({
  brief: z.string().min(3).max(1200),
  company: z.object({
    name: z.string().max(120).default(''),
    segment: z
      .enum(['restaurantes', 'beleza', 'lojas', 'servicos', 'outro'])
      .default('outro'),
    description: z.string().max(600).default(''),
  }),
});

/** O limite pedido pelo cliente. É também o limite do campo na interface. */
const LIMIT = 500;

/**
 * Orçamento de caracteres, proporcional ao que o cliente escreveu.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Isto é um MECANISMO, não um pedido. Entrou depois de duas tentativas de
 * resolver o problema no prompt, ambas falhadas.
 *
 * O pedido "mufete ao domingo" — dezassete caracteres — devolvia 427, com
 * "experiência gastronómica única", "pratos frescos e saborosos" e "local de
 * referência para refeições de peixe". Nenhuma dessas afirmações existia no
 * pedido. O modelo não estava a desobedecer a uma regra: estava a preencher
 * um espaço que lhe demos.
 *
 * A aritmética fecha a porta que a instrução não fechava. Dezassete
 * caracteres de informação não dão quatrocentos de briefing honesto, e com
 * o tecto a 120 o modelo tem de escolher o que é essencial em vez de
 * inventar o que falta.
 *
 * O triplo é generoso: organizar um pedido acrescenta estrutura — "anunciar
 * que", "o objectivo é" — e isso ocupa espaço legítimo.
 * ──────────────────────────────────────────────────────────────────────────
 */
function budgetFor(original: string): number {
  return Math.min(LIMIT, Math.max(120, Math.round(original.length * 3)));
}

const responseSchema = z.object({
  brief: z.string().min(10).max(900),
  /** O que foi acrescentado de estrutura, para o cliente perceber a mudança. */
  changes: z.array(z.string().max(120)).max(4).default([]),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Escreve primeiro o que queres comunicar.' },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const provider = resolveTextProvider();

  if (!provider) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Não há fornecedor de texto configurado. Esta melhoria é feita por IA e não tem alternativa local.',
      },
      { status: 503 },
    );
  }

  const budget = budgetFor(input.brief.trim());

  try {
    const raw = await provider.generateJson({
      system: SYSTEM,
      user: buildUserPrompt(input, budget),
    });

    const validated = responseSchema.safeParse(extractJsonObject(raw));
    if (!validated.success) {
      throw new Error('a resposta não seguiu o formato esperado');
    }

    /*
      O orçamento é aplicado aqui, não confiado ao modelo.

      Pedir um limite num prompt é uma sugestão; aplicá-lo é uma garantia. O
      corte é no último espaço, para não partir palavras.
    */
    const trimmed = clampToLimit(validated.data.brief.trim(), budget);

    return NextResponse.json({
      ok: true,
      brief: trimmed,
      changes: validated.data.changes,
      provider: `${provider.id}:${provider.model}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? `Não conseguimos melhorar o pedido (${error.message}). O teu texto ficou como estava.`
            : 'Não conseguimos melhorar o pedido. O teu texto ficou como estava.',
      },
      { status: 502 },
    );
  }
}

/** Corta no último espaço antes do limite, para não partir palavras. */
function clampToLimit(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

const SYSTEM = [
  'És um director criativo que recebe pedidos de clientes em Angola e os organiza para a equipa de produção.',
  'Respondes SEMPRE em português europeu, com vocabulário usado em Angola (ficheiro, telemóvel, descarregar, guardar).',
  'Tratas o leitor por TU. Não usas pontos de exclamação.',
  'Devolves EXCLUSIVAMENTE um objecto JSON válido, sem texto antes ou depois, sem blocos de código.',
  '',
  'A TUA TAREFA',
  'Reescreves o pedido do cliente num briefing claro, dentro do espaço indicado no fim da mensagem.',
  '',
  'O QUE PODES FAZER',
  '· Organizar as ideias por ordem: o que se anuncia, para quem, com que mensagem, que acção se pede.',
  '· Corrigir ortografia, acentuação e pontuação.',
  '· Escrever nomes de marcas e produtos com a grafia correcta.',
  '· Tornar explícito o que estava implícito no próprio pedido.',
  '· Nomear o objectivo quando ele se percebe — anunciar, promover, informar, convidar.',
  '',
  'O QUE NÃO PODES FAZER — e é o mais importante',
  '· NÃO inventes preços, descontos, percentagens, prazos, datas, horários nem condições.',
  '· NÃO inventes contactos, endereços, redes sociais nem sítios na internet.',
  '· NÃO inventes características de produtos, ingredientes, garantias nem especificações.',
  '· NÃO inventes posição de mercado: nada de "líder", "a melhor", "a maior", "referência no sector", "premiada".',
  '· NÃO acrescentes produtos ou serviços que o cliente não mencionou.',
  '· NÃO escrevas linguagem de publicidade: sem "imperdível", "única", "exclusiva", "aproveita já".',
  /*
    Público-alvo e ambiente são invenção, e eram a brecha que restava.

    De "mufete ao domingo" saía um briefing com "amantes da gastronomia
    local" e "num ambiente acolhedor" — duas afirmações sobre o negócio de
    alguém, tiradas de três palavras. Nenhuma é perigosa como um preço
    errado, mas o briefing é a base dos textos que vão impressos na arte.
  */
  '· NÃO inventes o público-alvo. Só o descreves se o cliente o tiver indicado.',
  '· NÃO descrevas o ambiente, o espaço nem o atendimento da empresa: não os conheces.',
  '',
  'Se o pedido tiver pouca informação, o briefing FICA CURTO. Três palavras podem dar um briefing de uma linha, e isso está certo. Um briefing curto e verdadeiro vale mais do que um briefing cheio e inventado — nunca escrevas para preencher espaço.',
  '',
  'Em "changes" escreves no máximo 4 notas curtas sobre o que organizaste, para o cliente perceber o que mudou. Exemplos: "objectivo tornado explícito", "produtos listados por ordem", "ortografia das marcas corrigida".',
  '',
  'Formato da resposta:',
  '{ "brief": "o pedido reescrito", "changes": ["string"] }',
].join('\n');

function buildUserPrompt(input: z.infer<typeof requestSchema>, budget: number): string {
  const segment =
    SEGMENTS.find((entry) => entry.id === input.company.segment)?.label ??
    input.company.segment;

  const prices = detectPrices(input.brief);

  const lines = [
    '## Pedido do cliente, tal como ele o escreveu',
    input.brief.trim(),
    '',
    '## A empresa',
    `Nome: ${input.company.name || '(não indicado)'}`,
    `Actividade: ${segment}`,
    `Descrição: ${input.company.description || '(não indicada)'}`,
    '',
  ];

  /*
    Os preços que existem no pedido vão identificados.

    Sem isto, o modelo reescrevia "15.000 Kz" como "a partir de 15.000 Kz" ou
    "apenas 15.000 Kz" — duas afirmações comerciais que o cliente não fez.
  */
  if (prices.length > 0) {
    lines.push('## Valores que o cliente escreveu');
    for (const price of prices) lines.push(`- ${formatKz(price.value)}`);
    lines.push(
      'Mantém estes valores exactamente como estão. Não lhes acrescentes "a partir de", "apenas", "só" nem qualquer outra qualificação.',
      '',
    );
  } else {
    lines.push(
      '## Valores',
      'O cliente não indicou preços. O briefing não pode conter nenhum.',
      '',
    );
  }

  /*
    O orçamento vai no prompt E é aplicado no código.

    No prompt para o modelo escrever À MEDIDA, com uma frase completa; no
    código porque um limite pedido é uma sugestão. Sem o aviso, o texto era
    cortado a meio de uma ideia.
  */
  lines.push(
    `## Espaço disponível`,
    `O briefing tem de caber em ${budget} caracteres. Este número é proporcional ao que o cliente escreveu: ele deu ${input.brief.trim().length} caracteres de informação, e não há mais do que isso para organizar.`,
    'Escreve dentro do espaço. Não o preenchas: se a informação acabar antes, acaba o briefing.',
  );

  return lines.join('\n');
}
