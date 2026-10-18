/**
 * Migração da identidade guardada.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * A identidade é guardada numa coluna `jsonb` (Supabase) ou em IndexedDB
 * (modo local). Em nenhum dos dois o armazenamento valida a forma: o que foi
 * escrito por uma versão anterior da aplicação volta exactamente como
 * estava.
 *
 * Isso rebentou de forma concreta. Uma especificação gravada antes de
 * `typeScale` existir voltou sem esse campo, e `isSpecReady` leu
 * `spec.typeScale.length` num `undefined` — ecrã de erro no cadastro, com a
 * marca já criada e sem forma de avançar.
 *
 * Este módulo é a fronteira. Tudo o que entra na aplicação a partir do
 * armazenamento passa por aqui, e o que não se reconhece é descartado em vez
 * de propagado. Descartar uma proposta antiga custa ao cliente uma geração
 * nova; deixá-la entrar meio-formada rebenta em sítios imprevisíveis.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { isFormatId } from '@/lib/domain/catalog';
import type {
  Brand,
  BrandIdentitySpec,
  BrandMemory,
  BrandMemoryEvent,
  BrandMemoryRule,
  BrandStyleLearning,
  BrandStyleProfile,
  BrandStyleReference,
} from '@/lib/domain/types';
import { LIBRARY_LIMIT } from './library';
import { MEMORY_EVENT_LIMIT, MEMORY_RULE_LIMIT } from './memory';

/** Campos sem os quais a especificação não é utilizável. */
function hasUsableShape(value: unknown): value is BrandIdentitySpec {
  if (!value || typeof value !== 'object') return false;
  const spec = value as Partial<BrandIdentitySpec>;

  return (
    Array.isArray(spec.colors) &&
    spec.colors.length > 0 &&
    Boolean(spec.typography?.display) &&
    Boolean(spec.typography?.body) &&
    // Introduzidos depois da primeira versão: é o que distingue uma
    // especificação desta geração de uma anterior.
    Array.isArray(spec.typeScale) &&
    spec.typeScale.length > 0 &&
    Array.isArray(spec.visuals)
  );
}

/**
 * Devolve a especificação se for utilizável, ou `null`.
 *
 * Também preenche as listas opcionais que possam vir ausentes, para o resto
 * da aplicação nunca ter de defender-se contra `undefined`.
 */
export function migrateIdentitySpec(value: unknown): BrandIdentitySpec | null {
  if (!hasUsableShape(value)) return null;

  const spec = value as BrandIdentitySpec;

  return {
    ...spec,
    backgrounds: Array.isArray(spec.backgrounds) ? spec.backgrounds : [],
    fixedRules: Array.isArray(spec.fixedRules) ? spec.fixedRules : [],
    lockedSections: Array.isArray(spec.lockedSections) ? spec.lockedSections : [],
    /*
      Só os visuais que ainda existem.

      Uma especificação gravada quando havia quatro visuais volta com
      `aplicacao-clara`, `aplicacao-escura` e `textura` — géneros que a
      aplicação já não sabe desenhar nem gerar. Deixá-los passar punha três
      molduras mortas no ecrã e fazia `isSpecComplete` exigir imagens que
      nunca mais vão ser pedidas, com o botão de aprovar bloqueado para
      sempre.
    */
    visuals: spec.visuals
      .filter((visual) => visual?.kind === 'identidade')
      .map((visual) => ({
        ...visual,
        assetId: visual.assetId ?? null,
        stale: visual.stale ?? false,
      })),
    typography: {
      ...spec.typography,
      unavailable: Array.isArray(spec.typography.unavailable)
        ? spec.typography.unavailable
        : [],
    },
    direction: {
      ...spec.direction,
      avoid: Array.isArray(spec.direction?.avoid) ? spec.direction.avoid : [],
    },
  };
}

/**
 * Normaliza a marca que vem do armazenamento.
 *
 * Chamada no único ponto onde a marca entra na aplicação
 * (`SessionProvider`), para não haver dois sítios a decidir o que é uma
 * marca válida.
 */
export function migrateBrand(brand: Brand): Brand {
  return {
    ...brand,
    contacts: Array.isArray(brand.contacts) ? brand.contacts : [],
    identity: {
      ...brand.identity,
      spec: migrateIdentitySpec(brand.identity.spec),
      /*
        Cores de arranque de versões antigas não foram confirmadas por
        ninguém.

        Sem esta linha voltavam a ser enviadas à IA como decisão do cliente,
        e a proposta ficava presa a um azul, um creme e um laranja que
        ninguém escolheu — o bug que fez a identidade ignorar o logótipo.
      */
      colorsConfirmed: brand.identity.colorsConfirmed ?? false,
      styleLearning: migrateStyleLearning(brand.identity.styleLearning),
      memory: migrateMemory(brand.identity.memory),
    },
  };
}

