'use client';

import * as React from 'react';
import { Check, PenLine, RefreshCw, Sparkles } from 'lucide-react';
import { APP } from '@/config/app';
import { styleSummaryText } from '@/lib/brand/styleLearning';
import type { Brand, BrandIdentitySpec, IdentityHint } from '@/lib/domain/types';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/primitives';

/**
 * Gerar a identidade: o resumo do que vai ser usado e o botão.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * A proposta deixou de nascer sozinha.
 *
 * Carregar o logótipo disparava a análise e a geração das imagens no mesmo
 * gesto. Parecia poupar um clique, mas o cliente ainda não tinha dito as
 * cores, não tinha importado o manual nem escrito o que evitar — e recebia
 * uma proposta feita sem nada disso, paga, a ocupar o ecrã enquanto ele
 * continuava a preencher. A queixa foi directa: "a identidade da marca gera
 * sozinha. deixe o cliente preencher tudo e depois você gera".
 *
 * Agora o cliente junta tudo, vê aqui o que vai entrar, e só o botão gera.
 * Depois de haver proposta, mexer nos dados também não gera nada: o botão
 * passa a dizer o que mudou e oferece "Gerar de novo com estas alterações".
 * ──────────────────────────────────────────────────────────────────────────
 */

// --- O que entra no pedido --------------------------------------------------

/** Cada dado que a proposta usa e que o cliente pode mudar. */
export type IdentityInputKey =
  | 'empresa'
  | 'logotipo'
  | 'cores'
  | 'manual'
  | 'preferencia'
  | 'notas'
  | 'estilo';

export type IdentityInputsSnapshot = Record<IdentityInputKey, string>;

const INPUT_KEYS: IdentityInputKey[] = [
  'empresa',
  'logotipo',
  'cores',
  'manual',
  'preferencia',
  'notas',
  'estilo',
];

/** Como cada dado mudado aparece na lista de alterações. */
const CHANGE_LABEL: Record<IdentityInputKey, string> = {
  empresa: 'Dados da empresa',
  logotipo: 'Logótipo',
  cores: 'Cores',
  manual: 'Manual da marca',
  preferencia: 'Preferência visual',
  notas: 'O que evitar',
  estilo: 'Estilo das artes',
};

/**
 * Os dados que seguem para `/api/brand/identity`, um a um, em texto.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Só o que muda a proposta. As versões do logótipo para fundo claro e
 * escuro ficam de fora de propósito: não vão no pedido, e a proposta já as
 * desenha ao vivo nas aplicações do logótipo. Pedir para gerar de novo por
 * causa delas seria pagar uma proposta igual.
 *
 * As cores só contam quando são do cliente (`colorsConfirmed`): as de
 * arranque não seguem no pedido, por isso mudá-las não muda nada.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function snapshotInputs(brand: Brand, manualHints: IdentityHint[]): IdentityInputsSnapshot {
  const identity = brand.identity;
  return {
    empresa: [brand.company.name.trim(), brand.company.segment, brand.company.description.trim()].join(
      '|',
    ),
    logotipo: identity.logoAssetId ?? '',
    cores: identity.colorsConfirmed
      ? [identity.colors.primary, identity.colors.secondary, identity.colors.accent ?? '']
          .join('|')
          .toUpperCase()
      : '',
    manual: manualHints
      .map((hint) => `${hint.kind}:${hint.value.toUpperCase()}`)
      .sort()
      .join('|'),
    preferencia: identity.visualPreference ?? '',
    notas: (identity.constraints ?? '').trim(),
    // O mesmo texto, com o mesmo limite, que segue no pedido.
    estilo: styleSummaryText(identity.styleLearning, 1400),
  };
}

/** O que mudou desde a última proposta. Vazio quando não há com que comparar. */
export function changedInputs(
  before: IdentityInputsSnapshot | null,
  now: IdentityInputsSnapshot,
): IdentityInputKey[] {
  if (!before) return [];
  return INPUT_KEYS.filter((key) => (before[key] ?? '') !== now[key]);
}

// --- A última proposta, lembrada --------------------------------------------

/*
  Guardada por separador, não na marca.

  ──────────────────────────────────────────────────────────────────────────
  O ecrã sai da memória quando o cliente volta às artes, e é exactamente aí
  que o estilo aprendido pode mudar. Sem guardar a fotografia dos dados, ao
  regressar a proposta parecia actual quando não era.

  `sessionStorage` e não a marca: é uma ajuda do ecrã, não um dado da
  empresa, e não justifica mudar o modelo de dados que o Supabase grava. A
  chave leva a versão da proposta — uma proposta nova invalida a anterior.
  ──────────────────────────────────────────────────────────────────────────
*/
const baselineKey = (brandId: string) => `${APP.slug}.identidade.${brandId}`;

