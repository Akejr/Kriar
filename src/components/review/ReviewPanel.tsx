'use client';

import * as React from 'react';
import { Sparkles } from 'lucide-react';
import { APP } from '@/config/app';
import type { ResolvedAsset } from '@/lib/composition/resolve';
import type { LayoutId } from '@/lib/domain/direction';
import type {
  ArtBase,
  Brand,
  Composition,
  ContactsPlacement,
  LogoPlacement,
  LogoSize,
  TextRole,
} from '@/lib/domain/types';
import { Badge, Button } from '@/components/ui/primitives';
import { WorkspaceBackdrop } from '@/components/ui/WorkspaceBackdrop';
import { cn } from '@/lib/utils/cn';
import { ReviewContacts } from './ReviewContacts';
import { ReviewDisposition } from './ReviewDisposition';
import { ReviewIdea } from './ReviewIdea';
import { ReviewItems } from './ReviewItems';
import { ReviewLogo } from './ReviewLogo';
import { ReviewTexts } from './ReviewTexts';

/**
 * Revisão da publicação.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Último passo antes de gerar. Existe por uma razão económica e uma razão de
 * produto:
 *
 *  · cada geração custa dinheiro e tempo, e corrigir um texto aqui é
 *    gratuito; depois de gerar, obriga a gerar outra vez;
 *  · o cliente vê o que vai ser pedido ao gerador, em palavras que entende,
 *    em vez de descobrir no resultado que o nome do produto estava mal.
 *
 * ESTRUTURA, e porque mudou outra vez
 * -----------------------------------
 * "A tela de rever publicação é muito pesada, muita informação, muito feia."
 * Tinha cinco cartões numerados com ícones, a cena descrita em três linhas
 * técnicas, as referências que seguiam com a arte, um esboço com as cores e
 * as palavras verdadeiras e um campo para reescrever a ideia à mão.
 *
 * Ficou em duas colunas:
 *
 *  · à esquerda, a PLANTA e o que decide onde fica cada coisa — grelha,
 *    logótipo, contactos, cor de base (`ReviewDisposition`);
 *  · à direita, o que se lê e se escreve — a ideia em duas frases, com
 *    "Outra ideia" e "Melhorar a ideia", e depois os textos, os produtos,
 *    a marca e os contactos, em secções leves.
 *
 * Saiu o que o cliente "nem precisa de saber": a cena, a luz, o protagonista
 * por extenso e a lista de referências. Continuam a seguir para o gerador.
 * ──────────────────────────────────────────────────────────────────────────
 */

/** Quantos produtos a revisão deixa acrescentar — o mesmo que o armazém aceita. */
const ITEM_CAPACITY = APP.itemCapacity;

