'use client';

import * as React from 'react';
import Link from 'next/link';
import { resolveComposition, type ResolvedArtwork } from '@/lib/composition/resolve';
import { DEFAULT_PROJECT_NAME } from '@/lib/domain/factories';
import type { Brand, Composition } from '@/lib/domain/types';
import { cn } from '@/lib/utils/cn';
import { Button, Callout, Spinner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { ReviewPanel } from '@/components/review/ReviewPanel';
import { libraryEntryFor } from '@/lib/brand/library';
import { useBrandLibrary } from '@/store/brandLibrary';
import { useBrandMemory } from '@/store/brandMemory';
import { useEditor } from '@/store/editor';
import { usePageHeader } from '@/store/shell';
import { ArtworkView } from './ArtworkView';
import { LeftPanel } from './LeftPanel';
import { PanelResizer, usePanelWidth } from './PanelResizer';
import { RightPanel } from './RightPanel';
import { StageLoader } from './StageLoader';
import { useArtFonts } from './useArtFonts';

/**
 * Editor.
 *
 * Painel de ajustes à esquerda, composição à direita. Em ecrãs pequenos, os
 * dois alternam por separadores, porque lado a lado nenhum dos dois teria
 * espaço útil.
 */
export function EditorView({ brand }: { brand: Brand }) {
  const { show } = useToast();
  const store = useEditor();
  const {
    project,
    assets,
    view,
    zoom,
    selectedLayerId,
    editingLayerId,
    planning,
    generating,
    exporting,
    uploading,
    saveStatus,
    notice,
    backgroundMode,
    mobileTab,
    isDraft,
    stage,
    phase,
  } = store;

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const library = useBrandLibrary();
  const { record } = useBrandMemory();

  /*
    O editor regista o uso; quem grava a memória na marca é a sessão.

    O editor não sabe gravar a marca — e não deve: a marca vive na sessão, e
    duas cópias a gravar acabavam por se apagar uma à outra.
  */
  const setMemorySink = store.setMemorySink;
  React.useEffect(() => {
    setMemorySink((event) => void record(event));
    return () => setMemorySink(null);
  }, [record, setMemorySink]);

  const composition = project?.composition ?? null;
  const fontsReady = useArtFonts(
    composition ? [composition.fontDisplay, composition.fontBody] : [],
  );

  const panel = usePanelWidth();

  /*
    O nome da publicação edita-se no próprio caminho do topo.

    Clicar em "Nova publicação" abre o nome para escrever, ali mesmo. Antes
    era só texto: para dar nome a uma publicação era preciso voltar à lista
    de projectos e abrir um diálogo.

    Com o nome por omissão, o campo abre VAZIO, com a sugestão por baixo —
    apagar "Publicação sem nome" letra a letra antes de escrever é um passo
    que ninguém devia ter de dar.
  */
  const named = Boolean(project && project.name.trim() && project.name !== DEFAULT_PROJECT_NAME);
  usePageHeader(
    project
      ? ['Projectos', named ? project.name : isDraft ? 'Nova publicação' : project.name]
      : ['Projectos'],
    project ? saveStatus : 'idle',
    project
      ? {
          rename: {
            value: named ? project.name : '',
            placeholder: 'Nome da publicação',
            onCommit: store.rename,
          },
        }
      : undefined,
  );

  // Atalhos: desfazer, refazer, mover a selecção, limpar a selecção.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      /*
        Dentro de um campo de texto, Ctrl+Z é do campo.

        A verificação vinha depois do atalho: desfazer uma letra no pedido
        desfazia a última alteração da publicação inteira, e o browser
        nunca chegava a desfazer a letra.
      */
      if (typing) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (event.key === 'Escape') {
        store.selectLayer(null);
        return;
      }
      if (!selectedLayerId) return;

      const step = event.shiftKey ? 0.02 : 0.004;
      const moves: Record<string, { dx: number; dy: number }> = {
        ArrowLeft: { dx: -step, dy: 0 },
        ArrowRight: { dx: step, dy: 0 },
        ArrowUp: { dx: 0, dy: -step },
        ArrowDown: { dx: 0, dy: step },
      };
      const delta = moves[event.key];
      if (delta) {
        event.preventDefault();
        store.moveLayer(selectedLayerId, delta);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // `store` é estável (zustand); as acções usadas não mudam de identidade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLayerId]);

  // Avisa antes de fechar com gravação pendente.
  React.useEffect(() => {
    if (saveStatus !== 'dirty' && saveStatus !== 'saving') return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saveStatus]);

  /**
   * Composição usada para desenhar.
   *
   * No rascunho forçamos o fundo do modelo, para a estrutura ficar legível;
   * na arte final usamos o fundo gerado. É esta a diferença entre as duas
   * vistas, e a vista final é exactamente o que a exportação produz.
   */
  const renderComposition = React.useMemo<Composition | null>(() => {
    if (!composition) return null;
    if (view === 'arte-final') return composition;
    return { ...composition, background: { ...composition.background, mode: 'modelo' } };
  }, [composition, view]);

  const artwork = React.useMemo<ResolvedArtwork | null>(() => {
    if (!mounted || !fontsReady || !renderComposition) return null;
    try {
      return resolveComposition({
        composition: renderComposition,
        brand,
        assets,
        mode: view === 'arte-final' ? 'final' : 'rascunho',
      });
    } catch {
      return null;
    }
  }, [mounted, fontsReady, renderComposition, brand, assets, view]);

  if (store.loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="A abrir o projecto…" />
      </div>
    );
  }

  if (store.loadError || !project || !composition) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h2 className="text-[15px] font-semibold text-fg">Não foi possível abrir</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
            {store.loadError ?? 'Projecto indisponível.'}
          </p>
          <Link href="/projectos" className="mt-4 inline-block">
            <Button variant="outline">Voltar aos projectos</Button>
          </Link>
        </div>
      </div>
    );
  }

  /**
   * A partir daqui a composição existe. O compilador não leva o
   * estreitamento do `if` acima para dentro das funções declaradas a seguir,
   * por isso fixamo-lo numa constante própria.
   */
  const active: Composition = composition;

  // Uma composição existe assim que há texto OU opções: as peças sozinhas já
  // dão uma estrutura para o utilizador ajustar.
  const hasComposition = Object.keys(active.texts).length > 0 || active.items.length > 0;

  // Devolve o resultado: a edição por zonas precisa de saber se correu bem
  // para limpar as zonas e abrir a comparação.
  async function runAction(
    action: () => Promise<{ ok: boolean; errors?: string[]; notice?: string }>,
    successMessage?: string,
  ) {
    const result = await action();
    if (result.errors?.length) {
      result.errors.forEach((message) => show({ tone: 'erro', message }));
    }
    if (result.ok && successMessage) {
      show({ tone: 'sucesso', message: result.notice ?? successMessage });
    } else if (result.ok && result.notice) {
      show({ tone: 'info', message: result.notice });
    }
    return result;
  }

  /**
   * Destino de uma camada de texto.
   *
   * O identificador da camada não serve para isto: `text.headline` e
   * `item.principal.label` escrevem em sítios diferentes da composição. O
   * motor declara o destino, e é ele que mandamos ao armazém.
   */
  function textTargetOf(layerId: string) {
    const layer = artwork?.layers.find((item) => item.id === layerId);
    return layer?.kind === 'text' ? layer.target : null;
  }

  /** "Usar como referência da marca": junta a versão actual, ou retira-a. */
  async function toggleLibrary() {
    if (!project) return;
    const assetId = active.artwork.assetId;
    const url = assetId ? assets[assetId]?.url : undefined;
    if (!assetId || !url) return;
    const entry = libraryEntryFor(brand.identity.styleLearning, assetId);
    const result = entry
      ? await library.remove(brand, entry.assetId)
      : await library.approve(brand, project, url);
    if (result.error) show({ tone: 'erro', message: result.error });
    else if (result.notice) show({ tone: 'sucesso', message: result.notice });
  }

  function commitText(layerId: string, value: string) {
    const target = textTargetOf(layerId);
    if (!target) return;
    if (target.kind === 'item') store.setItemName(target.itemId, value);
    else store.setText(target.role, value);
  }

  function toggleTextLock(layerId: string) {
    const target = textTargetOf(layerId);
    if (!target) return;
    if (target.kind === 'item') {
      const item = active.items.find((entry) => entry.id === target.itemId);
      if (item) store.setItemLock(item.id, !item.locked);
      return;
    }
    const current = active.texts[target.role];
    if (current) store.setTextLock(target.role, !current.locked);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {notice ? (
        <div className="shrink-0 px-3 pt-2">
          <Callout tone="info" className="flex items-start justify-between gap-3">
            <span>{notice}</span>
            <button
              type="button"
              onClick={store.dismissNotice}
              className="shrink-0 text-[11.5px] font-semibold text-fg-muted hover:text-fg"
            >
              Fechar
            </button>
          </Callout>
        </div>
      ) : null}

      {/* Separadores em ecrãs pequenos */}
      <div role="tablist" aria-label="Área de trabalho" className="flex shrink-0 lg:hidden">
        {(
          [
            { id: 'ajustes' as const, label: 'Ajustes' },
            { id: 'previa' as const, label: 'Prévia' },
          ] satisfies Array<{ id: 'ajustes' | 'previa'; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mobileTab === tab.id}
            onClick={() => store.setMobileTab(tab.id)}
            className={cn(
              'flex-1 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors',
              mobileTab === tab.id
                ? 'border-neon text-fg'
                : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/*
        A largura do painel vem do ajustador, numa variável CSS.

        Só em ecrã largo: abaixo de `lg` o painel e o palco são separadores,
        um de cada vez, e não há fronteira para arrastar.
      */}
      <div
        className="grid min-h-0 flex-1 lg:grid-cols-[var(--painel-largura)_1fr]"
        style={{ '--painel-largura': `${panel.width}px` } as React.CSSProperties}
      >
        <div
          className={cn(
            'relative min-h-0',
            mobileTab === 'ajustes' ? 'block' : 'hidden lg:block',
          )}
        >
          <PanelResizer
            width={panel.width}
            onChange={panel.change}
            onCommit={panel.persist}
          />
          <LeftPanel
            composition={composition}
            brand={brand}
            brief={project.brief}
            assets={assets}
            uploading={uploading}
            planning={planning}
            hasComposition={hasComposition}
            missingFields={project.missingFields}
            onBriefChange={store.setBrief}
            onAddImages={(files) => void runAction(() => store.addImages(files))}
            onRemoveImage={store.removeImage}
            onSetMainImage={store.setMainImage}
            onFormatChange={store.setFormat}
            onStyleChange={store.setStyle}
            onColorsChange={store.setColors}
            onResetColors={store.resetColorsToBrand}
            onToggleContact={store.toggleContact}
            onLogoVisible={store.setLogoVisible}
            onImageNoteChange={store.setImageNote}
            onImageKindChange={store.setImageKind}
            onImproveBrief={() => void runAction(() => store.improveBrief())}
            improvingBrief={store.improvingBrief}
            onPrepare={() => void runAction(() => store.preparePlan())}
            onFillMissing={store.fillMissingField}
          />
        </div>

        <div
          className={cn(
            'relative min-h-0',
            mobileTab === 'previa' ? 'block' : 'hidden lg:block',
          )}
        >
          {/*
            Três etapas no mesmo espaço: o pedido, a revisão e a arte. O
            indicador de progresso cobre-as durante as operações longas, para
            o conteúdo anterior não ficar a meio de uma transição.
          */}
          {/*
            Durante uma operação longa, o ecrã de baixo fica montado mas
            invisível e fora do foco (`inert`): o indicador cobre tudo e já
            não se vêem os dados da proposta anterior por trás dele. Montado,
            e não desmontado, para nada se perder se a operação falhar — as
            zonas marcadas de uma edição, por exemplo.
          */}
          <div className={cn('h-full', phase && 'invisible')} inert={phase ? true : undefined}>
          {stage === 'revisao' ? (
            <ReviewPanel
              composition={active}
              brand={brand}
              assets={assets}
              uploading={uploading}
              planning={planning}
              generating={generating}
              onTextChange={store.setText}
              onItemAdd={() => store.addItem()}
              onItemRemove={store.removeItem}
              onItemRename={store.setItemName}
              onItemHighlight={store.setHighlightedItem}
              onItemImage={(itemId, file) =>
                void runAction(() => store.setItemImage(itemId, file))
              }
              onItemImageClear={store.clearItemImage}
              onLogoVisible={store.setLogoVisible}
              onContactToggle={store.toggleContact}
              onContactValue={store.setContactValue}
              onReshuffle={() =>
                void runAction(
                  () => store.preparePlan({ reshuffle: true }),
                  'Nova ideia proposta.',
                )
              }
              onRefine={async (request) =>
                (await runAction(() => store.preparePlan({ refine: request }), 'Ideia melhorada.'))
                  .ok
              }
              onGenerate={() => void runAction(() => store.generateArtwork(), 'Arte gerada.')}
              onLayoutChange={store.setLayout}
              onLogoPlacementChange={store.setLogoPlacement}
              onLogoSizeChange={store.setLogoSize}
              onContactsPlacementChange={store.setContactsPlacement}
              onBaseChange={store.setBase}
            />
          ) : stage === 'arte' ? (
            <ArtworkView
              composition={active}
              brand={brand}
              assets={assets}
              exporting={exporting}
              generating={generating}
              onExport={() => void runAction(() => store.exportArt(), 'PNG descarregado.')}
              onBackToReview={store.backToReview}
              onRegenerate={() =>
                void runAction(() => store.generateArtwork(), 'Nova arte gerada.')
              }
              onEdit={(input) => runAction(() => store.editArtwork(input), 'Edição aplicada.')}
              onRestoreVersion={store.restoreArtworkVersion}
              inLibrary={Boolean(
                libraryEntryFor(brand.identity.styleLearning, active.artwork.assetId),
              )}
              libraryBusy={library.busy}
              onToggleLibrary={() => void toggleLibrary()}
            />
          ) : (
            <RightPanel
            artwork={artwork}
            composition={composition}
            hasComposition={hasComposition}
            view={view}
            zoom={zoom}
            selectedLayerId={selectedLayerId}
            editingLayerId={editingLayerId}
            planning={planning}
            generating={generating}
            exporting={exporting}
            backgroundMode={backgroundMode}
            onSelect={store.selectLayer}
            onStartEdit={store.setEditingLayer}
            onCancelEdit={() => store.setEditingLayer(null)}
            onCommitText={(layerId, value) => {
              commitText(layerId, value);
              store.setEditingLayer(null);
            }}
            onMove={store.moveLayer}
            onResizeLayer={store.scaleLayer}
            onFontChange={(role, font) =>
              store.setFonts(role === 'display' ? { fontDisplay: font } : { fontBody: font })
            }
            onSizeFactor={store.scaleLayer}
            onWeightChange={store.setLayerWeight}
            onAlignLayer={store.alignLayer}
            onToggleLock={toggleTextLock}
            onResetLayer={store.resetLayer}
            onReplaceLayerImage={(layerId, file) => {
              const layer = artwork?.layers.find((item) => item.id === layerId);
              if (!layer) return;

              // Imagem de uma peça: vive em `composition.items`, não na lista
              // de fotografias livres.
              if (
                (layer.kind === 'image' || layer.kind === 'placeholder') &&
                layer.role === 'peca' &&
                layer.itemId
              ) {
                const itemId = layer.itemId;
                void runAction(() => store.setItemImage(itemId, file));
                return;
              }

              if (layer.kind === 'image') {
                void runAction(() => store.replaceImage(layer.assetId, file));
              } else {
                void runAction(() => store.addImages([file]));
              }
            }}
            onZoomChange={store.setZoom}
            onViewChange={store.setView}
            onReshuffle={() =>
              void runAction(
                () => store.preparePlan({ reshuffle: true }),
                'Composição reorganizada. O conteúdo foi mantido.',
              )
            }
            onGenerate={() =>
              void runAction(() => store.generateFinalArt(), 'Arte final gerada.')
            }
            onExport={() => void runAction(() => store.exportArt(), 'PNG descarregado.')}
            onVisualDirectionChange={store.setVisualDirection}
            />
          )}
          </div>

          {phase ? <StageLoader phase={phase} /> : null}
        </div>
      </div>
    </div>
  );
}
