import { NextResponse } from 'next/server';
import { z } from 'zod';
import { extractJsonObject, resolveIdentityProvider } from '@/lib/ai/providers/text';
import { prepareLogoReference } from '@/lib/server/logoReference';
import { readLogo } from '@/lib/server/logoReading';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Verificação de qualidade de uma arte gerada.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Instruções reduzem a probabilidade de um defeito; não o eliminam. Dizer
 * três vezes ao gerador que o logótipo é uma cópia fiel não impediu que
 * saísse espelhado. O que falta é OLHAR para o resultado antes de o mostrar
 * — que é o que um director de arte faz.
 *
 * Esta rota faz isso com um modelo de visão: recebe o logótipo original e a
 * arte, e responde a perguntas fechadas sobre defeitos concretos. A decisão
 * de repetir NÃO é do modelo: é calculada aqui, a partir das respostas, para
 * ser previsível e para o custo de uma repetição nunca depender de um juízo
 * vago como "parece pouco profissional".
 *
 * O modelo é instruído a não inventar defeitos. Um verificador que reprova
 * artes boas custa uma geração inteira por cada falso alarme.
 * ──────────────────────────────────────────────────────────────────────────
 */

const requestSchema = z.object({
  /** A arte gerada, reduzida pelo cliente. */
  art: z.string().max(6_000_000),
  /** O logótipo que foi enviado ao gerador. `null` quando a arte não o leva. */
  logo: z.string().max(8_000_000).nullable().default(null),
  expected: z.object({
    headline: z.string().max(160).default(''),
    texts: z.array(z.string().max(240)).max(8).default([]),
    // Há sete canais de contacto: com seis, uma publicação com todos
    // ligados fazia a verificação responder 400.
    contacts: z.array(z.string().max(160)).max(8).default([]),
  }),
  /**
   * A arte de outra empresa que o cliente pediu para recriar, quando há.
   *
   * O verificador compara para responder a uma pergunta só: a arte nova
   * copiou o que não podia — o logótipo, o nome, as pessoas, as fotografias?
   */
  recreate: z.string().max(6_000_000).nullable().default(null),
  /** Os preços que a arte pode mostrar. Qualquer outro é invenção. */
  prices: z.array(z.string().max(40)).max(4).default([]),
  /**
   * `true` quando a arte NÃO leva botão — o cliente retirou a chamada para
   * acção. Um botão desenhado é um defeito que justifica a correcção.
   */
  noCta: z.boolean().default(false),
  /** `true` quando o gerador recebeu o esboço: procura-se o que dele passou. */
  sketch: z.boolean().default(false),
  /**
   * O que mostravam os exemplos de acabamento desta geração, em palavras.
   *
   * O verificador não vê as referências; com a descrição delas responde a
   * uma pergunta só: a arte repetiu a cena de alguma?
   */
  examples: z
    .array(z.string())
    .max(3)
    .default([])
    .transform((list) => list.map((entry) => entry.slice(0, 300)).filter(Boolean)),
  /**
   * Presente quando a arte é o resultado de uma EDIÇÃO por zonas.
   *
   * A pergunta muda: já não é "esta arte está bem?", é "o pedido foi feito,
   * e nada do que estava bem ficou pior?". Para isso o verificador precisa
   * da arte de antes.
   */
  edit: z
    .object({
      before: z.string().max(8_000_000),
      zones: z
        .array(
          z.object({
            number: z.number().int().min(1).max(8),
            request: z.string().max(400),
            position: z.string().max(160).default(''),
          }),
        )
        .min(1)
        .max(6),
      /** Zonas que os píxeis dizem que ficaram iguais. É um facto, não uma opinião. */
      unchanged: z.array(z.number().int().min(1).max(8)).max(6).default([]),
    })
    .optional(),
});

/*
  Notas APARADAS, nunca rejeitadas.

  Com `max()` nas notas, uma explicação um pouco mais longa chumbava a
  resposta inteira — e uma verificação que falha deixa passar a arte sem
  ser verificada, em silêncio. O que decide são os booleanos; o texto livre
  é só contexto, e corta-se no fim de uma palavra.
*/
const note = (max: number) =>
  z
    .string()
    .default('')
    .transform((value) => {
      const flat = value.replace(/\s+/g, ' ').trim();
      if (flat.length <= max) return flat;
      const cut = flat.slice(0, max);
      const word = cut.lastIndexOf(' ');
      return `${(word > 0 ? cut.slice(0, word) : cut).trim()}…`;
    });

/**
 * Uma percentagem estimada pelo modelo: 3, "3%" e "3,5" lêem-se. O que não
 * se lê fica `null` e não pesa na decisão — na dúvida, não se marca.
 */
