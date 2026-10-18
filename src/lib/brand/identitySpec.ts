/**
 * Especificação de identidade: criação, versões e fusão.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * A proposta que vem da rota é conteúdo cru. Aqui transforma-se em dados
 * guardáveis, com três coisas que a proposta não traz:
 *
 *  · a ORIGEM de cada decisão (cliente, manual ou sugestão da IA);
 *  · a VERSÃO e o estado (rascunho ou aprovada);
 *  · as secções que o cliente editou à mão, que uma actualização não toca.
 *
 * A fusão é o ponto delicado. "Actualizar proposta" tem de trazer ideias
 * novas sem apagar o que o cliente já decidiu — senão o cliente aprende a
 * não clicar no botão.
 * ──────────────────────────────────────────────────────────────────────────
 */
import type { IdentityProposal } from '@/lib/ai/identitySchema';
import { newId } from '@/lib/utils/id';
import { deriveAccent, safeHex } from '@/lib/utils/color';
import type {
  BrandColorEntry,
  BrandColorRole,
  BrandIdentitySpec,
  BrandSectionId,
  BrandVisual,
  BrandVisualKind,
  DecisionSource,
  IdentityHint,
  VisualPreference,
} from '@/lib/domain/types';

export type SpecBuildInput = {
  proposal: IdentityProposal;
  /** Cores que o cliente escreveu nos campos. */
  declaredColors: { primary?: string; secondary?: string; accent?: string | null };
  manualHints: IdentityHint[];
  visualPreference: VisualPreference | null;
  constraints: string;
  producedBy: 'ia' | 'local';
  /** Especificação anterior, quando é uma actualização. */
  previous?: BrandIdentitySpec | null;
};

/** Papéis que o cliente pode declarar directamente nos campos de cor. */
const DECLARABLE: BrandColorRole[] = ['primary', 'secondary', 'accent'];

export function buildIdentitySpec(input: SpecBuildInput): BrandIdentitySpec {
  const { proposal, previous } = input;
  const locked = new Set(previous?.lockedSections ?? []);
  const now = new Date().toISOString();

  const manualColors = new Set(
    input.manualHints
      .filter((hint) => hint.kind === 'cor' && hint.source === 'explicito')
      .map((hint) => safeHex(hint.value, '').toLowerCase()),
  );

  const colorSource = (entry: { role: BrandColorRole; hex: string }): DecisionSource => {
    if (DECLARABLE.includes(entry.role)) {
      const declared = input.declaredColors[entry.role as 'primary' | 'secondary' | 'accent'];
      if (declared && safeHex(declared, '').toLowerCase() === entry.hex.toLowerCase()) {
        return 'cliente';
      }
    }
    if (manualColors.has(entry.hex.toLowerCase())) return 'manual';
    return input.producedBy === 'ia' ? 'ia' : 'ia';
  };

  const colors: BrandColorEntry[] = proposal.colors.map((entry) => ({
    role: entry.role,
    hex: safeHex(entry.hex, entry.hex),
    label: entry.label,
    usage: entry.usage,
    source: colorSource(entry),
  }));

  const manualFonts = input.manualHints.filter((hint) => hint.kind === 'fonte');

  const spec: BrandIdentitySpec = {
    id: previous?.id ?? newId('bid'),
    // Uma actualização gera versão nova. Projectos já criados continuam
    // associados à versão com que foram feitos.
    version: (previous?.version ?? 0) + 1,
    status: 'rascunho',

    tagline: proposal.tagline?.trim()
      ? { value: proposal.tagline.trim(), source: 'ia' }
      : null,

    colors,

    typography: {
      display: proposal.typography.display as BrandIdentitySpec['typography']['display'],
      body: proposal.typography.body as BrandIdentitySpec['typography']['body'],
      rationale: proposal.typography.rationale ?? '',
      // Fontes do manual que não existem no catálogo: declaradas, nunca
      // substituídas em silêncio.
      unavailable: manualFonts
        .filter((hint) => !hint.detail?.startsWith('Disponível'))
        .slice(0, 3)
        .map((hint) => ({
          requested: hint.value,
          replacedWith: proposal.typography.display as BrandIdentitySpec['typography']['display'],
        })),
      source: manualFonts.length > 0 ? 'manual' : 'ia',
    },

    logoRules: {
      ...proposal.logoRules,
      source: 'ia',
    },

    backgrounds: proposal.backgrounds.map((background) => ({
      ...background,
      hexes: background.hexes.map((hex) => safeHex(hex, hex)),
    })),

    graphics: { ...proposal.graphics, notes: proposal.graphics.notes ?? '', source: 'ia' },

    composition: { ...proposal.composition, source: 'ia' },

    direction: { ...proposal.direction, avoid: proposal.direction.avoid ?? [], source: 'ia' },

    typeScale: proposal.typeScale.map((step) => ({
      id: step.id,
      label: step.label,
      font: step.font,
      sizePx: step.sizePx,
      weight: step.weight,
      lineHeight: step.lineHeight,
      tracking: step.tracking,
      uppercase: step.uppercase,
      usage: step.usage,
    })),

    /*
      Um visual, não quatro.

      As aplicações sobre claro e sobre escuro passaram a ser desenhadas pela
      aplicação com o ficheiro real do cliente, e a textura de fundo saiu de
      vez — ver `BrandVisualKind`. O que resta gerar é a folha de identidade,
      que é a peça que não se consegue montar sem um fotógrafo.
    */
    visuals: [
      {
        kind: 'identidade' as const,
        label: 'Identidade visual',
        prompt: proposal.visualPrompts.identidade,
        format: 'quadrado' as const,
        assetId: null,
        stale: false,
      },
    ],

    fixedRules: buildFixedRules(proposal, input.constraints),

    clientConstraints: input.constraints.trim(),
    visualPreference: input.visualPreference,
    producedBy: input.producedBy,
    createdAt: previous?.createdAt ?? now,
    approvedAt: null,
    lockedSections: [...locked],
  };

  return previous ? mergeKeepingEdits(spec, previous) : spec;
}

