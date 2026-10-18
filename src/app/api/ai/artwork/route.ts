import { NextResponse } from 'next/server';
import { buildArtworkPrompt } from '@/lib/ai/prompt';
import { resolveImageProvider } from '@/lib/ai/providers/image';
import { artworkRequestSchema, type ReferenceRole } from '@/lib/ai/schema';
import { safeMargins } from '@/lib/composition/frame';
import { getFormat, getStyle } from '@/lib/domain/catalog';
import { completeUsage } from '@/lib/references/catalog';
import { prepareLogoReference } from '@/lib/server/logoReference';
import { readLogo } from '@/lib/server/logoReading';
import { referenceImages } from '@/lib/server/referenceFiles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/*
  Uma geração com o modelo actual leva perto de 90 segundos, e a
  transcrição do logótipo soma-lhe alguns. Sem este limite declarado, uma
  plataforma de alojamento com tempo por omissão curto cortava a resposta
  com a arte já paga.
*/
export const maxDuration = 300;

/**
 * Geração da arte completa.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O gerador produz a publicação inteira: cena, produtos, composição e texto.
 * É o passo que dá o acabamento profissional.
 *
 * Tudo o que entra aqui já passou pelo ecrã de revisão — os textos foram
 * confirmados, os produtos nomeados e a ideia visual aprovada. Esta rota não
 * inventa nada: monta a instrução a partir do que recebe.
 *
 * Sem fornecedor de imagem configurado, devolve um erro claro em vez de uma
 * alternativa que não é o que foi pedido. A arte completa não tem versão
 * local: desenhar formas geométricas e chamar-lhe arte profissional era
 * exactamente o problema que esta rota existe para resolver.
 * ──────────────────────────────────────────────────────────────────────────
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = artworkRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Pedido inválido.',
        details: parsed.error.issues.map((issue) => issue.path.join('.')).slice(0, 8),
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
          'Não há fornecedor de imagem configurado. A arte final é gerada por IA e não tem alternativa local — define OPENROUTER_API_KEY nas Definições.',
      },
      { status: 503 },
    );
  }

  if (!input.texts.headline.trim()) {
    return NextResponse.json(
      { ok: false, error: 'Falta o título. Confirma os textos antes de gerar.' },
      { status: 400 },
    );
  }

  /*
    O plano de aproveitamento completado pelo cadastro.

    `completeUsage` acrescenta as proibições escritas na biblioteca e força
    `descricao` nas referências marcadas como inseguras para envio directo.
    O cliente nunca decide isto, e o modelo de texto também não.
  */
  const usage = completeUsage(input.referenceUsage);

  /*
    MATERIAL DO CLIENTE PRIMEIRO, referência estética depois.

    A ordem inverteu-se. Antes a referência do modelo ia em primeiro lugar e
    o prompt dizia "a primeira imagem anexada define a estrutura". Agora o
    que vem primeiro são os produtos e o logótipo — o que tem de ser
    preservado —, e o exemplo de acabamento vem no fim, identificado como
    tal.
  */
  const aestheticImages = provider.acceptsReferences ? await referenceImages(usage) : [];

  /*
    ──────────────────────────────────────────────────────────────────────────
    O LOGÓTIPO É A IMAGEM 1, e chega limpo.

    Duas técnicas, ambas sobre o que o gerador vê antes de qualquer palavra:

     · PRIMEIRO na lista. Os geradores da OpenAI preservam melhor a primeira
       imagem anexada — está documentado para a edição de alta fidelidade, e
       é coerente com o que se observa na geração com referências. Antes ia
       em último, depois dos produtos.
     · PREPARADO: sem margens vazias, sobre um fundo sólido que contrasta com
       ele, ampliado até 1024 px. Um PNG transparente era lido com fundo
       escuro, e um logótipo azul-marinho sobre escuro é um logótipo que o
       gerador não consegue ver — e reconstrói de memória.

    O `input_fidelity: "high"` da OpenAI, que seria a técnica directa, não
    está entre os parâmetros que este modelo aceita através do OpenRouter
    (consultado em /images/models/.../endpoints). Um parâmetro não declarado
    é rejeitado com 400, por isso não vai.
    ──────────────────────────────────────────────────────────────────────────
  */
  const logoInput =
    input.drawLogo && provider.acceptsReferences
      ? input.references.find((reference) => reference.role === 'logotipo')
      : undefined;

  /*
    Só há logótipo na arte quando o FICHEIRO vai anexado.

    O pedido pode chegar com `drawLogo` ligado e sem ficheiro — uma marca
    que ainda não carregou o logótipo. Passar o `drawLogo` tal e qual punha
    no prompt "a primeira imagem anexada é o logótipo", e a primeira imagem
    era a fotografia de um produto: o gerador tratava-a como marca, ou
    inventava uma.
  */
  const hasLogo = Boolean(logoInput);
  const preparedLogo = logoInput ? await prepareLogoReference(logoInput.dataUrl) : null;
  const logoReading = preparedLogo ? await readLogo(preparedLogo) : null;

  /*
    Um só logótipo, sempre em primeiro. Um segundo ficheiro com o mesmo papel
    — ou um logótipo com `drawLogo` desligado — deixava a lista de imagens a
    descrever uma marca que o prompt não pede.
  */
  const clientReferences = provider.acceptsReferences
    ? [
        ...(logoInput
          ? [{ ...logoInput, dataUrl: preparedLogo?.dataUrl ?? logoInput.dataUrl }]
          : []),
        ...input.references.filter((reference) => reference.role !== 'logotipo'),
      ]
    : [];

  const described: Array<{ role: ReferenceRole; label: string }> = [
    ...clientReferences.map((reference) => ({
      role: reference.role,
      label: reference.label,
    })),
    // O rótulo de um exemplo de acabamento é o identificador da referência:
    // é por ele que o prompt junta a cada imagem o que dela se aproveita.
    ...aestheticImages.map((image) => ({ role: 'estetica' as const, label: image.referenceId })),
  ];

  /*
    As margens na imagem que o gerador desenha, já com o recorte da moldura.
    Ver `safeMargins`: a publicação de Instagram vem em 3:4 e perde as pontas
    de cima e de baixo.
  */
  const spec = getFormat(input.format);
  const frame = safeMargins(provider.outputRatio(input.format), spec.width / spec.height);

  const prompt = buildArtworkPrompt({
    direction: input.direction,
    format: input.format,
    frame,
    memory: input.memory,
    layout: input.layout,
    prices: [input.texts.price].filter((price) => price.trim()),
    style: input.style,
    styleGuidance: getStyle(input.style).guidance,
    referenceUsage: usage,
    company: input.company,
    segment: input.segment,
    colors: input.colors,
    base: input.base,
    logoSize: input.logoSize,
    contactsPlacement: input.contactsPlacement,
    typography: input.typography,
    texts: input.texts,
    items: input.items,
    drawLogo: hasLogo,
    logo: hasLogo
      ? {
          tone: preparedLogo?.tone ?? null,
          read: Boolean(
            logoReading && (logoReading.text || logoReading.symbols || logoReading.description),
          ),
          text: logoReading?.text ?? '',
          letters: logoReading?.letters ?? [],
          symbols: logoReading?.symbols ?? '',
          description: logoReading?.description ?? '',
        }
      : null,
    correction: input.correction,
    contacts: input.contacts,
    references: described,
    guidelines: input.guidelines,
    brandStyle: input.brandStyle,
  });

  // `clientReferences` e `aestheticImages` já vêm vazios quando o
  // fornecedor não aceita imagens.
  const references = [
    ...clientReferences.map((reference) => reference.dataUrl),
    ...aestheticImages.map((image) => image.dataUrl),
  ];

  try {
    const image = await provider.generate({ prompt, format: input.format, references });

    return NextResponse.json({
      ok: true,
      provider: `${provider.id}:${provider.model}`,
      usedReferences: references.length,
      // Diagnóstico: se o logótipo foi preparado e transcrito. Quando uma
      // arte sai com a marca errada, é a primeira coisa a confirmar.
      logo: hasLogo
        ? {
            prepared: Boolean(preparedLogo),
            tone: preparedLogo?.tone ?? null,
            read: Boolean(logoReading?.text || logoReading?.symbols),
          }
        : null,
      prompt,
      frame,
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
            : 'A geração da arte falhou. A tua revisão ficou intacta.',
      },
      { status: 502 },
    );
  }
}
