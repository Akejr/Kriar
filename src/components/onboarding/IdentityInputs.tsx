'use client';

import * as React from 'react';
import { ChevronDown, FileText, Loader2, Plus, Sparkles } from 'lucide-react';
import { APP } from '@/config/app';
import type { Brand, IdentityHint, VisualPreference } from '@/lib/domain/types';
import { deriveAccent } from '@/lib/utils/color';
import { checkDocumentFile } from '@/lib/utils/files';
import { cn } from '@/lib/utils/cn';
import { ColorField } from '@/components/ui/ColorField';
import { Dropzone } from '@/components/ui/Dropzone';
import { Badge, Callout } from '@/components/ui/primitives';
import { LogoUploader } from '@/components/brand/LogoUploader';
import {
  IdentityGeneratePanel,
  type GenerateMode,
  type IdentityInputKey,
} from './IdentityGenerate';

const PREFERENCES: Array<{ id: VisualPreference; label: string }> = [
  { id: 'minimalista', label: 'Minimalista' },
  { id: 'elegante', label: 'Elegante' },
  { id: 'moderno', label: 'Moderno' },
  { id: 'institucional', label: 'Institucional' },
  { id: 'vibrante', label: 'Vibrante' },
];

type BrandColors = Brand['identity']['colors'];