const percent = z
  .preprocess(
    (value) => (typeof value === 'string' ? Number.parseFloat(value.replace(',', '.')) : value),
    z.number().min(0).max(100).nullable(),
  )
  .catch(null);

const answerSchema = z.object({
  logo: z
    .object({
      present: z.boolean().default(true),
      faithful: z.boolean().default(true),
      mirrored: z.boolean().default(false),
      misspelled: z.boolean().default(false),
      cutOff: z.boolean().default(false),
      overlapsText: z.boolean().default(false),
      extraText: z.boolean().default(false),
      /** Inteiro, mas encostado: menos espaço até à aresta do que a altura dele. */
      tight: z.boolean().default(false),
      /*
        A medida, além do juízo. Numa arte real o logótipo tocava na aresta
        de baixo e o verificador respondeu "cutOff": false e "tight": false.
        Um número estimado é mais difícil de responder por omissão.
      */
      edgeGap: percent,
      /*
        A largura do logótipo, em % da largura da publicação. "Em muitas
        artes o logótipo fica muito grande": o esboço pede 8 a 18%, e sem
        medida ninguém conferia.
      */
      widthShare: percent,
      // 160 e não mais: a nota entra numa frase que segue para o prompt da
      // correcção, e esse campo tem limite (`correction` no esquema da arte).
      note: note(160),
    })
    .default({}),
  /** Um botão ou uma chamada para acção, numa arte que não os leva. */
  button: z
    .object({
      present: z.boolean().default(false),
      note: note(160),
    })
    .default({}),
  edges: z
    .object({
      cutOff: z.boolean().default(false),
      /** Do texto ou logótipo mais alto à aresta de cima, em % da altura. */
      topGap: percent,
      /** Do texto ou logótipo mais baixo à aresta de baixo, em % da altura. */
      bottomGap: percent,
      note: note(160),
    })
    .default({}),
  texts: z
    .object({
      headlineCorrect: z.boolean().default(true),
      /** O título tal como se lê na arte. Decide o "exacto" sem o modelo. */
      headlineSeen: note(200).catch(''),
      problems: z
        .array(note(200))
        .default([])
        .transform((problems) => problems.filter(Boolean).slice(0, 6)),
    })
    .default({}),
  /*
    Um a um, pela ordem pedida.

    Os contactos iam juntos com os outros textos, como "problemas menores"
    que não justificavam corrigir. Uma arte de subscrições sem o website
    onde se compram não é um problema menor.
  */
  contacts: z
    .array(
      z.object({
        index: z.coerce.number().int(),
        present: z.boolean().default(true),
        exact: z.boolean().default(true),
        legible: z.boolean().default(true),
        note: note(140),
      }),
    )
    .default([]),
  recreate: z
    .object({
      copied: z.boolean().default(false),
      note: note(160),
    })
    .default({}),
  /*
    Preços inventados — o "USD 20 / mês" num ecrã de telemóvel que ninguém
    pediu. Um preço errado numa publicidade é o defeito mais caro de todos:
    é uma promessa que a empresa não fez.
  */
  prices: z
    .object({
      invented: z.boolean().default(false),
      note: note(160),
    })
    .default({}),
  sketch: z
    .object({
      visible: z.boolean().default(false),
      note: note(160),
    })
    .default({}),
  /** Texto que ninguém pediu — no layout ou em objectos da cena. */
  scene: z
    .object({
      extraText: z.boolean().default(false),
      note: note(160),
    })
    .default({}),
  /** A arte repetiu a cena de um exemplo de acabamento. */
  examples: z
    .object({
      copied: z.boolean().default(false),
      note: note(160),
    })
    .default({}),
});