/**
 * Regras fixas.
 *
 * A integridade do logótipo entra sempre, porque é a única regra que a
 * aplicação garante tecnicamente: o ficheiro é usado como está. O resto vem
 * do que o cliente declarou.
 */
function buildFixedRules(proposal: IdentityProposal, constraints: string): string[] {
  const rules = [
    'O ficheiro do logótipo é aplicado como está. Nunca é redesenhado nem recolorido.',
    `Margem de segurança do logótipo: ${Math.round(proposal.logoRules.clearSpaceRatio * 100)}% da sua largura.`,
    `Tamanho mínimo do logótipo: ${proposal.logoRules.minWidthPx} px de largura.`,
  ];
  if (constraints.trim()) rules.push(`Pedido do cliente: ${constraints.trim()}`);
  return [...new Set([...rules, ...(proposal.fixedRules ?? [])])].slice(0, 8);
}

/**
 * Mantém as secções que o cliente editou à mão.
 *
 * Sem isto, pedir "actualizar proposta" para ver outra ideia de fundos
 * apagava a paleta que o cliente tinha acabado de afinar — e a lição que ele
 * tirava era não voltar a clicar.
 */
function mergeKeepingEdits(
  next: BrandIdentitySpec,
  previous: BrandIdentitySpec,
): BrandIdentitySpec {
  const locked = new Set(previous.lockedSections);
  if (locked.size === 0) return next;

  const merged: BrandIdentitySpec = { ...next };

  if (locked.has('identidade')) {
    merged.tagline = previous.tagline;
    merged.visuals = previous.visuals;
  }
  if (locked.has('paleta')) merged.colors = previous.colors;
  if (locked.has('tipografia')) {
    merged.typography = previous.typography;
    merged.typeScale = previous.typeScale;
  }
  if (locked.has('logotipo')) merged.logoRules = previous.logoRules;
  if (locked.has('fundos')) merged.backgrounds = previous.backgrounds;

  /*
    Visuais já gerados não desaparecem numa actualização.

    Ficam com a imagem antiga e marcados como desactualizados, porque foram
    produzidos com outra paleta. Quem decide se os volta a gerar é o cliente:
    cada geração custa dinheiro.
  */
  if (!locked.has('identidade')) {
    merged.visuals = merged.visuals.map((visual) => {
      const old = previous.visuals.find((entry) => entry.kind === visual.kind);
      if (!old?.assetId) return visual;
      return { ...visual, assetId: old.assetId, stale: true };
    });
  }

  return merged;
}

