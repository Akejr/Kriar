'use client';

import * as React from 'react';
import { FileText, Info, Sparkles, Wand2 } from 'lucide-react';
import { APP } from '@/config/app';
import { extractDominantColors } from '@/lib/brand/extractColors';
import { getBackend } from '@/lib/data';
import { registerAsset } from '@/lib/data/assetCache';
import { FONT_CATALOG, getFont, type FontId } from '@/lib/fontCatalog';
import type { Brand, IdentityHint } from '@/lib/domain/types';
import { cn } from '@/lib/utils/cn';
import { deriveAccent } from '@/lib/utils/color';
import { checkDocumentFile, checkImageFile } from '@/lib/utils/files';
import { ColorField } from '@/components/ui/ColorField';
import { Dropzone } from '@/components/ui/Dropzone';
import {
  Badge,
  Button,
  Callout,
  Field,
  Select,
  Spinner,
} from '@/components/ui/primitives';
import { LogoUploader } from './LogoUploader';

type Mode = 'manual' | 'importado';

type PdfHintsResponse = {
  ok: boolean;
  fileName?: string;
  error?: string;
  hints?: {
    fonts: Array<{ name: string; supported: FontId | null }>;
    explicitColors: Array<{ hex: string; count: number }>;
    inferredColors: Array<{ hex: string; count: number }>;
    pages: number | null;
    notes: string[];
  };
};