export function readBaseline(
  brandId: string,
  spec: BrandIdentitySpec | null,
): IdentityInputsSnapshot | null {
  if (!spec || typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(baselineKey(brandId));
    const stored = raw ? JSON.parse(raw) : null;
    if (stored?.specId === spec.id && stored?.version === spec.version && stored?.inputs) {
      return stored.inputs as IdentityInputsSnapshot;
    }
  } catch {
    // Sem armazenamento (modo privado) ou registo ilegível: compara-se com o actual.
  }
  return null;
}

export function writeBaseline(
  brandId: string,
  spec: BrandIdentitySpec,
  inputs: IdentityInputsSnapshot,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      baselineKey(brandId),
      JSON.stringify({ specId: spec.id, version: spec.version, inputs }),
    );
  } catch {
    // A ajuda perde-se ao fechar o separador; a proposta não.
  }
}

// --- Resumo -----------------------------------------------------------------

type SummaryItem = {
  key: string;
  label: string;
  /** Amostras de cor no lugar do visto. */
  swatches?: string[];
  /** `true` quando é a IA que vai propor, não algo que o cliente deu. */
  proposed?: boolean;
};

/** O que vai entrar na proposta, em etiquetas curtas. Só o que existe. */
function summaryItems(brand: Brand, manualHints: IdentityHint[]): SummaryItem[] {
  const identity = brand.identity;
  const items: SummaryItem[] = [{ key: 'empresa', label: 'Dados da empresa' }];

  if (identity.logoAssetId) {
    const versions = [identity.logoForLightBgAssetId, identity.logoForDarkBgAssetId].filter(
      Boolean,
    ).length;
    items.push({
      key: 'logotipo',
      label:
        versions > 0
          ? `Logótipo + ${versions} ${versions === 1 ? 'versão' : 'versões'}`
          : 'Logótipo',
    });
  }

  if (identity.colorsConfirmed) {
    const swatches = [identity.colors.primary, identity.colors.secondary, identity.colors.accent]
      .filter((hex): hex is string => Boolean(hex));
    items.push({ key: 'cores', label: `${swatches.length} cores`, swatches });
  } else if (identity.logoAssetId) {
    // Sem cores escolhidas, a proposta lê-as do logótipo.
    items.push({ key: 'cores', label: 'Cores a propor', proposed: true });
  }

  if (manualHints.length > 0) {
    items.push({
      key: 'manual',
      label: `Manual · ${manualHints.length} ${manualHints.length === 1 ? 'pista' : 'pistas'}`,
    });
  }

  if (identity.visualPreference) {
    const value = identity.visualPreference;
    items.push({ key: 'preferencia', label: value.charAt(0).toUpperCase() + value.slice(1) });
  }

  if ((identity.constraints ?? '').trim()) {
    items.push({ key: 'notas', label: 'O que evitar' });
  }

  if (styleSummaryText(identity.styleLearning, 1400)) {
    items.push({ key: 'estilo', label: 'Estilo das tuas artes' });
  }

  return items;
}

const CHIP =
  'inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-ink-950/60 px-2 py-[3px] text-[10.5px] leading-tight text-fg-muted';

/**
 * `primeira` — ainda não há proposta;
 * `alterado` — há, mas o cliente mudou dados depois dela;
 * `igual` — há, e os dados são os mesmos com que foi feita.
 */
export type GenerateMode = 'primeira' | 'alterado' | 'igual';

/**
 * O bloco do fim da coluna dos dados.
 *
 * Fica preso ao fundo da coluna enquanto ela rola: o cliente vai
 * preenchendo e o botão está sempre à vista, com o resumo logo por cima.
 *
 * `-bottom-3.5` e não `bottom-0`: um elemento `sticky` cola-se à caixa de
 * conteúdo da coluna, não à aresta dela, e a coluna tem 14 px de
 * enchimento. Com `bottom-0` sobrava essa faixa por baixo do bloco, e o
 * que rolava por trás — o "PDF até 10 MB", a borda tracejada do manual —
 * aparecia lá, cortado, debaixo do botão.
 */