// --- Operações sobre a especificação ---------------------------------------

/** Marca uma secção como editada à mão. */
export function lockSection(
  spec: BrandIdentitySpec,
  section: BrandSectionId,
): BrandIdentitySpec {
  if (spec.lockedSections.includes(section)) return spec;
  return { ...spec, lockedSections: [...spec.lockedSections, section] };
}

/**
 * Substitui uma cor da paleta.
 *
 * Fixa a secção e marca os exemplos já gerados como desactualizados: foram
 * produzidos com a paleta anterior e deixaram de representar a identidade.
 */
export function setSpecColor(
  spec: BrandIdentitySpec,
  role: BrandColorRole,
  hex: string,
): BrandIdentitySpec {
  const next = safeHex(hex, hex);
  const colors = spec.colors.map((entry) =>
    entry.role === role ? { ...entry, hex: next, source: 'cliente' as const } : entry,
  );
  return lockSection(
    {
      ...spec,
      colors,
      // Os visuais foram gerados com a paleta anterior.
      visuals: spec.visuals.map((visual) =>
        visual.assetId ? { ...visual, stale: true } : visual,
      ),
    },
    'paleta',
  );
}

/**
 * Acrescenta a terceira cor.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Não existe por omissão. A maioria das marcas tem duas cores, e mostrar uma
 * terceira derivada era afirmar que a empresa tem uma cor que nunca
 * escolheu — e pior, essa cor entrava nas artes como realce.
 *
 * Quando o cliente a pede, derivamos uma proposta com `deriveAccent` (que
 * procura um contraste utilizável a partir das duas existentes) e marcamos a
 * origem como `cliente`: foi dele a decisão de a ter.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function addSpecAccent(spec: BrandIdentitySpec): BrandIdentitySpec {
  if (spec.colors.some((entry) => entry.role === 'accent')) return spec;

  const primary = colorOf(spec, 'primary', '#16324F');
  const secondary = colorOf(spec, 'secondary', '#FFFFFF');

  return lockSection(
    {
      ...spec,
      colors: [
        ...spec.colors,
        {
          role: 'accent',
          hex: deriveAccent(primary, secondary),
          label: 'Terceira',
          usage: 'Realces pontuais e chamadas para acção',
          source: 'cliente',
        },
      ],
    },
    'paleta',
  );
}

export function removeSpecAccent(spec: BrandIdentitySpec): BrandIdentitySpec {
  return lockSection(
    { ...spec, colors: spec.colors.filter((entry) => entry.role !== 'accent') },
    'paleta',
  );
}

export function setSpecTypography(
  spec: BrandIdentitySpec,
  patch: Partial<Pick<BrandIdentitySpec['typography'], 'display' | 'body'>>,
): BrandIdentitySpec {
  return lockSection(
    { ...spec, typography: { ...spec.typography, ...patch, source: 'cliente' } },
    'tipografia',
  );
}

/*
  `direction` e `composition` não têm setters.

  Deixaram de aparecer no ecrã: são regras que alimentam a geração das
  publicações, não conteúdo para o cliente afinar no cadastro. Quem as quiser
  mudar fá-lo onde elas se notam — no ecrã de revisão de cada publicação.
*/

export function setSpecTagline(spec: BrandIdentitySpec, value: string): BrandIdentitySpec {
  const trimmed = value.trim();
  return lockSection(
    { ...spec, tagline: trimmed ? { value: trimmed, source: 'cliente' } : null },
    'identidade',
  );
}

export function setVisualAsset(
  spec: BrandIdentitySpec,
  kind: BrandVisualKind,
  assetId: string,
): BrandIdentitySpec {
  return {
    ...spec,
    visuals: spec.visuals.map((visual) =>
      visual.kind === kind ? { ...visual, assetId, stale: false } : visual,
    ),
  };
}

