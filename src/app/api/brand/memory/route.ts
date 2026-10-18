import { NextResponse } from 'next/server';
import { z } from 'zod';
import { extractJsonObject, resolveTextProvider } from '@/lib/ai/providers/text';
import { SEGMENTS } from '@/lib/domain/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/**
 * A memória da empresa: do registo de uso a regras curtas.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Recebe o que o cliente fez — as correcções nas edições por zonas, as ideias
 * recusadas, as artes descarregadas e aprovadas, os textos reescritos — e
 * devolve as preferências que se repetem, numa lista curta. Não guarda nada:
 * quem chama junta as regras novas às do cliente, sem repetir as que ele
 * apagou.
 *
 * Um modelo de texto simples chega. São frases curtas a ler e a resumir, e a
 * leitura corre em segundo plano, sem o cliente à espera.
 * ──────────────────────────────────────────────────────────────────────────
 */

const clipped = (max: number) =>
  z
    .string()
    .default('')
    .transform((value) => {
      const flat = value.replace(/\s+/g, ' ').trim();
      if (flat.length <= max) return flat;
      const cut = flat.slice(0, max);
      const word = cut.lastIndexOf(' ');
      return (word > 0 ? cut.slice(0, word) : cut).trim();
    });

const requestSchema = z.object({
  company: z
    .object({
      name: z.string().max(120).default(''),
      segment: z.string().max(40).default('outro'),
      description: z.string().max(600).default(''),
    })
    .default({}),
  rules: z
    .array(z.object({ text: clipped(200), source: z.enum(['ia', 'cliente']).catch('ia') }))
    .max(20)
    .default([]),
  dismissed: z.array(clipped(200)).max(60).default([]),
  events: z
    .array(
      z.object({
        kind: z.string().max(20),
        at: z.string().max(40).default(''),
        detail: clipped(300),
      }),
    )
    .min(1)
    .max(80),
});

const answerSchema = z.object({
  rules: z
    .array(clipped(160))
    .default([])
    .transform((rules) => rules.filter(Boolean).slice(0, 8)),
});

const KIND_WORDS: Record<string, string> = {
  edicao: 'edição por zonas',
  'outra-ideia': 'ideia recusada',
  melhoria: 'ideia melhorada a pedido do cliente',
  descarga: 'arte descarregada',
  texto: 'texto reescrito',
  aprovada: 'arte aprovada para a biblioteca',
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Pedido inválido.' }, { status: 400 });
  }
  const input = parsed.data;

  const provider = resolveTextProvider();
  if (!provider) {
    return NextResponse.json(
      { ok: false, error: 'Não há fornecedor de texto configurado.' },
      { status: 503 },
    );
  }

  const segment =
    SEGMENTS.find((entry) => entry.id === input.company.segment)?.label ?? input.company.segment;

  const user = [
    '## Empresa',
    `Nome: ${input.company.name || '(não indicado)'}`,
    `Actividade: ${segment}`,
    `Descrição: ${input.company.description || '(não indicada)'}`,
    '',
    '## O que o cliente fez, do mais recente para o mais antigo',
    ...input.events.map(
      (event) => `- [${KIND_WORDS[event.kind] ?? event.kind}] ${event.detail}`,
    ),
    '',
    '## Regras que já existem',
    ...(input.rules.length > 0
      ? input.rules.map(
          (rule) => `- ${rule.text}${rule.source === 'cliente' ? ' (escrita pelo cliente — não repitas)' : ''}`,
        )
      : ['- (nenhuma)']),
    '',
    '## Regras que o cliente apagou — nunca as voltes a propor, nem por outras palavras',
    ...(input.dismissed.length > 0 ? input.dismissed.map((text) => `- ${text}`) : ['- (nenhuma)']),
    '',
    '## O que devolves',
    'Reescreve o conjunto das regras aprendidas (as que não são do cliente), com o que o registo mostra agora:',
    '- Só preferências que se repetem, ou que o cliente pediu explicitamente numa edição.',
    '- Sobre a forma de comunicar desta empresa: composição, tipo de imagem, pessoas ou produto, texto, tom, elementos que quer sempre ou nunca.',
    '- Nunca sobre uma publicação concreta: sem preços, datas, promoções nem produtos de uma campanha.',
    '- Cada regra numa frase curta, até 140 caracteres, que outra pessoa possa seguir. Por exemplo: "Prefere fotografia real a ilustração." ou "O logótipo fica sempre grande e no canto de cima."',
    '- No máximo 8. Lista vazia se o registo ainda não mostra nada consistente.',
    '',
    'Formato da resposta: { "rules": ["string"] }',
  ].join('\n');

  try {
    const raw = await provider.generateJson({
      system: [
        'És um director de arte que acompanha esta empresa há meses. Lês o registo do que o cliente fez numa ferramenta de criação de publicações e escreves as preferências dele em regras curtas.',
        'Respondes em português europeu, com vocabulário usado em Angola. Devolves EXCLUSIVAMENTE um objecto JSON válido, sem texto antes ou depois.',
        'Não inventas. Uma acção isolada não é uma preferência, a não ser que o cliente a tenha pedido por palavras.',
      ].join('\n'),
      user,
      temperature: 0.2,
      maxTokens: 4_000,
      timeoutMs: 60_000,
    });

    const answer = answerSchema.safeParse(extractJsonObject(raw));
    if (!answer.success) throw new Error('resposta fora do formato');

    return NextResponse.json({
      ok: true,
      provider: `${provider.id}:${provider.model}`,
      rules: answer.data.rules,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: `Não foi possível actualizar a memória (${
          error instanceof Error ? error.message : 'erro desconhecido'
        }).`,
      },
      { status: 502 },
    );
  }
}