export function IdentityGeneratePanel({
  brand,
  manualHints,
  mode,
  changes,
  busy,
  blockedReason,
  onGenerate,
}: {
  brand: Brand;
  manualHints: IdentityHint[];
  mode: GenerateMode;
  changes: IdentityInputKey[];
  busy: boolean;
  /** Porque é que ainda não se pode gerar, numa linha. `null` quando se pode. */
  blockedReason: string | null;
  onGenerate: () => void;
}) {
  const helperId = React.useId();
  const enabled = !busy && !blockedReason;
  const items = mode === 'primeira' ? summaryItems(brand, manualHints) : [];

  // O botão já diz "A gerar…"; repeti-lo por baixo era ruído.
  const helper = busy
    ? 'O progresso aparece ao lado.'
    : (blockedReason ??
      (mode === 'primeira'
        ? 'Demora cerca de um minuto e meio.'
        : 'O que ajustaste à mão fica como está.'));

  return (
    <div className="sticky -bottom-3.5 z-10 -mx-3.5 -mb-3.5 mt-auto border-t border-line bg-ink-900/95 px-3.5 pb-3.5 pt-3 backdrop-blur-sm">
      {mode === 'primeira' ? (
        <>
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
            Vamos usar
          </p>
          <ul aria-label="O que vai entrar na proposta" className="mb-3 flex flex-wrap gap-1">
            {items.map((item) => (
              <li key={item.key} className={CHIP}>
                {item.swatches ? (
                  <span aria-hidden className="flex shrink-0 pl-1">
                    {/*
                      O anel escuro separa as amostras sobrepostas; a sombra
                      interior dá-lhes contorno. Sem ela, um preto ou um
                      grafite — a cor de muitos logótipos — desaparecia no
                      fundo da etiqueta e "2 cores" mostrava uma.
                    */}
                    {item.swatches.map((hex) => (
                      <span
                        key={hex}
                        className="-ml-1 size-2.5 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)] ring-1 ring-ink-950"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </span>
                ) : item.proposed ? (
                  <Sparkles aria-hidden className="size-2.5 shrink-0 text-fg-muted" />
                ) : (
                  <Check aria-hidden className="size-2.5 shrink-0 text-neon" />
                )}
                <span className="truncate">{item.label}</span>
              </li>
            ))}
          </ul>
        </>
      ) : mode === 'alterado' ? (
        <>
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
            Mudaste desde a proposta
          </p>
          <ul aria-label="O que mudou desde a proposta" className="mb-3 flex flex-wrap gap-1">
            {changes.map((key) => (
              <li key={key} className={CHIP}>
                <PenLine aria-hidden className="size-2.5 shrink-0 text-neon" />
                <span className="truncate">{CHANGE_LABEL[key]}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mb-2.5 text-[11px] leading-relaxed text-fg-muted">
          A proposta ao lado usa estes dados. Nada muda até voltares a gerar.
        </p>
      )}

      <Button
        variant={mode === 'igual' ? 'outline' : 'primary'}
        size={mode === 'igual' ? 'md' : 'lg'}
        block
        loading={busy}
        disabled={!enabled}
        aria-describedby={helperId}
        onClick={onGenerate}
        className={enabled && mode !== 'igual' ? 'glow-neon' : undefined}
      >
        {/*
          Sem ícone na primeira geração, e "A gerar…" enquanto gera.

          ──────────────────────────────────────────────────────────────────
          "Gerar a identidade da marca" ocupa quase toda a largura do botão
          na coluna de 18,5 rem. Com o ícone ao lado não cabia: o botão não
          parte a linha, e quem cedia era o SVG — encolhia até um risco de
          quatro píxeis, que parecia sujidade no botão. O indicador de
          carregamento não encolhe, e empurrava o texto para dentro do
          enchimento. O brilho já diz qual é a acção principal; o ícone não
          fazia falta. Durante a geração, o rótulo curto deixa lugar ao
          indicador, e a linha por baixo diz onde ver o progresso.
          ──────────────────────────────────────────────────────────────────
        */}
        {busy || mode === 'primeira' ? null : (
          <RefreshCw className="size-4 shrink-0" aria-hidden />
        )}
        {busy ? (
          'A gerar…'
        ) : mode === 'primeira' ? (
          'Gerar a identidade da marca'
        ) : mode === 'alterado' ? (
          // Não cabe numa linha na largura da coluna. Em duas, com a letra
          // do botão grande, lê-se melhor do que cortada.
          <span className="whitespace-normal text-left text-[13.5px] leading-[1.2]">
            Gerar de novo com estas alterações
          </span>
        ) : (
          'Gerar outra proposta'
        )}
      </Button>

      <p
        id={helperId}
        className={cn(
          'mt-1.5 text-center text-[11px] leading-relaxed',
          blockedReason && !busy ? 'text-fg' : 'text-fg-muted',
        )}
      >
        {helper}
      </p>
    </div>
  );
}
