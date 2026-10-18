'use client';

import * as React from 'react';
// Ícone neutro no selector de formato: a lista deixou de ser só do
// Instagram quando entraram o LinkedIn, os Reels e as capas horizontais.
import { Crop, Sparkles, Wand2 } from 'lucide-react';
import type { ResolvedAsset } from '@/lib/composition/resolve';
import { CONTACT_TYPES, FORMATS, STYLES, detectStyleHint, getFormat } from '@/lib/domain/catalog';
import type { AttachmentKind, Brand, Composition, FormatId, StyleId } from '@/lib/domain/types';
import { brandWebsite } from '@/lib/domain/factories';
import { detectPrices, formatKz } from '@/lib/utils/money';
import { cn } from '@/lib/utils/cn';
import { Badge, Button, Switch } from '@/components/ui/primitives';
import { Attachments } from './Attachments';
import { ColorDots } from './ColorDots';
import { MissingFields } from './MissingFields';

const BRIEF_LIMIT = 500;

/**
 * Painel de ajustes.
 *
 * Desenhado para caber sem rolagem num ecrã normal: etiquetas curtas, cores
 * em círculos, formato num selector de uma linha e estilos em cápsulas. A
 * acção principal fica fixa no fundo, fora da área que pode rolar, para estar
 * sempre ao alcance.
 */
