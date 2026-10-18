import { NextResponse } from 'next/server';
import { buildIdentitySystemPrompt, buildIdentityUserPrompt } from '@/lib/ai/identityPrompt';
import { identityProposalSchema, identityRequestSchema } from '@/lib/ai/identitySchema';
import { extractJsonObject, resolveIdentityProvider } from '@/lib/ai/providers/text';
import { buildFallbackProposal } from '@/lib/brand/identityFallback';
import { prepareLogoReference } from '@/lib/server/logoReference';
import { bestTextOn, ensureContrast, mix, relativeLuminance, safeHex } from '@/lib/utils/color';
import type { IdentityProposal } from '@/lib/ai/identitySchema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proposta de identidade da marca.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O logótipo do cliente é enviado ao modelo como imagem, junto com os dados
 * da empresa, as cores declaradas, as pistas do manual de marca e a
 * preferência visual. A resposta é validada contra `identityProposalSchema`
 * antes de sair daqui.
 *
 * Duas garantias que esta rota faz cumprir, independentemente do que o
 * modelo devolva:
 *
 *  · as cores DECLARADAS pelo cliente são reimpostas nos respectivos papéis;
 *  · nada é apresentado como análise de IA quando veio das regras locais.
 *
 * Sem fornecedor de texto, ou com resposta inválida, devolvemos a proposta
 * determinística e dizemo-lo em `source`.
 * ──────────────────────────────────────────────────────────────────────────
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = identityRequestSchema.safeParse(body);

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

  const fallbackInput = {
    company: input.company,
    colors: input.colors,
    extractedColors: input.extractedColors,
    visualPreference: input.visualPreference,
    constraints: input.constraints,
    hasLogo: Boolean(input.logoDataUrl),
    logoTone: input.logoTone,
  };

  const provider = resolveIdentityProvider();

  if (!provider) {
    return NextResponse.json({
      ok: true,
      source: 'local' as const,
      proposal: enforceDeclaredColors(buildFallbackProposal(fallbackInput), input.colors),
      notice:
        'Modo de demonstração: não há fornecedor de texto configurado. A proposta foi derivada das tuas cores por regras locais, com contraste garantido — mas não houve análise do logótipo.',
    });
  }

  /*
    O logótipo só segue quando o fornecedor sabe receber imagens — e segue
    PREPARADO, como o gerador o recebe: sem margens vazias e sobre um fundo
    que contrasta com ele. Cru, um PNG transparente com um logótipo escuro
    era lido sobre preto, e a análise descrevia um logótipo que mal via. A
    preparação também converte SVG, que os modelos de visão não aceitam.
  */
  const preparedLogo =
    provider.supportsImages && input.logoDataUrl
      ? await prepareLogoReference(input.logoDataUrl)
      : null;
  const images =
    provider.supportsImages && input.logoDataUrl
      ? [preparedLogo?.dataUrl ?? input.logoDataUrl]
      : undefined;

  try {
    const raw = await provider.generateJson({
      system: buildIdentitySystemPrompt(),
      user: buildIdentityUserPrompt(input),
      images,
      // A proposta é o maior JSON que pedimos — paleta, escala tipográfica,
      // regras, briefings — e o modelo raciocina antes de o escrever. Mais
      // folga do que o tecto por omissão, sem reservar o máximo do modelo.
      maxTokens: 24_000,
    });

    const validated = identityProposalSchema.safeParse(extractJsonObject(raw));
    if (!validated.success) {
      throw new Error(describeInvalid(validated.error.issues.map((i) => String(i.path[0] ?? ''))));
    }

    return NextResponse.json({
      ok: true,
      source: 'ia' as const,
      provider: `${provider.id}:${provider.model}`,
      analysedLogo: Boolean(images),
      proposal: enforceDeclaredColors(validated.data, input.colors),
      notice: images
        ? undefined
        : 'O fornecedor de texto configurado não aceita imagens, por isso o logótipo não foi analisado. A proposta usa os dados da empresa e as cores indicadas.',
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'erro desconhecido';
    return NextResponse.json({
      ok: true,
      source: 'local' as const,
      proposal: enforceDeclaredColors(buildFallbackProposal(fallbackInput), input.colors),
      notice: `A análise por IA não devolveu uma proposta utilizável (${reason}). Derivámos a identidade das tuas cores com as regras locais e os teus ficheiros ficaram intactos.`,
    });
  }
}

/**
 * Reimpõe as cores que o cliente declarou.
 *
 * O prompt já o diz, mas um modelo que ajuste "ligeiramente" a cor principal
 * está a reescrever a identidade da empresa. Esta é a barreira que garante
 * que isso não passa, e corre tanto no caminho da IA como no local.
 */
function enforceDeclaredColors(
  proposal: IdentityProposal,
  declared: { primary?: string; secondary?: string; accent?: string | null },
): IdentityProposal {
  const fixed: Partial<Record<string, string>> = {};
  if (declared.primary) fixed.primary = safeHex(declared.primary, declared.primary);
  if (declared.secondary) fixed.secondary = safeHex(declared.secondary, declared.secondary);
  if (declared.accent) fixed.accent = safeHex(declared.accent, declared.accent);

  const withDeclared =
    Object.keys(fixed).length === 0
      ? proposal
      : {
          ...proposal,
          colors: proposal.colors.map((entry) => {
            const override = fixed[entry.role];
            return override && override !== entry.hex ? { ...entry, hex: override } : entry;
          }),
        };

  return completeSystem(withDeclared);
}

/**
 * Completa os papéis que faltam na paleta e nos fundos.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Em teste com IA real, uma resposta válida trouxe quatro cores —
 * `primary`, `secondary`, `textOnLight`, `textOnDark` — e nenhum fundo
 * nomeado. Faltavam `bgLight` e `bgDark`, que são exactamente os papéis de
 * que a criação de artes precisa, e a proposta ficava impossível de aprovar.
 *
 * Em vez de rejeitar uma resposta que está boa no resto, derivamos o que
 * falta com as mesmas funções de contraste do motor de artes. O resultado é
 * legível por construção e a paleta tem sempre os pares que promete.
 * ──────────────────────────────────────────────────────────────────────────
 */
function completeSystem(proposal: IdentityProposal): IdentityProposal {
  const byRole = new Map(proposal.colors.map((entry) => [entry.role, entry]));
  const primary = byRole.get('primary')?.hex ?? '#16324F';

  /*
    Secundária em falta: deriva-se do TOM da principal, não de uma mistura.

    Um logótipo escuro pede branco; um logótipo claro pede um preto suave.
    Preto absoluto em publicidade fica duro e revela os artefactos de
    compressão, por isso usamos `#10141A`.
  */
  const secondary =
    byRole.get('secondary')?.hex ??
    (relativeLuminance(primary) < 0.42 ? '#FFFFFF' : '#10141A');

  const colors = [...proposal.colors];

  const ensure = (
    role: IdentityProposal['colors'][number]['role'],
    hex: string,
    label: string,
    usage: string,
  ) => {
    if (byRole.has(role)) return;
    colors.push({ role, hex, label, usage });
    byRole.set(role, { role, hex, label, usage });
  };

  const bgLight = byRole.get('bgLight')?.hex ?? mix(primary, '#FFFFFF', 0.92);
  const bgDark = byRole.get('bgDark')?.hex ?? mix(primary, '#0A0B0D', 0.74);

  ensure('secondary', secondary, 'Secundária', 'Superfícies de apoio e contraste');
  ensure('bgLight', bgLight, 'Fundo claro', 'Publicações de fundo claro');
  ensure('bgDark', bgDark, 'Fundo escuro', 'Publicações de fundo escuro');
  ensure(
    'textOnLight',
    ensureContrast(bestTextOn(bgLight), bgLight, 7),
    'Texto sobre claro',
    'Leitura corrida em fundos claros',
  );
  ensure(
    'textOnDark',
    ensureContrast(bestTextOn(bgDark), bgDark, 7),
    'Texto sobre escuro',
    'Leitura corrida em fundos escuros',
  );
  ensure(
    'neutral',
    mix(bgLight, bgDark, 0.14),
    'Neutro',
    'Linhas, molduras e áreas calmas',
  );

  /*
    `accent` NÃO é completada.

    É a única cor opcional da paleta. Uma marca com duas cores é o caso
    comum, e derivar uma terceira para encher a grelha faz a interface
    afirmar que a empresa tem uma cor que nunca escolheu.
  */

  // Garante os pares de contraste, mesmo quando o modelo os propôs ele
  // próprio: um texto que não se lê não é uma opção de design.
  const fixedPairs = colors.map((entry) => {
    if (entry.role === 'textOnLight') {
      return { ...entry, hex: ensureContrast(entry.hex, bgLight, 4.5) };
    }
    if (entry.role === 'textOnDark') {
      return { ...entry, hex: ensureContrast(entry.hex, bgDark, 4.5) };
    }
    return entry;
  });

  // Os fundos da secção visual seguem a mesma lógica: faltando a textura,
  // derivamo-la em vez de deixar a secção com um só cartão.
  const backgroundIds = new Set(proposal.backgrounds.map((entry) => entry.id));
  const backgrounds = [...proposal.backgrounds];

  if (!backgroundIds.has('claro')) {
    backgrounds.push({
      id: 'claro',
      label: 'Claro',
      description: 'Fundo liso na cor clara da marca, para texto escuro.',
      hexes: [bgLight, secondary],
    });
  }
  if (!backgroundIds.has('escuro')) {
    backgrounds.push({
      id: 'escuro',
      label: 'Escuro',
      description: 'Fundo profundo derivado da cor principal, para contraste.',
      hexes: [bgDark, primary],
    });
  }
  if (!backgroundIds.has('textura') && !backgroundIds.has('fotografia')) {
    backgrounds.push({
      id: 'textura',
      label: 'Textura discreta',
      description: 'A mesma base com textura leve, para dar matéria sem roubar atenção.',
      hexes: [bgLight, mix(bgLight, bgDark, 0.1)],
    });
  }

  return { ...proposal, colors: fixedPairs, backgrounds: backgrounds.slice(0, 4) };
}

const FIELD_NAMES: Record<string, string> = {
  colors: 'a paleta',
  typography: 'a tipografia',
  logoRules: 'as regras do logótipo',
  backgrounds: 'os fundos',
  graphics: 'os elementos gráficos',
  composition: 'a organização',
  direction: 'a direcção visual',
  samples: 'os exemplos',
};

function describeInvalid(fields: string[]): string {
  const named = [...new Set(fields.filter(Boolean).map((f) => FIELD_NAMES[f] ?? `"${f}"`))];
  if (named.length === 0) return 'a resposta não seguiu o formato esperado';
  if (named.length === 1) return `${named[0]} veio inválido`;
  return `${named.slice(0, -1).join(', ')} e ${named[named.length - 1]} vieram inválidos`;
}