/**
 * A memória da empresa. Ao contrário do estilo, uma memória meio-formada
 * não se descarta: o que tem de aproveitável fica, o resto é preenchido.
 * São meses de uso, e cada acontecimento é independente dos outros.
 */
function migrateMemory(value: unknown): BrandMemory | null {
  if (!value || typeof value !== 'object') return null;
  const memory = value as Partial<BrandMemory>;
  const text = (entry: unknown) => (typeof entry === 'string' ? entry : '');
  const kinds: BrandMemoryEvent['kind'][] = [
    'edicao',
    'outra-ideia',
    'melhoria',
    'descarga',
    'texto',
    'aprovada',
  ];

  return {
    enabled: memory.enabled !== false,
    events: Array.isArray(memory.events)
      ? memory.events
          .filter(
            (event): event is BrandMemoryEvent =>
              Boolean(event) && typeof event.detail === 'string' && kinds.includes(event.kind),
          )
          .slice(0, MEMORY_EVENT_LIMIT)
          .map((event) => ({
            id: text(event.id) || `mev_${event.at}`,
            kind: event.kind,
            at: text(event.at),
            projectId: typeof event.projectId === 'string' ? event.projectId : null,
            detail: event.detail,
          }))
      : [],
    rules: Array.isArray(memory.rules)
      ? memory.rules
          .filter(
            (rule): rule is BrandMemoryRule =>
              Boolean(rule) && typeof rule.text === 'string' && rule.text.trim().length > 0,
          )
          .slice(0, MEMORY_RULE_LIMIT)
          .map((rule) => ({
            id: text(rule.id) || `mrl_${rule.text.length}_${rule.createdAt}`,
            text: rule.text,
            source: rule.source === 'cliente' ? ('cliente' as const) : ('ia' as const),
            createdAt: text(rule.createdAt),
          }))
      : [],
    dismissed: Array.isArray(memory.dismissed)
      ? memory.dismissed.filter((entry): entry is string => typeof entry === 'string')
      : [],
    pending: typeof memory.pending === 'number' && memory.pending > 0 ? memory.pending : 0,
    learnedAt: typeof memory.learnedAt === 'string' ? memory.learnedAt : null,
  };
}

/**
 * O estilo aprendido, com a mesma política da especificação: o que não tem
 * forma utilizável é descartado. Um perfil sem resumo nem referências não
 * diz nada ao gerador — e meio perfil é pior do que nenhum.
 */
function migrateStyleLearning(value: unknown): BrandStyleLearning | null {
  if (!value || typeof value !== 'object') return null;
  const learning = value as Partial<BrandStyleLearning>;
  const profile = learning.profile as Partial<BrandStyleProfile> | undefined;
  if (!profile || typeof profile.summary !== 'string' || !profile.summary.trim()) return null;

  const text = (entry: unknown) => (typeof entry === 'string' ? entry : '');

  return {
    enabled: learning.enabled !== false,
    profile: {
      summary: profile.summary,
      composition: text(profile.composition),
      typography: text(profile.typography),
      color: text(profile.color),
      imagery: text(profile.imagery),
      graphics: text(profile.graphics),
      copy: text(profile.copy),
      logo: text(profile.logo),
      recurring: Array.isArray(profile.recurring)
        ? profile.recurring.filter((item): item is string => typeof item === 'string')
        : [],
    },
    /*
      A biblioteca. Eram no máximo duas artes, as do cadastro; passou a
      levar também as aprovadas na Kriar. As de antes chegam sem origem nem
      data, e são do cadastro — não havia outra forma de entrarem.
    */
    references: Array.isArray(learning.references)
      ? learning.references
          .filter(
            (reference): reference is BrandStyleReference =>
              Boolean(reference) && typeof reference.assetId === 'string',
          )
          .slice(0, LIBRARY_LIMIT)
          .map((reference) => ({
            assetId: reference.assetId,
            content: text(reference.content),
            why: text(reference.why),
            // As de antes eram só as duas escolhidas: todas eram destaque.
            featured: typeof reference.featured === 'boolean' ? reference.featured : true,
            width: typeof reference.width === 'number' ? reference.width : null,
            height: typeof reference.height === 'number' ? reference.height : null,
            source: reference.source === 'aprovada' ? ('aprovada' as const) : ('cadastro' as const),
            topics: Array.isArray(reference.topics)
              ? reference.topics.filter((topic): topic is string => typeof topic === 'string')
              : [],
            format: isFormatId(reference.format) ? reference.format : null,
            projectId: typeof reference.projectId === 'string' ? reference.projectId : null,
            fromAssetId: typeof reference.fromAssetId === 'string' ? reference.fromAssetId : null,
            addedAt: text(reference.addedAt) || text(learning.analysedAt),
          }))
      : [],
    analysedCount: typeof learning.analysedCount === 'number' ? learning.analysedCount : 0,
    consistency: text(learning.consistency),
    analysedAt: text(learning.analysedAt),
    producedBy: text(learning.producedBy),
  };
}
