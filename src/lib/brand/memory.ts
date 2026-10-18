/**
 * A memória da empresa.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O uso diz o que a empresa prefere melhor do que um formulário: o que o
 * cliente pede numa edição por zonas, a ideia que recusa, a arte que
 * descarrega, o texto que reescreve. Cada uma destas coisas fica registada
 * como uma frase, e de vez em quando um modelo de texto lê as frases e
 * escreve regras curtas — "prefere fotografia real a ilustração", "o
 * website aparece sempre".
 *
 * As regras entram na ideia e na arte. Ficam à vista na página da marca,
 * porque uma regra aprendida pode estar errada, e o cliente tem de a poder
 * apagar ou corrigir. Uma regra apagada não volta.
 *
 * Funções puras: o browser regista, o servidor só resume.
 * ──────────────────────────────────────────────────────────────────────────
 */
import type { BrandMemory, BrandMemoryEvent, BrandMemoryRule } from '@/lib/domain/types';
import { newId } from '@/lib/utils/id';

/** Acontecimentos guardados. Os mais antigos saem. */
export const MEMORY_EVENT_LIMIT = 60;
/** Regras, no máximo. Mais do que isto, ninguém as lê — nem o modelo. */
export const MEMORY_RULE_LIMIT = 12;
/** Regras apagadas que a IA não volta a propor. */
const DISMISSED_LIMIT = 40;
/** Acontecimentos novos que justificam uma leitura. */
export const MEMORY_LEARN_EVERY = 4;
/** Tamanho de uma regra. */
export const MEMORY_RULE_MAX = 160;

export function emptyMemory(): BrandMemory {
  return { enabled: true, events: [], rules: [], dismissed: [], pending: 0, learnedAt: null };
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Uma frase aparada, sem cortar palavras. */
export function clipRule(text: string, max = MEMORY_RULE_MAX): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const word = cut.lastIndexOf(' ');
  return `${(word > 0 ? cut.slice(0, word) : cut).trim()}…`;
}

/**
 * Regista um acontecimento.
 *
 * Um acontecimento igual ao anterior não conta duas vezes: descarregar a
 * mesma arte três vezes seguidas é uma preferência, não três.
 */
export function appendMemoryEvent(
  memory: BrandMemory | null | undefined,
  event: Omit<BrandMemoryEvent, 'id' | 'at'> & { at?: string },
): BrandMemory {
  const base = memory ?? emptyMemory();
  const detail = clipRule(event.detail, 280);
  if (!detail) return base;
  if (base.events[0]?.detail === detail) return base;

  const entry: BrandMemoryEvent = {
    id: newId('mev'),
    kind: event.kind,
    at: event.at ?? new Date().toISOString(),
    projectId: event.projectId,
    detail,
  };
  return {
    ...base,
    events: [entry, ...base.events].slice(0, MEMORY_EVENT_LIMIT),
    pending: base.pending + 1,
  };
}

/** Há acontecimentos novos que chegue para valer uma leitura? */
export function memoryNeedsLearning(memory: BrandMemory | null | undefined): boolean {
  return Boolean(memory?.enabled && memory.pending >= MEMORY_LEARN_EVERY);
}

/** As regras que seguem para os prompts. Vazio com a memória desligada. */
export function activeMemoryRules(memory: BrandMemory | null | undefined, max = 10): string[] {
  if (!memory?.enabled) return [];
  // As do cliente primeiro: foram escritas por quem sabe.
  const ordered = [
    ...memory.rules.filter((rule) => rule.source === 'cliente'),
    ...memory.rules.filter((rule) => rule.source !== 'cliente'),
  ];
  return ordered
    .map((rule) => clipRule(rule.text))
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Aplica as regras que a leitura devolveu.
 *
 * As do cliente ficam como estão. As da IA são substituídas pelas novas —
 * a leitura vê as regras antigas e reescreve o conjunto —, sem repetir uma
 * do cliente nem uma que ele apagou.
 */
export function applyLearnedRules(
  memory: BrandMemory | null | undefined,
  learned: string[],
  /**
   * Quantos acontecimentos novos a leitura viu. Os que chegaram enquanto ela
   * corria continuam por ler.
   */
  consumed: number,
  at = new Date().toISOString(),
): BrandMemory {
  const base = memory ?? emptyMemory();
  const client = base.rules.filter((rule) => rule.source === 'cliente');
  const blocked = new Set([...client.map((rule) => fold(rule.text)), ...base.dismissed.map(fold)]);

  const fresh: BrandMemoryRule[] = [];
  for (const text of learned) {
    const clean = clipRule(text);
    const key = fold(clean);
    if (!key || blocked.has(key)) continue;
    blocked.add(key);
    fresh.push({ id: newId('mrl'), text: clean, source: 'ia', createdAt: at });
  }

  return {
    ...base,
    rules: [...client, ...fresh].slice(0, MEMORY_RULE_LIMIT),
    pending: Math.max(0, base.pending - consumed),
    learnedAt: at,
  };
}

/** Apaga uma regra. Se era da IA, fica na lista das que não voltam. */
export function dismissMemoryRule(memory: BrandMemory, ruleId: string): BrandMemory {
  const rule = memory.rules.find((entry) => entry.id === ruleId);
  if (!rule) return memory;
  return {
    ...memory,
    rules: memory.rules.filter((entry) => entry.id !== ruleId),
    dismissed:
      rule.source === 'ia'
        ? [rule.text, ...memory.dismissed].slice(0, DISMISSED_LIMIT)
        : memory.dismissed,
  };
}

/**
 * Escreve uma regra do cliente — nova, ou a correcção de uma existente.
 *
 * Corrigir uma regra da IA torna-a do cliente: a partir daí é ele que
 * responde por ela, e a próxima leitura não lhe toca.
 */
export function writeClientRule(
  memory: BrandMemory | null | undefined,
  ruleId: string | null,
  text: string,
): BrandMemory {
  const base = memory ?? emptyMemory();
  const clean = clipRule(text);
  if (!clean) {
    return ruleId ? dismissMemoryRule(base, ruleId) : base;
  }
  if (ruleId && base.rules.some((rule) => rule.id === ruleId)) {
    return {
      ...base,
      rules: base.rules.map((rule) =>
        rule.id === ruleId ? { ...rule, text: clean, source: 'cliente' as const } : rule,
      ),
    };
  }
  const rule: BrandMemoryRule = {
    id: newId('mrl'),
    text: clean,
    source: 'cliente',
    createdAt: new Date().toISOString(),
  };
  return { ...base, rules: [rule, ...base.rules].slice(0, MEMORY_RULE_LIMIT) };
}