export type ArtReview = {
  /** `true` quando há um defeito que justifica gerar outra vez. */
  retry: boolean;
  /** Defeitos encontrados, em frases para o gerador e para o cliente. */
  issues: string[];
  /** Gravidade total. Menor é melhor; serve para escolher entre tentativas. */
  score: number;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Pedido inválido.' }, { status: 400 });
  }

  const input = parsed.data;
  const provider = resolveIdentityProvider();
  if (!provider?.supportsImages) {
    // Sem visão não há verificação. Não é erro: a arte segue como saiu.
    return NextResponse.json({ ok: false, error: 'Sem modelo de visão configurado.' }, { status: 503 });
  }

  if (input.edit) {
    return reviewEdit(provider, input.art, input.edit);
  }

  // O mesmo logótipo preparado que o gerador recebeu: comparar contra o
  // ficheiro cru, com fundo transparente, era comparar contra outra imagem.
  const prepared = input.logo ? await prepareLogoReference(input.logo) : null;
  const reading = prepared ? await readLogo(prepared) : null;

  const images = [
    ...(prepared ? [prepared.dataUrl] : []),
    input.art,
    ...(input.recreate ? [input.recreate] : []),
  ];

  try {
    const raw = await provider.generateJson({
      system: SYSTEM,
      user: buildUserPrompt({
        hasLogo: Boolean(prepared),
        hasRecreate: Boolean(input.recreate),
        prices: input.prices,
        noCta: input.noCta,
        sketch: input.sketch,
        examples: input.examples,
        logoText: reading?.text ?? '',
        logoSymbols: reading?.symbols ?? '',
        headline: input.expected.headline,
        texts: input.expected.texts,
        contacts: input.expected.contacts,
      }),
      images,
      temperature: 0,
    });

    const answer = answerSchema.safeParse(extractJsonObject(raw));
    if (!answer.success) throw new Error('resposta fora do formato');

    return NextResponse.json({
      ok: true,
      // Diagnóstico: as medidas estimadas, para calibrar os limiares.
      measures: {
        logoGap: answer.data.logo.edgeGap,
        logoWidth: answer.data.logo.widthShare,
        topGap: answer.data.edges.topGap,
        bottomGap: answer.data.edges.bottomGap,
      },
      review: decide(answer.data, {
        expectLogo: Boolean(prepared),
        headline: input.expected.headline,
        texts: input.expected.texts,
        contacts: input.expected.contacts,
        recreate: Boolean(input.recreate),
        sketch: input.sketch,
        examples: input.examples.length > 0,
        noCta: input.noCta,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'A verificação falhou.',
      },
      { status: 502 },
    );
  }
}

/**
 * A decisão, calculada e não pedida.
 *
 * Cada defeito vira uma frase que serve dois leitores: o gerador, na
 * tentativa de correcção, e o cliente, se o defeito persistir. Por isso são
 * frases concretas sobre o que está mal, não juízos.
 */
function decide(
  answer: z.infer<typeof answerSchema>,
  expected: {
    expectLogo: boolean;
    headline: string;
    texts: string[];
    contacts: string[];
    recreate: boolean;
    sketch: boolean;
    /** A geração levou exemplos de acabamento descritos ao verificador. */
    examples: boolean;
    /** A arte não leva botão. */
    noCta: boolean;
  },
): ArtReview {
  const issues: string[] = [];
  /** Defeitos que se dizem ao cliente mas que, sozinhos, não pagam outra geração. */
  const minor: string[] = [];
  let score = 0;
  const expectLogo = expected.expectLogo;

  if (expectLogo) {
    const logo = answer.logo;
    if (!logo.present) {
      issues.push('O logótipo não aparece na arte. Tem de estar presente, inteiro e legível.');
      score += 3;
    } else {
      if (logo.mirrored) {
        issues.push('O logótipo saiu espelhado. Tem de se ler na mesma direcção do ficheiro original.');
        score += 3;
      }
      if (logo.misspelled) {
        issues.push('As letras do logótipo saíram trocadas, a mais ou a menos. Tem de ter exactamente as letras do original, pela mesma ordem.');
        score += 3;
      }
      if (!logo.faithful && !logo.mirrored && !logo.misspelled) {
        issues.push(
          `O logótipo saiu redesenhado, diferente do ficheiro original${logo.note ? ` (${logo.note})` : ''}. Tem de ser uma cópia exacta.`,
        );
        score += 3;
      }
      /*
        O juízo do modelo OU a medida dele. Limiares largos de propósito — a
        medida é uma estimativa: menos de meio por cento é tocar; menos de 3%
        da largura (32 px numa arte de 1080) é encostado. O esboço pede 8%.
      */
      const gap = logo.edgeGap;
      if (logo.cutOff || (gap !== null && gap < 0.5)) {
        issues.push(
          'O logótipo ficou cortado ou encostado à aresta. Tem de ficar inteiro, no sítio e à distância das arestas que o esboço mostra.',
        );
        score += 2;
      } else if (logo.tight || (gap !== null && gap < 3)) {
        issues.push(
          `O logótipo ficou demasiado perto da aresta${gap !== null ? ` (cerca de ${Math.round(gap * 10) / 10}% da largura)` : ''}. Entre ele e a aresta mais próxima tem de ficar um espaço maior do que a altura do próprio logótipo, como no esboço.`,
        );
        score += 2;
      }
      if (logo.overlapsText) {
        issues.push('O logótipo ficou por cima de texto. Tem de assentar numa zona livre.');
        score += 2;
      }
      if (logo.extraText) {
        issues.push('Foi escrito texto junto ao logótipo que não faz parte dele. O logótipo vai sozinho.');
        score += 2;
      }
      /*
        O tamanho. O esboço pede 8 a 18% da largura conforme o tamanho
        escolhido; acima de 28% o logótipo já disputa a arte com o título e
        paga a correcção. Entre 20 e 28% diz-se ao cliente, sem gerar outra.
      */
      const width = logo.widthShare;
      if (width !== null && width > 28) {
        issues.push(
          `O logótipo ficou demasiado grande (cerca de ${Math.round(width)}% da largura). É uma assinatura: tem de ficar com o tamanho do esboço, bem mais pequeno do que o título.`,
        );
        score += 2;
      } else if (width !== null && width > 20) {
        minor.push(
          `O logótipo ficou grande (cerca de ${Math.round(width)}% da largura). O tamanho pedido era o do esboço, mais discreto.`,
        );
      }
    }
  }

  /*
    Um botão numa arte que não o leva. O cliente retirou a chamada para
    acção e a arte saiu com uma — "pedi para remover o CTA e ela gerou com
    CTA". Grave: é um pedido explícito do cliente que não foi cumprido.
  */
  if (expected.noCta && answer.button.present) {
    issues.push(
      `A arte tem um botão ou uma chamada para acção que não foi pedida${answer.button.note ? ` (${answer.button.note})` : ''}. Esta arte não leva botão: tira-o e deixa o resto como está.`,
    );
    score += 2;
  }

  const { topGap, bottomGap } = answer.edges;
  if (answer.edges.cutOff || (bottomGap !== null && bottomGap < 0.5) || (topGap !== null && topGap < 0.5)) {
    issues.push(
      `Há conteúdo cortado pela aresta da imagem${answer.edges.note ? ` (${answer.edges.note})` : ''}. Tudo tem de caber dentro da margem.`,
    );
    score += 2;
  } else if ((bottomGap !== null && bottomGap < 2.5) || (topGap !== null && topGap < 2.5)) {
    /*
      Encostado sem estar cortado: diz-se ao cliente, mas sozinho não paga
      outra geração — é o defeito em que o gerador menos obedece, e repetir
      às cegas dobrava o custo de quase todas as artes.
    */
    const where = bottomGap !== null && bottomGap < 2.5 ? 'de baixo' : 'de cima';
    minor.push(
      `O texto ficou encostado à aresta ${where}. Entre a última linha e a aresta tem de ficar a margem do esboço.`,
    );
  }

  if (answer.scene.extraText) {
    minor.push(
      `Há texto na arte que não foi pedido${answer.scene.note ? ` (${answer.scene.note})` : ''}. A arte só leva os textos da revisão e os contactos; os objectos da cena ficam lisos.`,
    );
  }

  if (expected.examples && answer.examples.copied) {
    minor.push(
      `A arte repete a cena de um exemplo de acabamento${answer.examples.note ? ` (${answer.examples.note})` : ''}. O exemplo serve para o acabamento, não para o conteúdo.`,
    );
  }

  /*
    O título decide-se pela transcrição, não pelo "sim" ou "não" do modelo.
    Numa arte real o verificador reprovou «Perfumaria Kianda» por não ser
    «Perfumaria KIANDA», a correcção mudou-o para maiúsculas, e a segunda
    verificação reprovou-o ao contrário. Maiúsculas não contam: uma agência
    compõe títulos em caixa alta sem mudar uma letra.
  */
  const seen = answer.texts.headlineSeen;
  const headlineMatches = Boolean(seen) && sameText(seen, expected.headline);
  if (!answer.texts.headlineCorrect && !headlineMatches) {
    const detailed = `O título não saiu exactamente como foi pedido: lê-se «${seen}». Tem de ser «${expected.headline}».`;
    // Cada frase segue para `correction`, que recusa mais de 400 caracteres.
    issues.push(
      seen && detailed.length <= 380
        ? detailed
        : 'O título não saiu exactamente como foi pedido. Tem de ter as palavras exactas.',
    );
    score += 2;
  }

  /*
    Contactos: um defeito em qualquer um justifica a correcção.

    O modelo numera a partir de 1 e pode saltar algum; um contacto sem
    resposta conta como certo — na dúvida, não se marca.
  */
  for (const entry of answer.contacts) {
    const value = expected.contacts[entry.index - 1];
    if (!value) continue;
    const why = entry.note ? ` (${entry.note})` : '';
    if (!entry.present) {
      issues.push(
        `O contacto «${value}» não aparece na arte. Tem de estar escrito por inteiro, legível, acima da margem de baixo.`,
      );
      score += 2;
    } else if (!entry.exact) {
      issues.push(
        `O contacto «${value}» saiu com erros${why}. Tem de ter exactamente estes caracteres.`,
      );
      score += 2;
    } else if (!entry.legible) {
      issues.push(
        `O contacto «${value}» não se lê bem${why}. Tem de ficar inteiro, maior e com contraste, acima da margem de baixo e longe da aresta.`,
      );
      score += 2;
    }
  }

  if (answer.prices.invented) {
    issues.push(
      `A arte mostra um preço ou uma moeda que não foram pedidos${answer.prices.note ? ` (${answer.prices.note})` : ''}. Tira-o: nenhum valor além do da lista de texto, nem dentro de um ecrã.`,
    );
    score += 3;
  }

  if (expected.sketch && answer.sketch.visible) {
    issues.push(
      `Passaram para a arte restos do esboço${answer.sketch.note ? ` (${answer.sketch.note})` : ''}. O esboço só diz onde fica cada coisa: a arte não leva caixas cinzentas, barras nem cruzes.`,
    );
    score += 3;
  }

  if (expected.recreate && answer.recreate.copied) {
    issues.push(
      `A arte copiou da arte original o que não podia${answer.recreate.note ? ` (${answer.recreate.note})` : ''}. Mantém a estrutura, mas com logótipo, nome, pessoas, fotografias e textos desta empresa, todos novos.`,
    );
    score += 3;
  }

  // Até aqui, tudo o que foi somado é grave: logótipo, aresta, título,
  // contactos e cópia da arte de outra empresa.
  const retry = score > 0;

  // Problemas menores de texto são reportados ao cliente, mas sozinhos não
  // justificam pagar outra geração.
  const wanted = [expected.headline, ...expected.texts].filter(Boolean);
  for (const problem of [
    ...minor,
    ...answer.texts.problems.filter((entry) => isDefect(entry, wanted)).slice(0, 3),
  ]) {
    issues.push(problem);
    score += 1;
  }

  return { retry, issues, score };
}

/** Iguais para um leitor: sem contar maiúsculas, espaços nem o tipo de aspas. */
function sameText(a: string, b: string): boolean {
  const flat = (value: string) =>
    value
      .toLocaleLowerCase('pt-PT')
      .replace(/[«»"“”'‘’]/g, '')
      .replace(/[‐-―]/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/[\s.!…]+$/, '')
      .trim();
  return flat(a) === flat(b);
}

/*
  O que o modelo escreveu em "problems" que não é defeito nenhum. Visto
  numa verificação real, como dois "problemas" mostrados ao cliente: «está
  "Entrega no mesmo dia" sem diferenças relevantes» e «os restantes textos
  pedidos estão presentes».
*/
function isDefect(problem: string, wanted: string[]): boolean {
  if (/sem diferenças|estão (todos )?presentes|está (tudo )?(correct|cert)|estão (correct|cert)/i.test(problem)) {
    return false;
  }
  // «X» em vez de «X»: a mesma frase dos dois lados, a menos de maiúsculas.
  const quoted = [...problem.matchAll(/«([^»]+)»/g)].map((match) => match[1]);
  if (quoted.length >= 2 && quoted.every((text) => sameText(text, quoted[0]))) return false;
  // «X» em vez de um texto pedido igual a X.
  if (quoted.length === 1 && /em vez de|em lugar de/i.test(problem) && wanted.some((text) => sameText(text, quoted[0]))) {
    return false;
  }
  return true;
}

// --- Verificação de uma edição por zonas ------------------------------------

type EditInput = NonNullable<z.infer<typeof requestSchema>['edit']>;

const editAnswerSchema = z.object({
  zones: z
    .array(
      z.object({
        number: z.number().int(),
        applied: z.boolean().default(true),
        note: note(160),
      }),
    )
    .default([]),
  annotations: z
    .object({ visible: z.boolean().default(false), note: note(160) })
    .default({}),
  logo: z.object({ worse: z.boolean().default(false), note: note(160) }).default({}),
  regressions: z
    .array(note(160))
    .default([])
    .transform((list) => list.filter(Boolean).slice(0, 3)),
});

/**
 * Antes e depois, lado a lado, com o pedido de cada zona.
 *
 * O logótipo não é comparado com o ficheiro original, de propósito: fora
 * das zonas a arte é a de antes, píxel a píxel, e um logótipo que já
 * estava como o cliente o aceitou não pode reprovar uma edição que não lhe
 * tocou. A pergunta é se ficou PIOR.
 */
async function reviewEdit(
  provider: NonNullable<ReturnType<typeof resolveIdentityProvider>>,
  after: string,
  edit: EditInput,
) {
  try {
    const raw = await provider.generateJson({
      system: SYSTEM,
      user: buildEditReviewPrompt(edit),
      images: [edit.before, after],
      temperature: 0,
    });
    const answer = editAnswerSchema.safeParse(extractJsonObject(raw));
    if (!answer.success) throw new Error('resposta fora do formato');
    return NextResponse.json({ ok: true, review: decideEdit(answer.data, edit) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'A verificação falhou.' },
      { status: 502 },
    );
  }
}

function decideEdit(answer: z.infer<typeof editAnswerSchema>, edit: EditInput): ArtReview {
  const issues: string[] = [];
  let score = 0;

  // Uma zona que os píxeis dizem igual NÃO foi feita, diga o modelo o que
  // disser. As restantes ficam com a resposta do modelo.
  const notApplied = new Map<number, string>();
  for (const number of edit.unchanged) notApplied.set(number, '');
  for (const zone of answer.zones) {
    if (!zone.applied && !notApplied.has(zone.number)) notApplied.set(zone.number, zone.note);
  }

  for (const [number, why] of [...notApplied.entries()].sort((a, b) => a[0] - b[0])) {
    const zone = edit.zones.find((entry) => entry.number === number);
    if (!zone) continue;
    issues.push(
      `A alteração da zona ${number} não foi feita${why ? ` (${why})` : ''}. Tem de ficar assim: ${zone.request}`,
    );
    score += 2;
  }

  if (answer.annotations.visible) {
    issues.push(
      'Ficaram marcas do mapa na arte — manchas de cor, contornos ou números das zonas. Nada disso pode aparecer.',
    );
    score += 3;
  }

  if (answer.logo.worse) {
    issues.push(
      `O logótipo ficou pior do que estava${answer.logo.note ? ` (${answer.logo.note})` : ''}. Tem de ficar exactamente como antes.`,
    );
    score += 3;
  }

  for (const regression of answer.regressions.slice(0, 2)) {
    issues.push(`Mudou uma coisa que não foi pedida: ${regression} Tem de voltar a ficar como estava.`);
    score += 2;
  }

  return { retry: score > 0, issues, score };
}

function buildEditReviewPrompt(edit: EditInput): string {
  const lines = [
    'Recebes duas imagens da mesma publicação: a PRIMEIRA é a publicação ANTES de uma edição; a SEGUNDA é a publicação DEPOIS.',
    '',
    'O cliente pediu estas alterações, zona a zona:',
    ...edit.zones.map(
      (zone) => `· Zona ${zone.number}${zone.position ? ` — ${zone.position}` : ''}: «${zone.request}»`,
    ),
    '',
    'Responde comparando ANTES e DEPOIS:',
    '· "zones": para cada zona, "applied" — a alteração pedida foi feita, no sítio indicado, de forma reconhecível? Uma alteração clara mas não perfeita conta como feita. "note": se não foi feita, o que se vê em vez disso.',
    '· "annotations.visible": a imagem DEPOIS tem marcas que parecem de anotação e não existiam ANTES — manchas de cor magenta, ciano, laranja ou violeta, contornos à volta de zonas, números dentro de círculos?',
    '· "logo.worse": o logótipo ficou PIOR do que estava ANTES — espelhado, com letras trocadas, cortado, redesenhado ou desaparecido? Se ficou igual, é false.',
    '· "regressions": até 3 frases curtas sobre coisas que mudaram SEM terem sido pedidas e que estragam a publicação — um texto que mudou, um elemento que desapareceu, uma zona que ficou com aspecto colado. Diferenças mínimas de grão, nitidez ou tom não contam. Vazio se não houver.',
    '',
    'Formato da resposta:',
    '{',
    `  "zones": [${edit.zones.map((zone) => `{ "number": ${zone.number}, "applied": true, "note": "" }`).join(', ')}],`,
    '  "annotations": { "visible": false, "note": "" },',
    '  "logo": { "worse": false, "note": "" },',
    '  "regressions": []',
    '}',
  ];
  return lines.join('\n');
}

const SYSTEM = [
  'És um director de arte a fazer o controlo de qualidade de uma publicação antes de ela ser entregue ao cliente.',
  'Respondes em português europeu. Devolves EXCLUSIVAMENTE um objecto JSON válido, sem texto antes ou depois.',
  '',
  'Avalias com rigor e sem inventar defeitos. Uma publicação reprovada por engano custa uma geração inteira ao cliente.',
  'Só marcas um defeito quando o vês claramente. Na dúvida, não marcas.',
  'Diferenças de tamanho, de posição e de cor de fundo à volta do logótipo NÃO são defeitos: o que importa é a forma do logótipo e as suas letras.',
].join('\n');

function buildUserPrompt(input: {
  hasLogo: boolean;
  hasRecreate: boolean;
  /** Os preços pedidos. Vazio quando a arte não tem preço. */
  prices: string[];
  /** A arte não leva botão nem chamada para acção. */
  noCta: boolean;
  /** O gerador recebeu um esboço cinzento da disposição. */
  sketch: boolean;
  /** O que mostravam os exemplos de acabamento, em palavras. */
  examples: string[];
  logoText: string;
  logoSymbols: string;
  headline: string;
  texts: string[];
  contacts: string[];
}): string {
  const lines: string[] = [];

  /*
    A ordem das imagens dita-se por extenso, porque muda: o logótipo só vai
    quando a arte o leva, e a arte a recriar só quando o cliente anexou uma.
  */
  const order = [
    input.hasLogo ? 'o logótipo original da empresa' : null,
    'a publicação gerada, tal como vai ser publicada',
    input.hasRecreate
      ? 'uma arte de OUTRA empresa que o cliente pediu para recriar com a marca dele'
      : null,
  ].filter((entry): entry is string => Boolean(entry));
  const ordinal = ['PRIMEIRA', 'SEGUNDA', 'TERCEIRA'];
  lines.push(
    order.length === 1
      ? `Recebes uma imagem: ${order[0]}.`
      : `Recebes ${order.length} imagens. ${order
          .map((entry, index) => `A ${ordinal[index]} é ${entry}.`)
          .join(' ')}`,
  );
  const artIs = ordinal[input.hasLogo ? 1 : 0];
  lines.push(`A publicação a avaliar é sempre a ${artIs} imagem.`, '');

  if (input.hasLogo) {
    lines.push('LOGÓTIPO — compara o logótipo dentro da publicação com o original:');
    if (input.logoText) {
      lines.push(`O texto do logótipo original é «${input.logoText}».`);
    }
    if (input.logoSymbols) lines.push(`Elementos gráficos do original: ${input.logoSymbols}.`);
    lines.push(
      '· "present": o logótipo aparece na publicação?',
      '· "faithful": a forma, as letras e o símbolo são os do original? Um logótipo com as mesmas letras e o mesmo símbolo é fiel, mesmo que tenha outro tamanho.',
      '· "mirrored": o logótipo, ou alguma letra dele, aparece espelhado ou invertido?',
      '· "misspelled": há letras trocadas, a mais ou em falta em relação ao original?',
      '· "cutOff": o logótipo é cortado pela aresta da imagem, ou toca nela?',
      '· "tight": o logótipo está inteiro mas demasiado perto de uma aresta — o espaço entre ele e a aresta mais próxima é menor do que a altura do próprio logótipo?',
      '· "edgeGap": um número — o espaço entre o logótipo e a aresta da publicação mais próxima dele, em percentagem da LARGURA da publicação. 0 se toca na aresta ou é cortado por ela. Mede de verdade: olha para as quatro arestas.',
      '· "widthShare": um número — a largura do logótipo dentro da publicação, em percentagem da LARGURA da publicação. Mede de verdade, de uma ponta à outra do logótipo.',
      '· "overlapsText": o logótipo está por cima de um texto da publicação?',
      '· "extraText": há texto escrito junto ao logótipo que não existe no original — por exemplo o nome da empresa repetido por baixo?',
      '· "note": se "faithful" for falso, diz numa frase curta o que mudou.',
      '',
    );
  } else {
    lines.push('Esta publicação não leva logótipo.', '');
  }

  lines.push(
    'MARGENS — "edges.cutOff": algum produto, texto ou elemento importante é cortado pela aresta da imagem? Olha com atenção para as arestas de cima e de baixo: uma linha de texto pequeno, de contactos ou um botão cortados a meio contam. Elementos de fundo ou de cenário que saem da moldura de propósito não contam. "edges.note": o que está cortado.',
    '"edges.topGap": um número — o espaço entre o texto ou o logótipo mais alto e a aresta de cima, em percentagem da ALTURA da publicação. "edges.bottomGap": o mesmo entre o texto ou o logótipo mais baixo — muitas vezes a linha dos contactos — e a aresta de baixo. 0 se tocam ou são cortados.',
    '',
  );

  lines.push('TEXTOS — compara com o que foi pedido:');
  lines.push(`· Título pedido: «${input.headline || '(sem título)'}». "texts.headlineCorrect": o título saiu com estas palavras exactas? "texts.headlineSeen": o título tal como está escrito na publicação, letra a letra.`);
  for (const text of input.texts) lines.push(`· Texto pedido: «${text}»`);
  lines.push(
    'Maiúsculas e minúsculas não contam: um texto composto todo em maiúsculas, ou com uma palavra em maiúsculas, está certo se as letras e os acentos forem os mesmos.',
    '"texts.problems": até 3 frases curtas sobre o título e os textos pedidos que faltam ou saíram com erros. Só defeitos: não escrevas o que está certo. Os contactos têm o seu próprio campo. Vazio se estiver tudo certo.',
    '',
  );

  if (input.contacts.length > 0) {
    lines.push('CONTACTOS — um a um, pela ordem:');
    input.contacts.forEach((contact, index) => {
      lines.push(`${index + 1}. «${contact}»`);
    });
    lines.push(
      'Para cada um, em "contacts": "index" (o número acima); "present" — está escrito na publicação?; "exact" — com estes caracteres exactos, sem letras ou dígitos trocados?; "legible" — lê-se num telemóvel: inteiro, não cortado pela aresta, com tamanho e contraste suficientes?; "note" — se algum for falso, o que se vê.',
      '',
    );
  }

  lines.push(
    input.prices.length > 0
      ? `PREÇOS — "prices.invented": aparece algum preço, valor, percentagem ou moeda que não seja ${input.prices.map((price) => `«${price}»`).join(' ou ')}? Conta também o que está escrito dentro de ecrãs de telemóveis, portáteis ou televisões, e qualquer valor em dólares (USD, $) ou euros. "prices.note": o que aparece.`
      : 'PREÇOS — esta publicação não tem preço. "prices.invented": aparece algum preço, valor, percentagem ou moeda? Conta também o que está escrito dentro de ecrãs de telemóveis, portáteis ou televisões. "prices.note": o que aparece.',
    '',
  );

  lines.push(
    'TEXTO A MAIS — "scene.extraText": há na publicação palavras que não estão nos textos pedidos nem nos contactos — uma frase, uma promessa, um prazo, um testemunho, o nome ou o logótipo de outra marca —, escritas no layout ou em objectos da cena (um cartão, um saco, uma caixa, um ecrã), ou o nome da empresa repetido fora do logótipo? O logótipo da empresa e o rótulo de um produto não contam. "scene.note": o que está escrito e onde.',
    '',
  );

  if (input.noCta) {
    lines.push(
      'BOTÃO — esta publicação NÃO leva botão nem chamada para acção. "button.present": há na publicação um botão — uma forma com texto dentro, como «Encomenda já», «Compra agora» ou «Saber mais» — ou uma chamada para acção escrita que não esteja nos textos pedidos? Uma forma gráfica sem texto não conta. "button.note": o que se vê.',
      '',
    );
  }

  if (input.examples.length > 0) {
    lines.push(
      'EXEMPLOS — a arte foi feita com estes exemplos de direcção artística, que mostravam:',
      ...input.examples.map((example, index) => `${index + 1}. ${example}`),
      '"examples.copied": a publicação repete a cena de algum deles — o mesmo objecto principal no mesmo cenário? Uma linguagem gráfica parecida (formas, uso da cor, tipografia) é o objectivo e não conta, nem uma pessoa, um produto, uma luz ou uma cor parecidos; conta a cena reconhecível. "examples.note": qual e o quê.',
      '',
    );
  }

  if (input.sketch) {
    lines.push(
      'ESBOÇO — o gerador recebeu um esboço cinzento da disposição. "sketch.visible": passaram para a publicação restos desse esboço — caixas cinzentas lisas, barras cinzentas no lugar de texto, uma cruz em X, contornos de maqueta? "sketch.note": o que se vê.',
      '',
    );
  }

  if (input.hasRecreate) {
    lines.push(
      'ARTE A RECRIAR — compara a publicação com a arte da outra empresa. A estrutura parecida (a composição, a hierarquia, o tipo de cena) é o OBJECTIVO e não conta.',
      '"recreate.copied": a publicação copiou da arte original o logótipo, o nome da outra empresa, as mesmas pessoas, as mesmas fotografias ou os mesmos textos? "recreate.note": o que foi copiado.',
      '',
    );
  }

  lines.push(
    'Formato da resposta:',
    '{',
    // Sem números de exemplo: um número no exemplo é a resposta que volta.
    '  "logo": { "present": true, "faithful": true, "mirrored": false, "misspelled": false, "cutOff": false, "tight": false, "edgeGap": "<número medido>", "widthShare": "<número medido>", "overlapsText": false, "extraText": false, "note": "" },',
    ...(input.noCta ? ['  "button": { "present": false, "note": "" },'] : []),
    '  "edges": { "cutOff": false, "topGap": "<número medido>", "bottomGap": "<número medido>", "note": "" },',
    '  "texts": { "headlineCorrect": true, "headlineSeen": "", "problems": [] },',
    `  "contacts": [${input.contacts
      .map((_, index) => `{ "index": ${index + 1}, "present": true, "exact": true, "legible": true, "note": "" }`)
      .join(', ')}],`,
    '  "prices": { "invented": false, "note": "" },',
    '  "sketch": { "visible": false, "note": "" },',
    '  "scene": { "extraText": false, "note": "" },',
    '  "examples": { "copied": false, "note": "" },',
    '  "recreate": { "copied": false, "note": "" }',
    '}',
  );

  return lines.join('\n');
}