export function setVisualPrompt(
  spec: BrandIdentitySpec,
  kind: BrandVisualKind,
  prompt: string,
): BrandIdentitySpec {
  return lockSection(
    {
      ...spec,
      visuals: spec.visuals.map((visual) =>
        visual.kind === kind ? { ...visual, prompt } : visual,
      ),
    },
    'identidade',
  );
}

/** Cor de um papel, com recurso a uma alternativa quando o papel não existe. */
export function colorOf(
  spec: BrandIdentitySpec,
  role: BrandColorRole,
  fallback: string,
): string {
  return spec.colors.find((entry) => entry.role === role)?.hex ?? fallback;
}

/**
 * A proposta está pronta para aprovação?
 *
 * Exigimos o mínimo que a criação de artes precisa: três cores com função
 * definida, tipografia escolhida e os três exemplos descritos. Não exigimos
 * que cada campo tenha sido aprovado um a um — a aprovação é da proposta
 * completa.
 */
export function isSpecReady(spec: BrandIdentitySpec | null | undefined): boolean {
  if (!spec) return false;

  /*
    Defensiva de propósito.

    Esta é uma função de GUARDA: é chamada para decidir se o botão de
    aprovação activa. Uma guarda que lança excepções é pior do que guarda
    nenhuma — e lançou, quando uma especificação gravada por uma versão
    anterior voltou sem `typeScale` e o cadastro ficou num ecrã de erro.

    A migração em `migrateIdentity.ts` já descarta formas incompatíveis.
    Isto é a segunda barreira, para o caso de uma entrar por outro caminho.
  */
  const colors = Array.isArray(spec.colors) ? spec.colors : [];
  const roles = new Set(colors.map((entry) => entry.role));
  const scale = Array.isArray(spec.typeScale) ? spec.typeScale : [];

  return (
    roles.has('primary') &&
    roles.has('bgLight') &&
    roles.has('bgDark') &&
    Boolean(spec.typography?.display) &&
    Boolean(spec.typography?.body) &&
    scale.length >= 3
  );
}

/**
 * Visuais que ainda não têm imagem.
 *
 * Serve a dois propósitos: saber se a proposta está completa e saber o que
 * voltar a pedir quando uma geração falha. Devolve os visuais, não os nomes,
 * porque quem tenta outra vez precisa do `prompt` e do `format`.
 */
export function missingVisuals(
  spec: BrandIdentitySpec | null | undefined,
): BrandVisual[] {
  if (!spec || !Array.isArray(spec.visuals)) return [];
  return spec.visuals.filter((visual) => !visual.assetId);
}

/**
 * A proposta está COMPLETA?
 *
 * ────────────────────────────────────────────────────────────────────────────
 * Diferente de `isSpecReady`. Essa responde "o sistema dá para criar artes?",
 * e é verdadeira logo que o design system existe — antes das imagens. Esta
 * responde "o cliente já viu tudo o que pediu?", e exige as quatro peças.
 *
 * A distinção nasceu de um defeito concreto: o botão de aprovar acendia
 * assim que o design system ficava pronto, com as quatro molduras ainda
 * vazias. O cliente podia concluir o cadastro antes de a identidade visual
 * existir — e o que ele via no fim não era o que tinha pedido.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function isSpecComplete(spec: BrandIdentitySpec | null | undefined): boolean {
  if (!isSpecReady(spec)) return false;
  const visuals = Array.isArray(spec?.visuals) ? spec.visuals : [];
  return visuals.length > 0 && visuals.every((visual) => Boolean(visual.assetId));
}

export function approveSpec(spec: BrandIdentitySpec): BrandIdentitySpec {
  return { ...spec, status: 'aprovada', approvedAt: new Date().toISOString() };
}

/** Etiqueta curta da origem, para a interface. */
export const SOURCE_LABEL: Record<DecisionSource, string> = {
  cliente: 'definido por ti',
  manual: 'do teu manual',
  ia: 'sugestão nossa',
};