/**
 * Coluna esquerda: o que o cliente fornece.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O logótipo já NÃO é o gatilho de tudo.
 *
 * Carregá-lo disparava a análise e a geração das imagens antes de o cliente
 * ter dito as cores, importado o manual ou escrito o que evitar. Agora
 * carregar o logótipo só o guarda e lê-lhe as cores — no browser, sem
 * pedido nenhum — para sugerir a paleta nos campos. A proposta sai do botão
 * no fundo desta coluna, quando o cliente decidir que tem tudo.
 *
 * As alterações sobem por funções separadas, e não por um `onBrandChange`
 * genérico, por uma razão concreta: só escrever uma cor a confirma. Antes,
 * qualquer alteração vinda daqui — carregar o logótipo incluído — marcava as
 * cores de arranque como escolha do cliente, e as cores lidas do logótipo
 * nunca chegavam a entrar.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function IdentityInputs({
  brand,
  accountId,
  extractedColors,
  extractionFailed,
  readingLogo,
  manualHints,
  manualBusy,
  manualError,
  onIdentityChange,
  onColorsChange,
  onLogoChange,
  onLogoFile,
  onManualFile,
  onPreferenceChange,
  onConstraintsChange,
  generate,
}: {
  brand: Brand;
  accountId: string;
  extractedColors: Array<{ hex: string; note: string }>;
  /** `true` quando a leitura de cores do logótipo não devolveu nada. */
  extractionFailed: boolean;
  /** A ler as cores do logótipo acabado de carregar. */
  readingLogo: boolean;
  manualHints: IdentityHint[];
  manualBusy: boolean;
  manualError: string | null;
  /** Alterações que não são cores: as versões do logótipo. */
  onIdentityChange: (patch: Partial<Brand['identity']>) => void;
  /** Escrever uma cor é o acto que a confirma como escolha do cliente. */
  onColorsChange: (patch: Partial<BrandColors>) => void;
  onLogoChange: (assetId: string | null) => void;
  onLogoFile: (file: File) => void;
  onManualFile: (file: File) => void;
  onPreferenceChange: (preference: VisualPreference | null) => void;
  onConstraintsChange: (value: string) => void;
  generate: {
    mode: GenerateMode;
    changes: IdentityInputKey[];
    busy: boolean;
    blockedReason: string | null;
    onGenerate: () => void;
  };
}) {
  const [extrasOpen, setExtrasOpen] = React.useState(false);
  const identity = brand.identity;
  const colorsChosen = Boolean(identity.colorsConfirmed);

  const manualColorHints = manualHints
    .filter((hint) => hint.kind === 'cor')
    .map((hint) => ({
      hex: hint.value,
      note: `${hint.source === 'explicito' ? 'no manual' : 'inferida'} · ${hint.origin}`,
    }));

  const suggestions = [...extractedColors, ...manualColorHints].slice(0, 6);

  /*
    De onde vêm as sugestões, dito com verdade.

    A fila junta as cores lidas do logótipo e as do manual, mas dizia sempre
    "Lido do teu logótipo". Ao voltar a esta etapa a leitura do logótipo já
    não está em memória e a fila mostra só as do manual — com o rótulo a
    atribuí-las ao logótipo.
  */
  const suggestionsSource =
    extractedColors.length > 0 && manualColorHints.length > 0
      ? 'Do teu logótipo e do manual'
      : extractedColors.length > 0
        ? 'Lido do teu logótipo'
        : 'Do teu manual';

  return (
    // `flex-1`: com pouco conteúdo, a coluna cresce até ao fundo e o bloco do
    // botão assenta lá em baixo em vez de ficar a meio do painel.
    <div className="flex flex-1 flex-col gap-3.5">
      <div>
        <h2 className="text-[14px] font-semibold tracking-tight text-fg">A tua identidade</h2>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-fg-muted">
          Junta o que tiveres. A proposta só é gerada quando carregares no botão, no fim
          desta coluna.
        </p>
      </div>

      {/* --- Logótipo ------------------------------------------------------ */}
      <section className="flex flex-col gap-2">
        <p className="text-[11.5px] font-medium text-fg-muted">Logótipo da marca</p>
        <LogoUploader
          accountId={accountId}
          assetId={identity.logoAssetId}
          kind="logo"
          title="Carregar logótipo"
          hint="PNG, SVG, WEBP ou JPG · até 8 MB"
          onChange={onLogoChange}
          onFileSelected={onLogoFile}
        />

        {!identity.logoAssetId ? (
          <p className="text-[10.5px] leading-relaxed text-fg-faint">
            Sem logótipo também dá: usamos o nome da empresa em texto, marcado como
            aplicação provisória.
          </p>
        ) : null}

        {readingLogo ? (
          <p role="status" className="flex items-center gap-1.5 text-[11px] text-fg-muted">
            <Loader2 className="size-3 animate-[kriar-spin_0.9s_linear_infinite]" aria-hidden />
            A ler as cores do logótipo…
          </p>
        ) : null}

        {/*
          Acontece quando o ficheiro não tem píxeis de marca que se leiam: um
          logótipo branco sobre transparente, um ficheiro quase todo vazio,
          um SVG que o browser não deixa ler. Diz o que fazer, em duas linhas
          — o texto anterior tinha três frases e repetia o título.

          ──────────────────────────────────────────────────────────────────
          Não diz "a preto e branco", como dizia. Não é verdade: um logótipo
          preto sobre branco lê-se como monocromático (`analyseLogoColors`)
          e o preto e o branco aparecem nos campos, sem aviso nenhum —
          confirmado no browser com um PNG assim. O caso que chega aqui é o
          logótipo branco sobre transparente, que é a versão que muita gente
          tem à mão, e é esse que o texto nomeia.
          ──────────────────────────────────────────────────────────────────
        */}
        {extractionFailed && !readingLogo ? (
          <Callout tone="warn" size="sm" role="status" title="Não encontrámos cores no logótipo">
            Acontece com logótipos brancos sobre fundo transparente. Escolhe as cores da marca
            nos campos abaixo — se tiveres o manual da marca, os códigos estão lá.
          </Callout>
        ) : null}

        {/* Versões opcionais, recolhidas: a maioria das empresas tem só uma. */}
        <button
          type="button"
          aria-expanded={extrasOpen}
          onClick={() => setExtrasOpen((value) => !value)}
          className="mt-0.5 flex items-center justify-between rounded-[9px] px-0.5 py-1 text-[11px] font-medium text-fg-faint transition-colors hover:text-fg-muted"
        >
          Versões para fundo claro e escuro
          <ChevronDown
            aria-hidden
            className={cn('size-3.5 transition-transform', extrasOpen && 'rotate-180')}
          />
        </button>

        {/*
          Rótulos curtos, porque a coluna é estreita.

          Diziam "Versão para fundo claro" e "Versão para fundo escuro", e na
          largura desta coluna os dois ficavam cortados em "Versão para
          fund…" — dois cartões com o mesmo texto, impossíveis de distinguir
          sem abrir. A palavra que os separa tem de caber.
        */}
        {extrasOpen ? (
          <div className="flex flex-col gap-2">
            <LogoUploader
              accountId={accountId}
              assetId={identity.logoForLightBgAssetId}
              kind="logo-light-bg"
              preview="light"
              title="Para fundo claro"
              onChange={(assetId) => onIdentityChange({ logoForLightBgAssetId: assetId })}
            />
            <LogoUploader
              accountId={accountId}
              assetId={identity.logoForDarkBgAssetId}
              kind="logo-dark-bg"
              preview="dark"
              title="Para fundo escuro"
              onChange={(assetId) => onIdentityChange({ logoForDarkBgAssetId: assetId })}
            />
          </div>
        ) : null}
      </section>

      {/* --- Cores --------------------------------------------------------- */}
      <section className="flex flex-col gap-2.5">
        {/* As sugestões ficam numa fila só, acima dos campos: repetidas em
            cada campo ocupavam três vezes o mesmo espaço. */}
        {suggestions.length > 0 ? (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[10.5px] text-fg-faint">
              <Sparkles className="size-3 shrink-0 text-neon" aria-hidden />
              {suggestionsSource} — confirma ou escreve os códigos exactos
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((suggestion) => (
                <span
                  key={`${suggestion.hex}-${suggestion.note}`}
                  title={`${suggestion.hex} — ${suggestion.note}`}
                  className="size-6 rounded-[6px] ring-1 ring-inset ring-white/15"
                  style={{ backgroundColor: suggestion.hex }}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/*
          As cores de arranque não são da empresa.

          Estão nos campos para o motor ter sempre hexadecimais válidos, mas
          não seguem no pedido enquanto o cliente não escolher (ver
          `colorsConfirmed`). Sem esta linha, o cliente via um azul e um
          creme nos campos e assumia que eram as cores que a proposta ia
          usar.
        */}
        {!colorsChosen && !extractionFailed ? (
          <p className="text-[11px] leading-relaxed text-fg-muted">
            Estas cores são só um ponto de partida. Escolhe as da marca ou carrega o
            logótipo para as lermos.
          </p>
        ) : null}

        <ColorField
          label="Cor principal"
          value={identity.colors.primary}
          onChange={(hex) => onColorsChange({ primary: hex })}
          suggestions={suggestions}
        />
        <ColorField
          label="Cor secundária"
          value={identity.colors.secondary}
          onChange={(hex) => onColorsChange({ secondary: hex })}
        />

        {/*
          A terceira cor não aparece por omissão.

          A maioria das marcas tem duas, e um campo vazio a dizer "Terceira
          cor" convida a inventar uma. Quem a tem, acrescenta-a — depois de
          escolher as duas primeiras: derivá-la das cores de arranque
          confirmava-as em silêncio como cores da empresa.
        */}
        {identity.colors.accent ? (
          <ColorField
            label="Terceira cor"
            optional
            value={identity.colors.accent}
            onChange={(hex) => onColorsChange({ accent: hex })}
            onClear={() => onColorsChange({ accent: null })}
          />
        ) : colorsChosen ? (
          <button
            type="button"
            onClick={() =>
              onColorsChange({
                accent: deriveAccent(
                  identity.colors.primary || '#16324F',
                  identity.colors.secondary || '#FFFFFF',
                ),
              })
            }
            className="flex items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-line-strong py-2 text-[11.5px] text-fg-faint transition-colors hover:border-neon/40 hover:text-neon"
          >
            <Plus className="size-3" aria-hidden />
            Acrescentar terceira cor
          </button>
        ) : null}
      </section>

      {/* --- Manual de marca ----------------------------------------------- */}
      <section className="flex flex-col gap-2">
        <p className="text-[12px] font-medium text-fg-muted">Tens um manual de marca?</p>
        <Dropzone
          compact
          accept={APP.uploads.acceptedDocumentMimes.join(',')}
          disabled={manualBusy}
          onFiles={(files) => {
            const file = files[0];
            if (!file) return;
            if (!checkDocumentFile(file).ok) return;
            onManualFile(file);
          }}
          title={manualBusy ? 'A analisar…' : 'Importar ficheiro'}
          hint="PDF até 10 MB"
        />

        {manualBusy ? (
          <p className="flex items-center gap-1.5 text-[11px] text-fg-muted">
            <Loader2 className="size-3 animate-[kriar-spin_0.9s_linear_infinite]" aria-hidden />
            A procurar cores e tipografias no documento…
          </p>
        ) : null}

        {manualError ? (
          <Callout tone="warn" size="sm" role="alert">
            {manualError}
          </Callout>
        ) : null}

        {manualHints.length > 0 ? (
          <div className="rounded-[10px] border border-line bg-ink-950/60 p-2.5">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-fg">
              <FileText className="size-3" aria-hidden />
              Encontrado no teu manual
            </p>
            <ul className="flex flex-col gap-1">
              {manualHints.slice(0, 6).map((hint) => (
                <li
                  key={`${hint.kind}-${hint.value}`}
                  className="flex items-center gap-1.5 text-[11px] text-fg-muted"
                >
                  <Badge tone={hint.source === 'explicito' ? 'neon' : 'neutral'}>
                    {hint.source === 'explicito' ? 'escrito' : 'inferido'}
                  </Badge>
                  <span className="truncate">
                    {hint.kind === 'cor' ? hint.value : `fonte ${hint.value}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* --- Preferência visual -------------------------------------------- */}
      <section className="flex flex-col gap-2">
        <p className="text-[12px] font-medium text-fg-muted">
          Preferência visual <span className="text-fg-faint">· opcional</span>
        </p>
        <div role="radiogroup" aria-label="Preferência visual" className="flex flex-wrap gap-1.5">
          {PREFERENCES.map((option) => {
            const selected = identity.visualPreference === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onPreferenceChange(selected ? null : option.id)}
                className={cn(
                  'rounded-[9px] border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors',
                  selected
                    ? 'border-neon/50 bg-neon/10 text-neon'
                    : 'border-line bg-ink-950/50 text-fg-muted hover:border-line-strong hover:text-fg',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <label
          htmlFor="identidade-restricoes"
          className="mt-1 text-[11.5px] text-fg-muted"
        >
          Há algo que devemos respeitar ou evitar?
        </label>
        <textarea
          id="identidade-restricoes"
          rows={2}
          maxLength={400}
          value={identity.constraints ?? ''}
          onChange={(event) => onConstraintsChange(event.target.value)}
          placeholder="Ex.: nunca usar o logótipo sobre fotografias; evitar vermelho."
          className="w-full resize-none rounded-[10px] border border-line bg-ink-950/70 px-3 py-2 text-[12px] leading-relaxed text-fg outline-none transition-colors placeholder:text-fg-faint hover:border-line-strong focus:border-neon/60"
        />
      </section>

      {/* --- Acção --------------------------------------------------------- */}
      <IdentityGeneratePanel brand={brand} manualHints={manualHints} {...generate} />
    </div>
  );
}