export function LeftPanel({
  composition,
  brand,
  brief,
  assets,
  uploading,
  planning,
  hasComposition,
  missingFields,
  onBriefChange,
  onAddImages,
  onRemoveImage,
  onSetMainImage,
  onFormatChange,
  onStyleChange,
  onColorsChange,
  onResetColors,
  onToggleContact,
  onLogoVisible,
  onImageNoteChange,
  onImageKindChange,
  onImproveBrief,
  improvingBrief,
  onPrepare,
  onFillMissing,
}: {
  composition: Composition;
  brand: Brand;
  brief: string;
  assets: Record<string, ResolvedAsset | undefined>;
  uploading: number;
  planning: boolean;
  hasComposition: boolean;
  missingFields: Array<{ field: string; question: string }>;
  onBriefChange: (value: string) => void;
  onAddImages: (files: File[]) => void;
  onRemoveImage: (assetId: string) => void;
  onSetMainImage: (index: number) => void;
  onFormatChange: (format: FormatId) => void;
  onStyleChange: (style: StyleId) => void;
  onColorsChange: (colors: Partial<Composition['colors']>) => void;
  onResetColors: () => void;
  onToggleContact: (
    contact: { type: Composition['contacts'][number]['type']; value: string },
    enabled: boolean,
  ) => void;
  onLogoVisible: (visible: boolean) => void;
  /** Explicação opcional do que fazer com um anexo. */
  onImageNoteChange: (assetId: string, note: string) => void;
  /** Para que serve um anexo: material, captura de ecrã ou arte a recriar. */
  onImageKindChange: (assetId: string, kind: AttachmentKind) => void;
  /** Reescreve o pedido num briefing claro, por IA. */
  onImproveBrief: () => void;
  improvingBrief: boolean;
  onPrepare: () => void;
  onFillMissing: (field: string, value: string) => void;
}) {
  const [moreOpen, setMoreOpen] = React.useState(false);

  const styleHint = detectStyleHint(brief);
  const showStyleHint = styleHint && styleHint !== composition.style;
  const prices = detectPrices(brief);
  const format = getFormat(composition.format);

  const activeContacts = new Set(composition.contacts.map((contact) => contact.type));
  /*
    O website dos dados da empresa conta como contacto.

    Vive num campo à parte ("Website", nos dados da empresa), e esta lista
    só lia os canais de contacto: o website entrava na arte por omissão e
    não havia aqui forma de o tirar.
  */
  const website = brandWebsite(brand);
  const availableContacts = [
    ...brand.contacts.filter((contact) => contact.value.trim()),
    ...(website && !brand.contacts.some((contact) => contact.type === 'website')
      ? [{ id: 'website-da-empresa', type: 'website' as const, value: website }]
      : []),
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink-900/60">
      {/*
        Rolagem verde, e afastada da aresta.

        A barra vivia colada à aresta direita do painel — exactamente onde
        está a faixa do ajustador de largura, que a tapava por 8 px: quem
        agarrava a barra para rolar acabava a redimensionar o painel. A
        margem de 8 px põe a barra fora da faixa, e as duas coisas deixam de
        disputar o mesmo sítio.
      */}
      <div className="scroll-neon mr-2 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto py-4 pl-4 pr-2">
        <h1 className="text-[1.3rem] font-semibold leading-none tracking-tight text-fg">
          Vamos criar?
        </h1>

        {/* Pedido */}
        <Block label="O que queres comunicar?" htmlFor="editor-pedido">
          <div className="relative">
            <textarea
              id="editor-pedido"
              rows={4}
              maxLength={BRIEF_LIMIT}
              value={brief}
              onChange={(event) => onBriefChange(event.target.value)}
              placeholder="Ex.: Quero anunciar estes perfumes por 15.000 Kz. Um estilo elegante, com encomendas pelo WhatsApp."
              className="w-full resize-none rounded-[11px] bg-ink-950/70 px-3 pb-6 pt-2.5 text-[12.5px] leading-relaxed text-fg outline-none ring-1 ring-line transition-shadow placeholder:text-fg-faint focus:ring-neon/35"
            />
            <span className="pointer-events-none absolute bottom-2 right-3 text-[10.5px] tabular-nums text-fg-faint">
              {brief.length}/{BRIEF_LIMIT}
            </span>
          </div>

          {/*
            Organizar o pedido antes de o planear.

            ────────────────────────────────────────────────────────────────
            O pedido é a base de tudo: dele saem o briefing, o conceito e os
            textos que vão impressos na arte. Uma nota apressada — sem
            pontuação, com marcas mal escritas, com a mensagem implícita —
            produz um conceito apressado.

            A rota é explícita sobre o que NÃO faz: não acrescenta preços,
            contactos, características nem posição de mercado. Organiza e
            clarifica. Melhorar um pedido não pode ser inventar factos sobre
            a empresa de alguém.

            Só aparece com texto suficiente para haver algo a organizar.
            ────────────────────────────────────────────────────────────────
          */}
          {brief.trim().length >= 12 ? (
            <button
              type="button"
              onClick={onImproveBrief}
              disabled={improvingBrief}
              className={cn(
                'mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-medium transition-colors',
                improvingBrief
                  ? 'border-line text-fg-faint'
                  : 'border-line text-fg-muted hover:border-neon/40 hover:text-neon',
              )}
            >
              <Wand2
                className={cn(
                  'size-3',
                  improvingBrief && 'animate-[kriar-pulse-soft_1.1s_ease-in-out_infinite]',
                )}
                aria-hidden
              />
              {improvingBrief ? 'A organizar…' : 'Melhorar o pedido'}
            </button>
          ) : null}

          {/* O que foi reconhecido no pedido. Mostrar aqui evita que o
              utilizador descubra mais tarde que o preço não foi lido. */}
          {prices.length > 0 ? (
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-neon/10 px-2 py-0.5 text-[10.5px] font-medium text-neon">
              <Sparkles className="size-2.5" aria-hidden />
              preço reconhecido: {formatKz(prices[0].value)}
            </p>
          ) : null}

          {missingFields.length > 0 ? (
            <div className="mt-2.5">
              <MissingFields fields={missingFields} onFill={onFillMissing} />
            </div>
          ) : null}
        </Block>

        {/*
          Os produtos, os textos e a marca são confirmados no ecrã de revisão,
          à direita. Repeti-los aqui daria dois sítios para a mesma edição e
          duas verdades sobre o que vai ser gerado.
        */}

        {/*
          Anexos do pedido.

          O bloco estava atrás de `template.imageSlots.length > 0`, e o
          único modelo da biblioteca tem a lista vazia — logo, nunca
          aparecia e não havia forma de anexar uma fotografia. A condição
          fazia sentido quando a aplicação desenhava compartimentos; com a
          arte gerada por inteiro, uma fotografia é uma REFERÊNCIA e não
          precisa de compartimento no modelo.
        */}
        <Block label="Anexos">
          <Attachments
            images={composition.images}
            mainImageIndex={composition.mainImageIndex}
            assets={assets}
            uploading={uploading}
            onAdd={onAddImages}
            onRemove={onRemoveImage}
            onSetMain={onSetMainImage}
            onNoteChange={onImageNoteChange}
            onKindChange={onImageKindChange}
          />
        </Block>

        {/*
          Cores.

          As duas etiquetas são a mesma peça (`Badge`) com o mesmo tamanho:
          trocar de uma para a outra não mexe na linha. "Só nesta
          publicação" era uma pílula âmbar inteira para uma informação que
          não pede acção — as cores mudadas aqui não tocam na marca. Ficou
          neutra, com o ponto âmbar a assinalar que a publicação se afastou
          das cores da empresa.
        */}
        <Block
          label="Cores da publicação"
          aside={
            // `sm`: no tamanho normal, "só nesta publicação" e o rótulo não
            // cabiam lado a lado na largura por omissão do painel, e os dois
            // partiam em duas linhas.
            composition.colorsFromBrand ? (
              <Badge size="sm">
                <Sparkles className="size-2.5" aria-hidden />
                Cores da marca
              </Badge>
            ) : (
              <Badge tone="warn" size="sm">
                só nesta publicação
              </Badge>
            )
          }
        >
          <ColorDots
            colors={composition.colors}
            fromBrand={composition.colorsFromBrand}
            onChange={onColorsChange}
            onReset={onResetColors}
          />
        </Block>

        {/* Formato */}
        <Block label="Formato" htmlFor="editor-formato">
          <div className="relative">
            <Crop
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-muted"
            />
            <select
              id="editor-formato"
              value={composition.format}
              onChange={(event) => onFormatChange(event.target.value as FormatId)}
              className="h-10 w-full appearance-none rounded-[11px] bg-ink-950/70 pl-9 pr-9 text-[12.5px] text-fg outline-none ring-1 ring-line transition-shadow focus:ring-neon/35"
            >
              {/*
                A plataforma primeiro, a medida depois.

                O cliente não escolhe uma proporção: escolhe onde vai
                publicar. "Reels e TikTok · 1080 × 1920" responde à pergunta
                dele; "9:16" obrigava-o a traduzir.
              */}
              {FORMATS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.platform} · {option.hint}
                </option>
              ))}
            </select>
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted"
            >
              <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="mt-1.5 text-[10.5px] text-fg-faint">{format.label}</p>
        </Block>

        {/* Estilo */}
        <Block label="Estilo">
          <div role="radiogroup" aria-label="Estilo da publicação" className="flex flex-wrap gap-1.5">
            {STYLES.map((style) => {
              const selected = style.id === composition.style;
              return (
                <button
                  key={style.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  title={style.hint}
                  onClick={() => onStyleChange(style.id)}
                  className={cn(
                    'flex-1 whitespace-nowrap rounded-[9px] border px-2.5 py-1.5 text-[11.5px] font-medium transition-all duration-200',
                    selected
                      ? 'border-neon/50 bg-neon/10 text-neon'
                      : 'border-line bg-ink-950/50 text-fg-muted hover:border-line-strong hover:text-fg',
                  )}
                >
                  {style.label}
                </button>
              );
            })}
          </div>
          {showStyleHint ? (
            <button
              type="button"
              onClick={() => onStyleChange(styleHint)}
              className="mt-2 text-[10.5px] text-neon underline-offset-2 hover:underline"
            >
              O pedido sugere {STYLES.find((s) => s.id === styleHint)?.label.toLowerCase()} —
              aplicar
            </button>
          ) : null}
        </Block>

        {/* Logótipo e contactos, recolhidos por omissão */}
        <div>
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((value) => !value)}
            className="flex w-full items-center justify-between rounded-[9px] px-1 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-faint transition-colors hover:text-fg-muted"
          >
            Logótipo e contactos
            <span aria-hidden className="text-[13px] leading-none">
              {moreOpen ? '–' : '+'}
            </span>
          </button>

          {moreOpen ? (
            <div className="mt-2.5 flex flex-col gap-3 rounded-[11px] bg-ink-950/50 p-3 ring-1 ring-line">
              <Switch
                checked={composition.logo.show}
                onChange={onLogoVisible}
                label="Mostrar logótipo"
                description={
                  brand.identity.logoAssetId
                    ? 'Usamos o ficheiro original, sem redesenhar.'
                    : 'Ainda não há logótipo na área Marca.'
                }
              />

              {availableContacts.length === 0 ? (
                <p className="text-[10.5px] leading-relaxed text-fg-faint">
                  Sem contactos guardados. Adiciona-os na área Marca.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {availableContacts.map((contact) => {
                    const spec = CONTACT_TYPES.find((item) => item.type === contact.type);
                    const active = activeContacts.has(contact.type);
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        aria-pressed={active}
                        title={contact.value}
                        onClick={() =>
                          onToggleContact(
                            { type: contact.type, value: contact.value },
                            !active,
                          )
                        }
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                          active
                            ? 'border-neon/50 bg-neon/10 text-neon'
                            : 'border-line text-fg-muted hover:border-line-strong hover:text-fg',
                        )}
                      >
                        {spec?.label ?? contact.type}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Acção principal, sempre visível */}
      <div className="shrink-0 px-4 pb-4 pt-1">
        <Button
          variant="primary"
          size="lg"
          block
          loading={planning}
          disabled={!brief.trim() && !hasComposition}
          onClick={onPrepare}
          className={cn(!planning && (brief.trim() || hasComposition) && 'glow-neon')}
        >
          <Wand2 className="size-4" aria-hidden />
          {hasComposition ? 'Actualizar proposta' : 'Preparar proposta'}
        </Button>
        <p className="mt-1.5 text-center text-[10.5px] leading-relaxed text-fg-faint">
          {hasComposition
            ? 'Os textos que editaste à mão ficam como estão.'
            : 'Revês tudo antes de a arte ser gerada.'}
        </p>
      </div>
    </div>
  );
}

function Block({
  label,
  htmlFor,
  aside,
  children,
}: {
  label: string;
  htmlFor?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-[12px] font-medium text-fg">
            {label}
          </label>
        ) : (
          <p className="text-[12px] font-medium text-fg">{label}</p>
        )}
        {aside}
      </div>
      {children}
    </div>
  );
}