export function ReviewPanel({
  composition,
  brand,
  assets,
  uploading,
  planning,
  generating,
  onTextChange,
  onItemAdd,
  onItemRemove,
  onItemRename,
  onItemHighlight,
  onItemImage,
  onItemImageClear,
  onLogoVisible,
  onContactToggle,
  onContactValue,
  onReshuffle,
  onRefine,
  onGenerate,
  onLayoutChange,
  onLogoPlacementChange,
  onLogoSizeChange,
  onContactsPlacementChange,
  onBaseChange,
}: {
  composition: Composition;
  brand: Brand;
  assets: Record<string, ResolvedAsset | undefined>;
  uploading: number;
  planning: boolean;
  generating: boolean;
  onTextChange: (role: TextRole, value: string) => void;
  onItemAdd: () => void;
  onItemRemove: (itemId: string) => void;
  onItemRename: (itemId: string, name: string) => void;
  onItemHighlight: (index: number) => void;
  onItemImage: (itemId: string, file: File) => void;
  onItemImageClear: (itemId: string) => void;
  onLogoVisible: (visible: boolean) => void;
  onContactToggle: (
    contact: { type: Composition['contacts'][number]['type']; value: string },
    enabled: boolean,
  ) => void;
  onContactValue: (type: Composition['contacts'][number]['type'], value: string) => void;
  onReshuffle: () => void;
  /** "Melhorar a ideia". Devolve `true` quando correu bem. */
  onRefine: (request: string) => Promise<boolean>;
  onGenerate: () => void;
  /** Troca a grelha da ideia. */
  onLayoutChange: (layout: LayoutId) => void;
  onLogoPlacementChange: (placement: LogoPlacement) => void;
  onLogoSizeChange: (size: LogoSize) => void;
  onContactsPlacementChange: (placement: ContactsPlacement) => void;
  onBaseChange: (base: ArtBase) => void;
}) {
  const missingTitle = !composition.texts.headline?.value?.trim();
  const unnamed = composition.items.filter((item) => !item.name.trim()).length;
  const ready = !missingTitle && unnamed === 0;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/*
        Campo de pontos no fundo da revisão. `isolate` no invólucro é o que
        faz o `-z-10` funcionar (ver a secção 40 do DECISOES).
      */}
      <WorkspaceBackdrop pingEvery={4.4} />

      <div className="relative min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-[1.5rem]">
                Rever publicação
              </h1>
              <p className="mt-0.5 text-[12.5px] text-fg-muted">
                Nada é gerado até confirmares. Corrigir aqui é gratuito.
              </p>
            </div>
            <Badge tone={ready ? 'neon' : 'neutral'}>
              {ready ? 'Pronto a gerar' : missingTitle ? 'Falta o título' : 'Faltam nomes'}
            </Badge>
          </header>

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
            {/* A planta: presa ao topo quando há altura para isso. */}
            <aside className="min-w-0 lg:sticky lg:top-0">
              <ReviewDisposition
                composition={composition}
                brand={brand}
                assets={assets}
                onLayoutChange={onLayoutChange}
                onLogoPlacementChange={onLogoPlacementChange}
                onLogoSizeChange={onLogoSizeChange}
                onContactsPlacementChange={onContactsPlacementChange}
                onBaseChange={onBaseChange}
              />
            </aside>

            <div className="flex min-w-0 flex-col gap-4">
              <ReviewIdea
                direction={composition.direction}
                planning={planning}
                onReshuffle={onReshuffle}
                onRefine={onRefine}
              />

              <Section title="Textos">
                <ReviewTexts texts={composition.texts} onChange={onTextChange} />
              </Section>

              <Section
                title="Produtos"
                aside={
                  composition.items.length > 1 ? 'O principal fica em primeiro plano.' : undefined
                }
              >
                <ReviewItems
                  items={composition.items}
                  highlightedIndex={composition.highlightedItemIndex}
                  capacity={ITEM_CAPACITY}
                  assets={assets}
                  uploading={uploading}
                  onAdd={onItemAdd}
                  onRemove={onItemRemove}
                  onRename={onItemRename}
                  onHighlight={onItemHighlight}
                  onPickImage={onItemImage}
                  onClearImage={onItemImageClear}
                />
              </Section>

              <div className="grid gap-4 xl:grid-cols-2">
                <Section title="Marca">
                  <ReviewLogo
                    logo={composition.logo}
                    colors={composition.colors}
                    base={composition.base ?? 'primaria'}
                    brand={brand}
                    assets={assets}
                    onVisible={onLogoVisible}
                  />
                </Section>

                <Section title="Contactos">
                  <ReviewContacts
                    brand={brand}
                    active={composition.contacts}
                    onToggle={onContactToggle}
                    onValue={onContactValue}
                  />
                </Section>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Acção final, sempre à vista */}
      <div className="relative shrink-0 bg-ink-950/80 px-5 py-3.5 backdrop-blur-sm sm:px-7">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-line to-transparent"
        />
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-fg-faint">
            {ready
              ? 'Podes voltar aqui e gerar outra vez.'
              : missingTitle
                ? 'Escreve o título antes de gerar.'
                : 'Dá nome a todos os produtos antes de gerar.'}
          </p>
          <Button
            variant="primary"
            size="lg"
            loading={generating}
            disabled={!ready}
            onClick={onGenerate}
            className={cn('shrink-0', ready && !generating && 'glow-neon')}
          >
            <Sparkles className="size-4" aria-hidden />
            Gerar arte
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Uma secção leve: título pequeno e o conteúdo. Sem número nem ícone — eram
 * cinco cartões numerados com o mesmo peso, e o ecrã lia-se como um
 * formulário de repartição.
 */
function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[14px] bg-ink-900/55 p-4 ring-1 ring-line backdrop-blur-sm">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="text-[12.5px] font-semibold text-fg">{title}</h2>
        {aside ? <span className="text-[10.5px] text-fg-faint">{aside}</span> : null}
      </header>
      {children}
    </section>
  );
}