export function IdentityFields({
  brand,
  onChange,
  accountId,
}: {
  brand: Brand;
  onChange: (next: Brand) => void;
  accountId: string;
}) {
  const [mode, setMode] = React.useState<Mode>(brand.identity.setupMode);
  const [hints, setHints] = React.useState<IdentityHint[]>(
    brand.identity.importReport?.hints ?? [],
  );
  const [sourceFiles, setSourceFiles] = React.useState<string[]>(
    brand.identity.importReport?.files ?? [],
  );
  const [analysing, setAnalysing] = React.useState(false);
  const [analysisError, setAnalysisError] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<string[]>([]);

  const identity = brand.identity;

  const updateIdentity = (patch: Partial<Brand['identity']>) =>
    onChange({ ...brand, identity: { ...identity, ...patch } });

  const setColors = (patch: Partial<Brand['identity']['colors']>) =>
    updateIdentity({ colors: { ...identity.colors, ...patch } });

  function registerHints(next: IdentityHint[], files: string[], extraNotes: string[]) {
    const merged = [...hints, ...next].filter(
      (hint, index, all) =>
        all.findIndex((other) => other.kind === hint.kind && other.value === hint.value) === index,
    );
    setHints(merged);
    const allFiles = [...new Set([...sourceFiles, ...files])];
    setSourceFiles(allFiles);
    setNotes((current) => [...new Set([...current, ...extraNotes])]);
    updateIdentity({
      setupMode: 'importado',
      importReport: {
        at: new Date().toISOString(),
        files: allFiles,
        hints: merged,
        usedAi: false,
      },
    });
  }

  // --- Manual de marca em PDF ---------------------------------------------
  async function handleManual(files: File[]) {
    const file = files[0];
    if (!file) return;
    const check = checkDocumentFile(file);
    if (!check.ok) {
      setAnalysisError(check.reason);
      return;
    }

    setAnalysisError(null);
    setAnalysing(true);
    try {
      // Guardamos o ficheiro mesmo que a análise não encontre nada: a
      // configuração manual continua possível e o manual fica associado.
      await getBackend().uploadAsset({
        accountId,
        kind: 'brand-manual',
        file,
        name: file.name,
      });

      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/brand/import', { method: 'POST', body: form });
      const data: PdfHintsResponse = await response.json();

      if (!data.ok || !data.hints) {
        setAnalysisError(data.error ?? 'Não conseguimos analisar este PDF.');
        registerHints([], [file.name], [
          'O PDF foi guardado, mas não foi possível extrair informação. Configura manualmente.',
        ]);
        return;
      }

      const found: IdentityHint[] = [
        ...data.hints.fonts.map((font) => ({
          kind: 'fonte' as const,
          value: font.name,
          source: 'explicito' as const,
          origin: file.name,
          detail: font.supported
            ? `Disponível na lista: ${getFont(font.supported).label}`
            : 'Não está na nossa lista de tipografias',
        })),
        ...data.hints.explicitColors.map((color) => ({
          kind: 'cor' as const,
          value: color.hex,
          source: 'explicito' as const,
          origin: file.name,
          detail: 'Código escrito no documento',
        })),
        ...data.hints.inferredColors.map((color) => ({
          kind: 'cor' as const,
          value: color.hex,
          source: 'inferido' as const,
          origin: file.name,
          detail: `Usada ${color.count}× em elementos do documento`,
        })),
      ];

      registerHints(found, [file.name], data.hints.notes);
    } catch (cause) {
      setAnalysisError(
        cause instanceof Error ? cause.message : 'Não foi possível enviar o ficheiro.',
      );
    } finally {
      setAnalysing(false);
    }
  }

  // --- Imagens de referência ----------------------------------------------
  async function handleReferences(files: File[]) {
    const accepted = files.filter((file) => checkImageFile(file, 'logo').ok);
    if (accepted.length === 0) {
      setAnalysisError('Nenhum dos ficheiros é uma imagem válida.');
      return;
    }
    setAnalysisError(null);
    setAnalysing(true);
    try {
      const found: IdentityHint[] = [];
      for (const file of accepted) {
        const asset = await getBackend().uploadAsset({
          accountId,
          kind: 'reference',
          file,
          name: file.name,
        });
        const url = await getBackend().resolveAssetUrl(asset);
        registerAsset(asset, url);

        const colors = await extractDominantColors(file, 3);
        for (const color of colors) {
          found.push({
            kind: 'cor',
            value: color.hex,
            source: 'inferido',
            origin: file.name,
            detail: `${Math.round(color.share * 100)}% dos píxeis com cor`,
          });
        }
      }
      registerHints(
        found,
        accepted.map((file) => file.name),
        found.length === 0
          ? ['Não conseguimos extrair cores destas imagens.']
          : ['As cores das imagens são deduzidas: confirma antes de guardar.'],
      );
    } catch (cause) {
      setAnalysisError(
        cause instanceof Error ? cause.message : 'Não foi possível analisar as imagens.',
      );
    } finally {
      setAnalysing(false);
    }
  }

  const colorHints = hints.filter((hint) => hint.kind === 'cor');
  const fontHints = hints.filter((hint) => hint.kind === 'fonte');
  const colorSuggestions = colorHints.map((hint) => ({
    hex: hint.value,
    note: `${hint.source === 'explicito' ? 'encontrado' : 'inferido'} · ${hint.origin}`,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Selector de método */}
      <div
        role="radiogroup"
        aria-label="Como queres configurar a identidade visual"
        className="grid gap-2 sm:grid-cols-2"
      >
        {(
          [
            {
              id: 'manual' as Mode,
              label: 'Configurar manualmente',
              hint: 'Carregas o logótipo e escolhes as cores.',
              icon: <Wand2 className="size-4" aria-hidden />,
            },
            {
              id: 'importado' as Mode,
              label: 'Importar identidade visual',
              hint: 'Enviamos o manual de marca e procuramos cores e tipografias.',
              icon: <FileText className="size-4" aria-hidden />,
            },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={mode === option.id}
            onClick={() => setMode(option.id)}
            className={cn(
              'flex items-start gap-3 rounded-[12px] border px-3.5 py-3 text-left transition-colors',
              mode === option.id
                ? 'border-neon/60 bg-neon/10'
                : 'border-line bg-ink-950 hover:border-line-strong hover:bg-ink-800',
            )}
          >
            <span className={mode === option.id ? 'mt-0.5 text-neon' : 'mt-0.5 text-fg-muted'}>
              {option.icon}
            </span>
            <span>
              <span
                className={cn(
                  'block text-[13px] font-medium',
                  mode === option.id ? 'text-neon' : 'text-fg',
                )}
              >
                {option.label}
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-fg-muted">
                {option.hint}
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* Importação */}
      {mode === 'importado' ? (
        <div className="flex flex-col gap-3 rounded-[14px] border border-line bg-ink-900 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Dropzone
              compact
              accept={APP.uploads.acceptedDocumentMimes.join(',')}
              onFiles={handleManual}
              disabled={analysing}
              title="Carregar manual de marca"
              hint="PDF até 12 MB"
            />
            <Dropzone
              compact
              multiple
              accept={APP.uploads.acceptedLogoMimes.join(',')}
              onFiles={handleReferences}
              disabled={analysing}
              title="Carregar logótipos e referências"
              hint="PNG, SVG, WEBP ou JPG"
            />
          </div>

          {analysing ? <Spinner label="A analisar os ficheiros…" /> : null}

          {analysisError ? <Callout tone="danger">{analysisError}</Callout> : null}

          <Callout tone="info" title="Como é feita a análise">
            Lemos o ficheiro directamente: nomes de tipografias embebidas no PDF e códigos de cor
            presentes no documento. Não há reconhecimento visual de design, e não garantimos
            identificação perfeita. Confirma e corrige tudo antes de guardar.
          </Callout>

          {hints.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-fg-faint">
                  O que encontrámos
                </p>
                <div className="flex flex-col gap-2">
                  {colorHints.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {colorHints.map((hint) => (
                        <span
                          key={`${hint.value}-${hint.origin}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ink-950 py-1 pl-1 pr-2.5 text-[11px]"
                          title={`${hint.value} — ${hint.detail ?? ''} (${hint.origin})`}
                        >
                          <span
                            aria-hidden
                            className="size-4 rounded-full border border-line-strong"
                            style={{ backgroundColor: hint.value }}
                          />
                          <span className="font-mono text-fg">{hint.value}</span>
                          <Badge tone={hint.source === 'explicito' ? 'neon' : 'neutral'}>
                            {hint.source === 'explicito' ? 'encontrado' : 'inferido'}
                          </Badge>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {fontHints.length > 0 ? (
                    <ul className="flex flex-col gap-1.5">
                      {fontHints.map((hint) => {
                        const match = FONT_CATALOG.find(
                          (font) =>
                            hint.detail?.includes(font.label) ||
                            font.label.toLowerCase() === hint.value.toLowerCase(),
                        );
                        return (
                          <li
                            key={`${hint.value}-${hint.origin}`}
                            className="flex flex-wrap items-center gap-2 rounded-[10px] border border-line bg-ink-950 px-2.5 py-1.5 text-[12px]"
                          >
                            <span className="font-medium text-fg">{hint.value}</span>
                            <Badge tone="neon">encontrado</Badge>
                            {match ? (
                              <>
                                <span className="text-fg-muted">→ {match.label}</span>
                                <span className="ml-auto flex gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateIdentity({ fontDisplay: match.id })}
                                  >
                                    Usar em títulos
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => updateIdentity({ fontBody: match.id })}
                                  >
                                    Usar em texto
                                  </Button>
                                </span>
                              </>
                            ) : (
                              <span className="ml-auto text-[11.5px] text-fg-muted">
                                Não está na nossa lista
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              </div>

              {notes.length > 0 ? (
                <Callout tone="warn">
                  <ul className="flex flex-col gap-1">
                    {notes.map((note) => (
                      <li key={note} className="flex items-start gap-1.5">
                        <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
                        {note}
                      </li>
                    ))}
                  </ul>
                </Callout>
              ) : null}

              <p className="text-[12px] text-fg-muted">
                Toca numa cor abaixo de cada campo para a aplicar. Podes sempre escrever o código
                à mão.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/*
        Logótipos lado a lado.

        Eram três linhas — o principal sozinho, as duas versões por baixo —
        e, com as cores e a tipografia, a identidade ocupava mais de um ecrã.
        Em ecrãs largos ficam os três numa linha; até lá, o principal tem a
        linha toda e as duas versões partilham a de baixo. Numa coluna de um
        terço, a miniatura, o título e o aviso ainda cabem; mais estreito, não.
      */}
      <div className="flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold text-fg">Logótipo</h3>
        <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <LogoUploader
              accountId={accountId}
              kind="logo"
              assetId={identity.logoAssetId}
              onChange={(assetId) => updateIdentity({ logoAssetId: assetId })}
              title="Logótipo principal"
              onFileSelected={async (file) => {
                // O logótipo é a melhor fonte de cores da marca quando não há manual.
                const colors = await extractDominantColors(file, 3).catch(() => []);
                if (colors.length === 0) return;
                registerHints(
                  colors.map((color) => ({
                    kind: 'cor' as const,
                    value: color.hex,
                    source: 'inferido' as const,
                    origin: file.name,
                    detail: `${Math.round(color.share * 100)}% dos píxeis com cor`,
                  })),
                  [file.name],
                  [],
                );
              }}
            />
          </div>
          <LogoUploader
            accountId={accountId}
            kind="logo-light-bg"
            preview="light"
            assetId={identity.logoForLightBgAssetId}
            onChange={(assetId) => updateIdentity({ logoForLightBgAssetId: assetId })}
            title="Versão para fundos claros"
            hint="Opcional. Normalmente a versão escura."
          />
          <LogoUploader
            accountId={accountId}
            kind="logo-dark-bg"
            preview="dark"
            assetId={identity.logoForDarkBgAssetId}
            onChange={(assetId) => updateIdentity({ logoForDarkBgAssetId: assetId })}
            title="Versão para fundos escuros"
            hint="Opcional. Normalmente a versão clara."
          />
        </div>
      </div>

      {/* Cores */}
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-fg">Cores da marca</h3>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            São estas as cores usadas nas artes. O preto e o verde do painel ficam só na
            aplicação.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <ColorField
            label="Cor principal"
            value={identity.colors.primary}
            onChange={(hex) => setColors({ primary: hex })}
            suggestions={colorSuggestions}
          />
          <ColorField
            label="Cor secundária"
            value={identity.colors.secondary}
            onChange={(hex) => setColors({ secondary: hex })}
            suggestions={colorSuggestions}
          />
          <ColorField
            label="Terceira cor"
            optional
            value={identity.colors.accent ?? ''}
            onChange={(hex) => setColors({ accent: hex })}
            onClear={() => setColors({ accent: null })}
            suggestions={colorSuggestions}
          />
        </div>
        {!identity.colors.accent ? (
          <button
            type="button"
            onClick={() =>
              setColors({
                accent: deriveAccent(identity.colors.primary, identity.colors.secondary),
              })
            }
            className="self-start text-[12px] text-neon underline-offset-4 hover:underline"
          >
            <Sparkles className="mr-1 inline size-3" aria-hidden />
            Propor uma terceira cor a partir das duas primeiras
          </button>
        ) : null}
      </div>

      {/* Tipografia */}
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-fg">Tipografia</h3>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            Lista fechada: são as fontes que a aplicação consegue desenhar e exportar sem falhas.
          </p>
        </div>
        {/*
          As duas fontes e a amostra numa linha, em ecrãs largos.

          A amostra vinha por baixo dos selectores, numa linha só para ela;
          ao lado, lê-se como o resultado da escolha, e a tipografia deixa de
          ocupar três alturas.
        */}
        <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.25fr]">
          <Field label="Títulos" htmlFor="fonte-titulos" hint={getFont(identity.fontDisplay).note}>
            <Select
              id="fonte-titulos"
              value={identity.fontDisplay}
              onChange={(event) => updateIdentity({ fontDisplay: event.target.value as FontId })}
            >
              {FONT_CATALOG.map((font) => (
                <option key={font.id} value={font.id}>
                  {font.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Texto" htmlFor="fonte-texto" hint={getFont(identity.fontBody).note}>
            <Select
              id="fonte-texto"
              value={identity.fontBody}
              onChange={(event) => updateIdentity({ fontBody: event.target.value as FontId })}
            >
              {FONT_CATALOG.map((font) => (
                <option key={font.id} value={font.id}>
                  {font.label}
                </option>
              ))}
            </Select>
          </Field>
          <FontPreview
            display={identity.fontDisplay}
            body={identity.fontBody}
            className="sm:col-span-2 lg:col-span-1"
          />
        </div>
      </div>
    </div>
  );
}

function FontPreview({
  display,
  body,
  className,
}: {
  display: FontId;
  body: FontId;
  className?: string;
}) {
  return (
    <div className={cn('rounded-[12px] border border-line bg-ink-950 px-4 py-3.5', className)}>
      <p
        className="text-[22px] font-semibold leading-tight text-fg"
        style={{ fontFamily: `var(${getFont(display).cssVar})` }}
      >
        Novidades da semana
      </p>
      <p
        className="mt-1.5 text-[13px] leading-relaxed text-fg-muted"
        style={{ fontFamily: `var(${getFont(body).cssVar})` }}
      >
        Encomenda pelo WhatsApp e recebe no mesmo dia em Luanda.
      </p>
    </div>
  );
}
