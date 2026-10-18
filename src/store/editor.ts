'use client';

/**
 * Estado do editor.
 *
 * Reúne o projecto em edição, o histórico para desfazer/refazer, os estados
 * de operação (a preparar, a gerar, a guardar) e a gravação automática.
 *
 * Princípios que estão aqui codificados:
 *
 *  · Um texto editado à mão fica `locked` e nem a IA nem o planeador local o
 *    reescrevem. O utilizador pode desbloquear.
 *  · Mudar cores no editor nunca toca no perfil da empresa: a paleta vive na
 *    composição do projecto.
 *  · Se a geração do fundo falhar, o rascunho e as edições mantêm-se.
 *  · Corrigir o preço depois de gerar não apaga o recurso de fundo.
 */
import { create } from 'zustand';
import { APP } from '@/config/app';
import {
  backgroundToBlob,
  paintBackground,
  type BackgroundRecipe,
} from '@/lib/composition/backgrounds';
import { buildThumbnail, exportFinishedArtwork, exportPng } from '@/lib/composition/export';
import type { ResolvedAsset } from '@/lib/composition/resolve';
import { getBackend } from '@/lib/data';
import { registerAsset, resolveAssets } from '@/lib/data/assetCache';
import { getFormat } from '@/lib/domain/catalog';
import {
  brandWebsite,
  createItem,
  createProject,
  defaultContactsForComposition,
  DEFAULT_PROJECT_NAME,
} from '@/lib/domain/factories';
import { migrateProject } from '@/lib/domain/migrateProject';
import { pickLibraryArts } from '@/lib/brand/library';
import { pickLogo } from '@/lib/brand/logoVariant';
import { activeMemoryRules } from '@/lib/brand/memory';
import { activeStyle, styleForArtwork, styleSummaryText } from '@/lib/brand/styleLearning';
import { framedArtDataUrl } from '@/lib/composition/finishArtwork';
import { prepareZoneEdit, type ZoneShape } from '@/lib/composition/zones';
import { ZONE_LIMIT } from '@/lib/composition/zoneConstants';
import { proposedBase } from '@/lib/composition/base';
import { defaultLayoutFor, fitLogoPlacement, getLayout } from '@/lib/composition/layouts';
import { computeSketch, describeSketch, paintGeneratorSketch } from '@/lib/composition/sketch';
import { sketchInputFor } from '@/lib/composition/sketchInput';
import type { CreativeDirection, LayoutId } from '@/lib/domain/direction';
import { getReference } from '@/lib/references/catalog';
import { referenceUsageFor } from '@/lib/references/select';
import type {
  ArtBase,
  ArtworkVersion,
  AttachmentKind,
  Brand,
  BrandColors,
  BrandMemoryEvent,
  Composition,
  CompositionArtwork,
  CompositionFinish,
  ContactsPlacement,
  ContactType,
  FormatId,
  LayerOverride,
  LogoPlacement,
  LogoSize,
  Project,
  StyleId,
  TextRole,
} from '@/lib/domain/types';
import { CONTACT_TYPES, TEXT_ROLE_LABELS, formatContactForArt } from '@/lib/domain/catalog';
import { getFont } from '@/lib/fontCatalog';
import { getTemplate } from '@/lib/templates';
import {
  blobToDataUrl,
  checkImageFile,
  downscaleImageBlob,
  readImageSize,
} from '@/lib/utils/files';
import type { Plan } from '@/lib/ai/schema';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'erro';
export type EditorView = 'rascunho' | 'arte-final';

export type ActionResult = { ok: boolean; errors?: string[]; notice?: string };

/**
 * Etapa do trabalho.
 *
 *  · `pedido`  — ainda não há proposta: o cliente descreve o que quer.
 *  · `revisao` — há proposta; o cliente confirma textos, produtos e ideia.
 *  · `arte`    — a arte foi gerada.
 *
 * A revisão existe para o cliente corrigir ANTES de gastar uma geração. É
 * também o único momento em que mudar um texto é gratuito: depois de gerar,
 * mudar texto obriga a gerar outra vez.
 */
export type WorkStage = 'pedido' | 'revisao' | 'arte';

/**
 * Operação em curso, para o indicador de progresso.
 *
 * As etiquetas mudam em transições REAIS do código. O passo da geração é
 * opaco — não sabemos o que o fornecedor está a fazer lá dentro — por isso
 * esse é indeterminado e mostramos o tempo decorrido em vez de uma
 * percentagem inventada.
 */
export type WorkPhase = {
  /** `edicao` é a edição por zonas de uma arte que já existe. */
  kind: 'plano' | 'arte' | 'edicao';
  label: string;
  /** `true` quando não há como saber o progresso real. */
  indeterminate: boolean;
  startedAt: number;
  /** `true` quando a verificação reprovou a primeira tentativa. */
  retrying?: boolean;
  /** O defeito que a correcção está a resolver, para o cliente saber. */
  detail?: string;
  /**
   * Os passos que o indicador mostra, quando dependem do que se está a fazer.
   *
   * O plano tem três caminhos — a primeira ideia, outra ideia, melhorar a
   * actual — e o indicador dizia "A procurar outra ideia" na primeira, que
   * não tem "outra" nenhuma. Quem sabe qual é o caminho é o store.
   */
  steps?: string[];
  /** O título do indicador, quando não é o do tipo de operação. */
  title?: string;
};

/**
 * Resultado da verificação de uma arte.
 *
 * Espelha o que `/api/ai/review-art` devolve. A decisão de repetir é
 * calculada no servidor a partir de perguntas fechadas, não pedida ao
 * modelo de visão.
 */
type ArtReview = {
  retry: boolean;
  issues: string[];
  score: number;
};

type GeneratedArt = {
  dataUrl: string;
  prompt: string;
  /** Só nas edições: a imagem nova entrou apenas dentro das zonas? */
  composited?: boolean;
  /** Só nas edições: zonas que os píxeis dizem ter ficado iguais. */
  unchanged?: number[];
};

/**
 * Papéis das imagens que o browser envia ao gerador.
 *
 * `estilo-marca` é uma arte da biblioteca da marca: material da própria
 * empresa, mas para mostrar a linguagem — nunca para repetir o conteúdo.
 * `captura` e `recriar` vêm do tipo que o cliente deu ao anexo.
 */
type ClientReferenceRole =
  | 'produto'
  | 'captura'
  | 'recriar'
  | 'logotipo'
  | 'esboco'
  | 'estilo-marca';

/** O papel de cada tipo de anexo, e o rótulo quando o cliente não escreveu nota. */
const ATTACHMENT_ROLE: Record<AttachmentKind, { role: ClientReferenceRole; label: string }> = {
  produto: { role: 'produto', label: 'produto' },
  captura: { role: 'captura', label: 'captura de ecrã' },
  recriar: { role: 'recriar', label: 'arte a recriar' },
};

/**
 * Um acontecimento para a memória da empresa, como o editor o vê.
 *
 * O editor não grava a marca: entrega o acontecimento a quem a grava (ver
 * `setMemorySink`). Leva a marca de onde veio, para nunca ir parar à
 * empresa errada se o cliente mudar de empresa a meio.
 */
export type MemoryEventInput = {
  brandId: string;
  kind: BrandMemoryEvent['kind'];
  projectId: string | null;
  detail: string;
};

/**
 * Uma edição por zonas, como sai do ecrã.
 *
 * `shape` está na moldura que o cliente vê; a conversão para o ficheiro
 * acontece em `prepareZoneEdit`.
 */
export type ArtworkEditInput = {
  zones: Array<{
    shape: ZoneShape;
    comment: string;
    /** Onde fica, em palavras — o mesmo texto que o cartão mostrou. */
    position: string;
    /** Material opcional para a zona, em data URL. */
    image: string | null;
  }>;
  /** `true` para o resto da arte ficar exactamente igual. */
  preserveOutside: boolean;
};

const HISTORY_LIMIT = 60;

/**
 * Versões guardadas por publicação.
 *
 * Doze chegam para voltar atrás numa sessão de afinação inteira sem a lista
 * virar um arquivo. As mais antigas saem da lista; os ficheiros ficam no
 * armazenamento, porque uma publicação duplicada pode estar a usá-los.
 */
const ARTWORK_HISTORY_LIMIT = 12;

/** A versão actual da arte, pronta a entrar no histórico. */
function versionOf(artwork: CompositionArtwork): ArtworkVersion | null {
  if (!artwork.assetId) return null;
  return {
    assetId: artwork.assetId,
    origin: artwork.origin ?? 'geracao',
    createdAt: artwork.generatedAt ?? new Date().toISOString(),
    width: artwork.width,
    height: artwork.height,
    summary: artwork.summary ?? '',
  };
}

/**
 * Os textos reescritos passam a ser a referência do que foi proposto.
 *
 * A memória regista "reescreveu o título" quando o texto gerado é diferente
 * do proposto. Depois de registado, o proposto passa a ser o texto do
 * cliente — senão, cada "Gerar outra" registava a mesma reescrita outra vez.
 */
function settleProposed(texts: Composition['texts']): Composition['texts'] {
  const next: Composition['texts'] = {};
  for (const role of Object.keys(texts) as TextRole[]) {
    const entry = texts[role];
    if (!entry) continue;
    next[role] =
      entry.locked && entry.proposed !== undefined ? { ...entry, proposed: entry.value.trim() } : entry;
  }
  return next;
}

/** O histórico com a versão actual à cabeça, sem repetidos. */
function historyWith(artwork: CompositionArtwork): ArtworkVersion[] {
  const current = versionOf(artwork);
  const rest = (artwork.history ?? []).filter((version) => version.assetId !== current?.assetId);
  return (current ? [current, ...rest] : rest).slice(0, ARTWORK_HISTORY_LIMIT);
}

/**
 * Os ficheiros da MARCA que o editor tem de ter à mão.
 *
 * Os três logótipos e as duas artes de referência do estilo aprendido.
 * Estava repetido em três sítios — abrir, começar um rascunho e mudar de
 * marca —, e as artes de referência faltavam nos três.
 */
function brandAssetIds(brand: Brand): Array<string | null> {
  return [
    brand.identity.logoAssetId,
    brand.identity.logoForLightBgAssetId,
    brand.identity.logoForDarkBgAssetId,
    ...(brand.identity.styleLearning?.references ?? []).map((reference) => reference.assetId),
  ];
}
const TEXT_ROLES: TextRole[] = ['headline', 'subheadline', 'price', 'cta', 'badge'];

/**
 * O pedido de melhoria fala dos textos?
 *
 * Sem isto, melhorar a ideia reescrevia os textos que o cliente já tinha
 * revisto — e "mais luz na cena" trocava-lhe o título.
 */
function mentionsTexts(request: string): boolean {
  return /\b(t[íi]tulos?|textos?|frases?|bot[ãa]o|bot[õo]es|chamadas?|pre[çc]os?|etiquetas?|subt[íi]tulos?|slogans?|palavras?|escrit[ao]s?|escrever|cta)\b/i.test(
    request,
  );
}

/** O pedido de melhoria fala dos produtos? */
function mentionsItems(request: string): boolean {
  return /\b(produtos?|pe[çc]as?|op[çc][õo]es|op[çc][ãa]o|itens|item|artigos?)\b/i.test(request);
}

type EditorState = {
  project: Project | null;
  brand: Brand | null;
  assets: Record<string, ResolvedAsset>;

  past: Composition[];
  future: Composition[];

  selectedLayerId: string | null;
  editingLayerId: string | null;
  zoom: number | 'fit';
  view: EditorView;
  mobileTab: 'ajustes' | 'previa';

  /**
   * Etapa visível no painel da direita.
   *
   * Guardado em estado e não derivado da composição porque o cliente pode
   * voltar à revisão com a arte já gerada, para corrigir e gerar outra vez.
   */
  stage: WorkStage;

  loading: boolean;
  loadError: string | null;
  /**
   * `true` enquanto o projecto existe só em memória.
   *
   * O ecrã de criação abre um rascunho sem o gravar. Assim clicar em "Criar"
   * não enche a lista de projectos vazios. Passa a `false` na primeira
   * gravação, que acontece quando houver conteúdo que valha a pena guardar.
   */
  isDraft: boolean;
  uploading: number;
  planning: boolean;
  generating: boolean;
  exporting: boolean;
  /** Operação longa em curso. Alimenta o indicador de progresso. */
  phase: WorkPhase | null;
  saveStatus: SaveStatus;
  saveError: string | null;
  /** Mensagem do servidor sobre o modo usado e ajustes aplicados. */
  notice: string | null;
  planSource: 'ia' | 'deterministico' | null;
  backgroundMode: 'ia' | 'local' | null;
  /** Quantas vezes se pediu outra ideia. */
  attempt: number;
  /**
   * Ideias de publicações recentes da mesma marca.
   *
   * Controlo de variedade (§14): vão com o pedido de proposta para o modelo
   * não repetir conceitos. Carregadas ao abrir o editor; vazio não é erro —
   * uma marca sem histórico não tem nada a evitar.
   */
  recentIdeas: string[];
  /**
   * Artes da biblioteca usadas nas gerações mais recentes desta marca.
   *
   * A rotação: a próxima geração prefere outras. Lidas das publicações
   * recentes ao abrir o editor, como as ideias.
   */
  recentBrandRefs: string[];
  /** Referências da biblioteca usadas nas publicações recentes da marca. Rotação. */
  recentReferenceIds: string[];
  /** Quem grava os acontecimentos na memória da empresa. `null` sem ninguém a ouvir. */
  memorySink: ((event: MemoryEventInput) => void) | null;
  setMemorySink: (sink: ((event: MemoryEventInput) => void) | null) => void;

  // --- Ciclo de vida ------------------------------------------------------
  load: (projectId: string, brand: Brand) => Promise<void>;
  /** Abre um projecto novo em memória, sem o gravar. */
  startDraft: (accountId: string, brand: Brand) => void;
  setBrand: (brand: Brand) => void;
  teardown: () => void;

  // --- Pedido -------------------------------------------------------------
  setBrief: (brief: string) => void;
  /**
   * Reescreve o pedido num briefing claro, por IA.
   *
   * Substitui o texto do cliente, e por isso devolve resultado: se falhar, o
   * que ele escreveu não pode desaparecer.
   */
  improveBrief: () => Promise<ActionResult>;
  /** `true` enquanto o pedido está a ser reescrito. */
  improvingBrief: boolean;
  rename: (name: string) => void;

  // --- Imagens ------------------------------------------------------------
  addImages: (files: File[]) => Promise<ActionResult>;
  removeImage: (assetId: string) => void;
  setMainImage: (index: number) => void;
  replaceImage: (assetId: string, file: File) => Promise<ActionResult>;

  // --- Peças --------------------------------------------------------------
  addItem: (name?: string) => void;
  removeItem: (itemId: string) => void;
  setItemName: (itemId: string, name: string) => void;
  setItemLock: (itemId: string, locked: boolean) => void;
  /** Explicação opcional do que fazer com uma fotografia anexada. */
  setImageNote: (assetId: string, note: string) => void;
  /** Para que serve um anexo: material, captura de ecrã ou arte a recriar. */
  setImageKind: (assetId: string, kind: AttachmentKind) => void;
  /** Troca a grelha da ideia, no esboço da revisão. */
  setLayout: (layout: LayoutId) => void;
  setItemImage: (itemId: string, file: File) => Promise<ActionResult>;
  clearItemImage: (itemId: string) => void;
  setHighlightedItem: (index: number) => void;

  // --- Parâmetros ---------------------------------------------------------
  setFormat: (format: FormatId) => void;
  setStyle: (style: StyleId) => void;
  setColors: (colors: Partial<BrandColors>) => void;
  resetColorsToBrand: () => void;
  setFonts: (fonts: { fontDisplay?: Composition['fontDisplay']; fontBody?: Composition['fontBody'] }) => void;
  toggleContact: (contact: { type: ContactType; value: string }, enabled: boolean) => void;
  /** Altera o valor de um contacto nesta publicação. */
  setContactValue: (type: ContactType, value: string) => void;
  setLogoVisible: (visible: boolean) => void;
  setLogoVariant: (variant: Composition['logo']['variant']) => void;
  setVisualDirection: (text: string) => void;

  // --- Planeamento e geração ---------------------------------------------
  /**
   * Prepara a proposta.
   *
   *  · sem opções — a primeira ideia, ou "Actualizar proposta";
   *  · `reshuffle` — "Outra ideia": troca a ideia por uma diferente;
   *  · `refine` — "Melhorar a ideia": a mesma ideia, com o que o cliente
   *    pediu. Os textos ficam, salvo se o pedido falar deles.
   */
  preparePlan: (options?: { reshuffle?: boolean; refine?: string }) => Promise<ActionResult>;
  generateFinalArt: () => Promise<ActionResult>;
  /** Gera a publicação completa a partir da revisão aprovada. */
  generateArtwork: () => Promise<ActionResult>;
  /**
   * Edita a arte actual nas zonas marcadas pelo cliente.
   *
   * A versão anterior vai para o histórico: uma edição nunca apaga nada.
   */
  editArtwork: (input: ArtworkEditInput) => Promise<ActionResult>;
  /** Volta a uma versão do histórico. A actual passa a ser uma versão. */
  restoreArtworkVersion: (assetId: string) => void;
  fillMissingField: (field: string, value: string) => void;
  dismissNotice: () => void;

  // --- Acabamento ---------------------------------------------------------
  setLogoPlacement: (placement: LogoPlacement) => void;
  setLogoSize: (size: LogoSize) => void;
  /** A cor de base desta arte, escolhida pelo cliente. */
  setBase: (base: ArtBase) => void;
  /** Contactos no bloco de texto ou numa linha de rodapé. */
  setContactsPlacement: (placement: ContactsPlacement) => void;
  setFinish: (patch: Partial<CompositionFinish>) => void;
  /** Volta à revisão a partir da arte, para corrigir e gerar outra vez. */
  backToReview: () => void;

  // --- Texto --------------------------------------------------------------
  setText: (role: TextRole, value: string) => void;
  setTextLock: (role: TextRole, locked: boolean) => void;

  // --- Camadas ------------------------------------------------------------
  selectLayer: (id: string | null) => void;
  setEditingLayer: (id: string | null) => void;
  moveLayer: (id: string, delta: { dx: number; dy: number }) => void;
  scaleLayer: (id: string, factor: number) => void;
  alignLayer: (id: string, align: 'left' | 'center' | 'right') => void;
  setLayerWeight: (id: string, weight: 400 | 700) => void;
  resetLayer: (id: string) => void;

  // --- Histórico ----------------------------------------------------------
  undo: () => void;
  redo: () => void;

  // --- Vista --------------------------------------------------------------
  setZoom: (zoom: number | 'fit') => void;
  setView: (view: EditorView) => void;
  setMobileTab: (tab: 'ajustes' | 'previa') => void;

  // --- Gravação -----------------------------------------------------------
  saveNow: () => Promise<void>;
  exportArt: () => Promise<ActionResult>;
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useEditor = create<EditorState>()((set, get) => {
  /**
   * Um rascunho só vale a pena guardar quando tem conteúdo. Sem isto, abrir
   * o ecrã de criação deixava um projecto vazio na lista de cada vez.
   */
  function worthSaving(project: Project): boolean {
    return Boolean(
      project.brief.trim() ||
        // Dar nome a um rascunho é intenção: quem o nomeia quer encontrá-lo
        // depois na lista. Sem isto, o nome escrito no topo perdia-se.
        (project.name.trim() && project.name !== DEFAULT_PROJECT_NAME) ||
        project.composition.images.length > 0 ||
        project.composition.items.length > 0 ||
        Object.keys(project.composition.texts).length > 0,
    );
  }

  /** Grava o projecto, com miniatura actualizada. */
  async function persist(): Promise<void> {
    const { project, brand, assets, isDraft } = get();
    if (!project || !brand) return;

    if (isDraft && !worthSaving(project)) {
      set({ saveStatus: 'idle' });
      return;
    }

    set({ saveStatus: 'saving', saveError: null });
    try {
      const thumbnail = await buildThumbnail({ project, brand, assets });
      const saved = await getBackend().saveProject({
        ...project,
        thumbnail: thumbnail ?? project.thumbnail,
      });
      // Só actualizamos os campos do servidor, para não perder edições feitas
      // enquanto a gravação estava a correr.
      /*
        `isDraft` só muda quando o projecto gravado é o que está aberto.

        Mudava sempre. Uma gravação do projecto anterior a acabar depois de
        "Criar" marcava o rascunho NOVO como gravado, e a página de criação
        mandava o cliente para o endereço de um projecto que nunca existiu.
      */
      set((state) =>
        state.project && state.project.id === saved.id
          ? {
              project: { ...state.project, updatedAt: saved.updatedAt, thumbnail: saved.thumbnail },
              saveStatus: 'saved',
              isDraft: false,
            }
          : {},
      );
    } catch (error) {
      // O erro é do projecto que estava a ser gravado. Se o editor já tem
      // outro aberto, não é dele que se avisa.
      if (get().project?.id !== project.id) return;
      set({
        saveStatus: 'erro',
        saveError:
          error instanceof Error
            ? error.message
            : 'Não foi possível guardar. As alterações continuam no editor.',
      });
    }
  }

  /**
   * Grava já o que estava à espera da gravação automática.
   *
   * Para quando o projecto aberto vai ser trocado por outro. Cancelar o
   * temporizador, como se fazia, deitava fora o último segundo de edições do
   * projecto que se deixava. `persist` lê o projecto antes do primeiro
   * `await`, por isso grava o que sai, mesmo com o novo já no lugar dele.
   */
  function flushPendingSave(): void {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    void persist();
  }

  function scheduleSave(): void {
    if (saveTimer) clearTimeout(saveTimer);
    set({ saveStatus: 'dirty' });
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void persist();
    }, APP.autosaveDelayMs);
  }

  /** Aplica uma alteração à composição, com entrada no histórico. */
  function mutate(
    updater: (composition: Composition) => Composition,
    options: { history?: boolean; status?: Project['status'] } = {},
  ): void {
    const { project } = get();
    if (!project) return;
    const history = options.history ?? true;
    const next = updater(project.composition);
    if (next === project.composition) return;

    set((state) => ({
      project: state.project
        ? {
            ...state.project,
            composition: next,
            status: options.status ?? state.project.status,
          }
        : null,
      past: history
        ? [...state.past, project.composition].slice(-HISTORY_LIMIT)
        : state.past,
      future: history ? [] : state.future,
    }));
    scheduleSave();
  }

  function overrideOf(composition: Composition, layerId: string): LayerOverride {
    return composition.overrides[layerId] ?? { dx: 0, dy: 0, scale: 1 };
  }

  /**
   * Regras da identidade APROVADA.
   *
   * Uma identidade em rascunho não manda nas artes: o cliente ainda não a
   * aprovou, e aplicá-la seria decidir por ele.
   */
  function guidelinesFrom(brand: Brand) {
    const spec = brand.identity.spec;
    if (!spec || spec.status !== 'aprovada') return null;
    return {
      lighting: spec.direction.lighting,
      framing: spec.direction.framing,
      photoTreatment: spec.direction.photoTreatment,
      decorationLevel: spec.direction.decorationLevel,
      tone: spec.direction.tone,
      avoid: spec.direction.avoid,
      cornerRadius: spec.graphics.cornerRadius,
      shadow: spec.graphics.shadow,
      fixedRules: spec.fixedRules,
      /*
        Os papéis de superfície e de texto da paleta aprovada.

        A paleta da empresa é DADOS e acompanha-a: cada geração recebia já a
        principal, a secundária e a de realce, mas não os fundos nem as cores
        de texto. O gerador ficava a inventar o tom do fundo e do texto a
        partir da cor dominante, o que dava artes da mesma empresa com
        fundos de famílias diferentes.

        São os mesmos papéis que o design system mostra ao cliente, e é por
        isso que não há aqui nenhuma derivação: o que ele aprovou é o que o
        gerador recebe.
      */
      surfaces: {
        bgLight: spec.colors.find((entry) => entry.role === 'bgLight')?.hex ?? null,
        bgDark: spec.colors.find((entry) => entry.role === 'bgDark')?.hex ?? null,
        textOnLight:
          spec.colors.find((entry) => entry.role === 'textOnLight')?.hex ?? null,
        textOnDark: spec.colors.find((entry) => entry.role === 'textOnDark')?.hex ?? null,
      },
    };
  }

  /**
   * Regras da identidade em palavras, para a proposta de conceitos.
   *
   * Só da identidade APROVADA. Uma proposta em rascunho é uma sugestão que o
   * cliente ainda não aceitou, e tratá-la como regra era decidir por ele.
   */
  function identityRulesFrom(brand: Brand) {
    const spec = brand.identity.spec;
    if (!spec || spec.status !== 'aprovada') return null;
    return {
      tone: spec.direction.tone,
      avoid: spec.direction.avoid,
      fixedRules: spec.fixedRules,
      constraints: spec.clientConstraints,
    };
  }

  /**
   * Contactos com o nome do canal, para o gerador os escrever.
   *
   * "website: www.exemplo.com" em vez de um valor solto numa tira de
   * caracteres. Um valor com significado é copiado com mais cuidado do que
   * uma sequência sem contexto.
   */
  function namedContactsOf(composition: Composition): Array<{ label: string; value: string }> {
    return composition.contacts
      .filter((contact) => contact.value.trim())
      .map((contact) => ({
        label: CONTACT_TYPES.find((entry) => entry.type === contact.type)?.label ?? contact.type,
        value: formatContactForArt(contact.type, contact.value.trim()),
      }))
      .filter((contact) => Boolean(contact.value));
  }



  /**
   * Referências de imagem para o gerador.
   *
   * São as fotografias que o cliente carregou: é o que mantém a fidelidade à
   * embalagem, à cor e à forma dos produtos reais. Reduzidas a 1024 px porque
   * cada referência viaja dentro do corpo do pedido.
   *
   * O logótipo entra quando a arte o leva — `composition.logo.show` — e é
   * o gerador que o desenha. Já não há camada da aplicação por cima.
   */
  async function buildReferences(args: {
    composition: Composition;
    brand: Brand;
    assets: Record<string, ResolvedAsset>;
    includeLogo: boolean;
    projectId: string;
    brief: string;
  }): Promise<{
    list: Array<{ role: ClientReferenceRole; label: string; dataUrl: string }>;
    /** As artes da biblioteca que seguiram, para a rotação. */
    libraryUsed: string[];
  }> {
    const { composition, brand, assets, includeLogo } = args;
    const out: Array<{ role: ClientReferenceRole; label: string; dataUrl: string }> = [];
    const libraryUsed: string[] = [];

    const sources: Array<{
      role: ClientReferenceRole;
      label: string;
      assetId: string;
      library?: boolean;
    }> = [];

    /*
      O logótipo vai PRIMEIRO, e na versão certa para o fundo.

      Ia em último e era sempre o ficheiro principal. Primeiro, porque os
      geradores preservam melhor a primeira imagem anexada. Na versão certa,
      porque um logótipo escuro numa arte de fundo escuro deixava o gerador
      sem saída: proibido de mudar a cor, sem contraste para o mostrar, e a
      improvisar. Ver `pickLogo`.

      O logótipo não conta para o tecto de cinco referências: sem ele a arte
      não tem marca, e cortá-lo para caber uma fotografia a mais era trocar o
      essencial pelo acessório.
    */
    const logoChoice = includeLogo
      ? pickLogo(brand, composition.colors, composition.base ?? 'primaria')
      : null;
    if (logoChoice) {
      sources.push({ role: 'logotipo', label: brand.company.name, assetId: logoChoice.assetId });
    }

    // Destaque primeiro: é o produto que tem de ficar reconhecível.
    const ordered = [
      composition.items[composition.highlightedItemIndex],
      ...composition.items.filter((_, index) => index !== composition.highlightedItemIndex),
    ].filter(Boolean);

    for (const item of ordered) {
      if (item?.assetId) {
        sources.push({ role: 'produto', label: item.name || 'produto', assetId: item.assetId });
      }
    }
    /*
      A nota do cliente vira o RÓTULO da referência.

      É o que o prompt escreve a seguir ao número da imagem anexada. Sem
      nota, "fotografia do produto"; com nota, as palavras dele — "o nosso
      espaço", "copia o tipo de letra deste site", "usa só o fundo". Sem
      isto, o campo de explicação era decorativo: o cliente escrevia e nada
      chegava a quem gera.
    */
    for (const image of composition.images) {
      const kind = ATTACHMENT_ROLE[image.kind] ?? ATTACHMENT_ROLE.produto;
      sources.push({
        role: kind.role,
        label: image.note.trim() || kind.label,
        assetId: image.assetId,
      });
    }

    // Cinco fotografias é o tecto prático: cada data URL soma ao corpo do
    // pedido. O logótipo, quando existe, vai além delas.
    const capped = sources.slice(0, logoChoice ? 6 : 5);

    /*
      ────────────────────────────────────────────────────────────────────────
      A BIBLIOTECA DA MARCA vai no fim, fora do tecto: duas ou três artes.

      São o que a empresa já publica e aprovou, e servem para o gerador ver
      a linguagem da marca — não para copiar. O rótulo de cada uma é o que
      ela mostra: o prompt usa-o para dizer exactamente o que não passa.

      Não vão todas, e é de propósito: ver `pickLibraryArts`. Com três ou
      mais anexos, seguem só duas — o gerador tem um número fixo de imagens
      por pedido, e o material do cliente vem primeiro.
      ────────────────────────────────────────────────────────────────────────
    */
    const style = activeStyle(brand.identity.styleLearning);
    const attached = capped.length - (logoChoice ? 1 : 0);
    const picks = pickLibraryArts({
      learning: style,
      brief: args.brief,
      format: composition.format,
      projectId: args.projectId,
      recentlyUsed: [...(composition.brandRefs ?? []), ...get().recentBrandRefs],
      count: attached >= 3 ? 2 : 3,
    });
    for (const reference of picks) {
      capped.push({
        role: 'estilo-marca',
        label: reference.content || 'uma publicação anterior da marca',
        assetId: reference.assetId,
        library: true,
      });
    }

    for (const source of capped) {
      const asset = assets[source.assetId];
      if (!asset?.url) continue;
      try {
        const blob = await fetch(asset.url).then((response) => response.blob());
        // O logótipo reduz-se em PNG: em JPEG a transparência saía preta, e
        // um logótipo escuro chegava ao gerador sobre preto. O servidor
        // assenta-o depois num fundo que contrasta (`prepareLogoReference`).
        const reduced = await downscaleImageBlob(
          blob,
          1024,
          0.92,
          source.role === 'logotipo' ? { mime: 'image/png' } : {},
        );
        out.push({
          role: source.role,
          label: source.label,
          dataUrl: await blobToDataUrl(reduced.blob),
        });
        if (source.library) libraryUsed.push(source.assetId);
      } catch {
        // Uma referência que não carrega não impede a geração.
      }
    }

    return { list: out, libraryUsed };
  }

  /** Uma chamada ao gerador. Lança em caso de falha. */
  async function requestArtwork(
    request: Record<string, unknown>,
    correction: string[],
  ): Promise<GeneratedArt> {
    const response = await fetch('/api/ai/artwork', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...request, correction }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error ?? 'A geração da arte falhou.');
    }
    return { dataUrl: data.dataUrl, prompt: typeof data.prompt === 'string' ? data.prompt : '' };
  }

  /**
   * As imagens anexadas, para o modelo que cria a ideia as ver.
   *
   * A 768 px em JPEG: chega para ler uma captura de ecrã ou reconhecer um
   * produto, e seis imagens cabem num pedido. Uma imagem que não carrega
   * segue só com a nota — a nota sozinha já muda a ideia.
   */
  async function attachmentsFor(
    composition: Composition,
    assets: Record<string, ResolvedAsset>,
  ): Promise<Array<{ note: string; kind: AttachmentKind; dataUrl: string | null }>> {
    const out: Array<{ note: string; kind: AttachmentKind; dataUrl: string | null }> = [];
    for (const image of composition.images.slice(0, 6)) {
      let dataUrl: string | null = null;
      const url = assets[image.assetId]?.url;
      if (url) {
        try {
          const blob = await fetch(url).then((response) => response.blob());
          const small = await downscaleImageBlob(blob, 768, 0.82, { reencode: true });
          dataUrl = await blobToDataUrl(small.blob);
        } catch {
          dataUrl = null;
        }
      }
      out.push({ note: image.note.trim(), kind: image.kind, dataUrl });
    }
    return out;
  }

  /**
   * O que as publicações recentes DESTA empresa já usaram.
   *
   * As ideias, para o controlo de variedade (§14), e as artes da biblioteca,
   * para a rotação. Só da mesma marca: com várias empresas na conta, as
   * ideias de uma perfumaria não dizem nada a uma loja de subscrições.
   *
   * Falhar aqui não impede nada: sem histórico, a proposta sai sem saber o
   * que já foi feito, o que é pior mas não é bloqueante.
   */
  async function brandHistory(
    accountId: string,
    brandId: string,
    excludeProjectId: string | null,
  ): Promise<{
    recentIdeas: string[];
    recentBrandRefs: string[];
    recentReferenceIds: string[];
    /**
     * A base da publicação mais recente da marca que já tem arte — é a que
     * está no topo do feed. `null` sem nenhuma.
     */
    recentBase: ArtBase | null;
  }> {
    try {
      const all = await getBackend().listProjects(accountId);
      const recent = all.filter(
        (entry) => entry.id !== excludeProjectId && entry.brandId === brandId,
      );
      /*
        A lista vem da mais recente para a mais antiga. Uma publicação sem
        arte não conta: nunca chegou ao feed.
      */
      const lastPublished = recent.find((entry) => Boolean(entry.composition.artwork?.assetId));
      const recentBase: ArtBase | null = lastPublished
        ? lastPublished.composition.base === 'secundaria'
          ? 'secundaria'
          : 'primaria'
        : null;
      return {
        recentBase,
        recentIdeas: recent
          .map((entry) => entry.composition.direction?.idea)
          .filter((idea): idea is string => Boolean(idea))
          .slice(0, 5),
        // As três gerações mais recentes chegam para a rotação.
        recentBrandRefs: [
          ...new Set(recent.slice(0, 3).flatMap((entry) => entry.composition.brandRefs ?? [])),
        ],
        recentReferenceIds: [
          ...new Set(
            recent
              .slice(0, 3)
              .flatMap((entry) => (entry.composition.references ?? []).map((usage) => usage.referenceId)),
          ),
        ],
      };
    } catch {
      return { recentIdeas: [], recentBrandRefs: [], recentReferenceIds: [], recentBase: null };
    }
  }

  /**
   * O projecto com a base que o feed pede, se o cliente ainda não escolheu.
   *
   * Devolve o MESMO objecto quando não muda nada, para quem chama poder
   * comparar referências.
   */
  function withProposedBase(project: Project, recentBase: ArtBase | null): Project {
    if (project.composition.baseChosen) return project;
    const base = proposedBase(recentBase);
    if (project.composition.base === base) return project;
    return { ...project, composition: { ...project.composition, base } };
  }

  /** Entrega um acontecimento à memória da empresa, se alguém estiver a ouvir. */
  function remember(event: Omit<MemoryEventInput, 'brandId'>): void {
    const { brand, memorySink } = get();
    if (!brand || !memorySink || !event.detail.trim()) return;
    try {
      memorySink({ ...event, brandId: brand.id });
    } catch {
      // A memória nunca impede o trabalho.
    }
  }

  /**
   * A composição com uma direcção nova — ou a mesma, com outra grelha.
   *
   * ──────────────────────────────────────────────────────────────────────
   * Três coisas acompanham sempre a direcção, e só esta função as muda:
   *
   *  · a grelha, que uma direcção antiga não tinha;
   *  · o logótipo, que vai para onde a grelha o põe — a não ser que o
   *    cliente o tenha posto noutro sítio que a grelha aceite;
   *  · as REFERÊNCIAS, escolhidas de novo pela parecença com esta ideia e
   *    esta grelha. Eram escolhidas uma vez, para a primeira ideia, e "Outra
   *    ideia" ficava com as da anterior.
   * ──────────────────────────────────────────────────────────────────────
   */
  function withDirection(
    composition: Composition,
    direction: CreativeDirection | null,
  ): Composition {
    if (!direction) return { ...composition, direction: null, references: [] };
    const layout = direction.layout ?? defaultLayoutFor(direction.approach);
    const settled: CreativeDirection = { ...direction, layout };
    const placement = composition.logo.placementChosen
      ? fitLogoPlacement(layout, composition.format, composition.logo.placement)
      : fitLogoPlacement(layout, composition.format, null);
    return {
      ...composition,
      direction: settled,
      logo: { ...composition.logo, placement },
      references: referenceUsageFor({
        direction: settled,
        style: composition.style,
        itemCount: composition.items.length,
        recentlyUsed: get().recentReferenceIds,
      }),
    };
  }

  /**
   * A proporção em que o gerador desenha este formato.
   *
   * Vem do servidor (`/api/status`), que sabe qual é o modelo. Lida uma vez:
   * não muda enquanto a página está aberta.
   */
  let ratios: Partial<Record<FormatId, number>> | null = null;
  async function generatorRatio(format: FormatId): Promise<number> {
    if (!ratios) {
      try {
        const response = await fetch('/api/status');
        const data = (await response.json()) as { image?: { ratios?: Partial<Record<FormatId, number>> } };
        ratios = data.image?.ratios ?? {};
      } catch {
        ratios = {};
      }
    }
    const spec = getFormat(format);
    return ratios[format] ?? spec.width / spec.height;
  }

  /** Uma frase curta para a memória, sem cortar palavras. */
  function quote(text: string | null | undefined, max = 140): string {
    const flat = (text ?? '').replace(/\s+/g, ' ').trim();
    if (flat.length <= max) return flat;
    const cut = flat.slice(0, max);
    const word = cut.lastIndexOf(' ');
    return `${(word > 0 ? cut.slice(0, word) : cut).trim()}…`;
  }

  /** Uma chamada à edição por zonas. Lança em caso de falha. */
  async function requestEdit(
    request: Record<string, unknown>,
    correction: string[],
  ): Promise<GeneratedArt> {
    const response = await fetch('/api/ai/edit-art', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...request, correction }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error ?? 'A edição falhou. A arte que tinhas ficou intacta.');
    }
    const zones = Array.isArray(data.zones) ? data.zones : [];
    return {
      dataUrl: data.dataUrl,
      prompt: typeof data.prompt === 'string' ? data.prompt : '',
      composited: Boolean(data.composited),
      unchanged: zones
        .filter((zone: { unchanged?: boolean }) => zone?.unchanged)
        .map((zone: { number: number }) => zone.number),
    };
  }

  /**
   * O logótipo que a arte leva, em PNG, como a geração o envia.
   *
   * Na edição só serve se uma zona lhe tocar — mas é aí que o gerador o
   * redesenha, e a referência limpa é a melhor defesa.
   */
  async function logoDataUrlFor(
    brand: Brand,
    composition: Composition,
    assets: Record<string, ResolvedAsset>,
  ): Promise<string | null> {
    if (!composition.logo.show) return null;
    const choice = pickLogo(brand, composition.colors, composition.base ?? 'primaria');
    const url = choice ? assets[choice.assetId]?.url : undefined;
    if (!url) return null;
    try {
      const blob = await fetch(url).then((response) => response.blob());
      const reduced = await downscaleImageBlob(blob, 1024, 0.92, { mime: 'image/png' });
      return await blobToDataUrl(reduced.blob);
    } catch {
      return null;
    }
  }

  /**
   * Verifica uma arte gerada. Devolve `null` quando não foi possível.
   *
   * Nunca lança: uma verificação que falha não pode deitar fora uma arte
   * já paga. Sem verificação, a arte segue como saiu.
   *
   * A arte vai reduzida a 1024 px em JPEG. O verificador precisa de ver o
   * logótipo e as margens, não de cada píxel — e a original tem perto de
   * dois megabytes.
   */
  async function reviewArtwork(args: {
    art: GeneratedArt;
    /** O formato da publicação: o verificador vê a arte já na moldura. */
    format: FormatId;
    logo: string | null;
    headline: string;
    texts: string[];
    contacts: string[];
    /** A arte de outra empresa que o cliente pediu para recriar, se houver. */
    recreate?: string | null;
    /** Os preços que a arte pode mostrar. */
    prices?: string[];
    /** A arte não leva botão: um botão desenhado é um defeito. */
    noCta?: boolean;
    /** O gerador recebeu o esboço: procura-se o que dele passou. */
    sketch?: boolean;
    /** O que mostravam os exemplos de acabamento desta geração. */
    examples?: string[];
    /** Numa edição: a arte de antes e o pedido de cada zona. */
    edit?: {
      before: string;
      zones: Array<{ number: number; request: string; position: string }>;
    };
  }): Promise<ArtReview | null> {
    try {
      const small1024 = async (url: string) => {
        const blob = await fetch(url).then((response) => response.blob());
        const small = await downscaleImageBlob(blob, 1024, 0.88, { reencode: true });
        return blobToDataUrl(small.blob);
      };
      /*
        Na geração, a arte vai NA MOLDURA — o que o cliente vê e publica.

        Ia inteira, como o gerador a devolveu (3:4 numa publicação 4:5). O
        verificador via uma linha de contactos que a moldura cortava a meio
        e aprovava-a. Na edição compara-se o ficheiro antes e depois, que
        têm a mesma geometria, e a moldura não acrescenta nada.
      */
      const art = args.edit
        ? await small1024(args.art.dataUrl)
        : await framedArtDataUrl(args.art.dataUrl, args.format, 1024).catch(() =>
            small1024(args.art.dataUrl),
          );
      const response = await fetch('/api/ai/review-art', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          art,
          logo: args.logo,
          recreate: args.edit ? null : (args.recreate ?? null),
          prices: args.prices ?? [],
          noCta: args.edit ? false : Boolean(args.noCta),
          sketch: args.edit ? false : Boolean(args.sketch),
          examples: args.edit ? [] : (args.examples ?? []),
          expected: { headline: args.headline, texts: args.texts, contacts: args.contacts },
          ...(args.edit
            ? {
                edit: {
                  before: await small1024(args.edit.before),
                  zones: args.edit.zones,
                  unchanged: args.art.unchanged ?? [],
                },
              }
            : {}),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok || !data.review) return null;
      return data.review as ArtReview;
    } catch {
      return null;
    }
  }

  function patchOverride(
    layerId: string,
    patch: Partial<LayerOverride>,
  ): (composition: Composition) => Composition {
    return (composition) => ({
      ...composition,
      overrides: {
        ...composition.overrides,
        [layerId]: { ...overrideOf(composition, layerId), ...patch },
      },
    });
  }

  /**
   * Aplica o plano, respeitando os textos protegidos.
   *
   * Um texto APAGADO pelo cliente também está protegido — vazio e
   * `locked` (ver `setText`) —, e por isso não volta.
   *
   * `keepTexts` e `keepItems` servem "Melhorar a ideia": a ideia muda, os
   * textos e os produtos que o cliente já reviu ficam, salvo se o pedido de
   * melhoria falar deles.
   */
  function applyPlan(
    composition: Composition,
    plan: Plan,
    options: { keepTexts?: boolean; keepItems?: boolean } = {},
  ): Composition {
    const texts = { ...composition.texts };
    for (const role of TEXT_ROLES) {
      if (options.keepTexts) break;
      if (texts[role]?.locked) continue;
      const value =
        role === 'headline'
          ? plan.headline
          : role === 'subheadline'
            ? plan.subheadline
            : role === 'price'
              ? plan.price
              : role === 'cta'
                ? plan.cta
                : plan.badge;
      // `proposed` guarda o que a IA escreveu, para a memória saber depois
      // se o cliente o reescreveu.
      if (value && value.trim()) {
        texts[role] = { value: value.trim(), locked: false, proposed: value.trim() };
      } else delete texts[role];
    }

    const templateChanged = plan.templateId !== composition.templateId;

    /**
     * Peças propostas.
     *
     * Casamos pela ordem com as que já existem, para não perder as imagens
     * nem os nomes que o utilizador editou à mão. Uma peça `locked` mantém
     * o nome; a imagem mantém-se sempre, porque o planeador só propõe texto.
     */
    const proposed = options.keepItems ? [] : (plan.items ?? []);
    const items =
      proposed.length === 0
        ? composition.items
        : proposed.map((name, index) => {
            const existing = composition.items[index];
            if (!existing) return createItem(name.trim());
            return {
              ...existing,
              name: existing.locked ? existing.name : name.trim(),
            };
          });

    const highlighted = options.keepItems
      ? composition.highlightedItemIndex
      : Math.min(Math.max(plan.highlightedItemIndex ?? 0, 0), Math.max(0, items.length - 1));

    return {
      ...composition,
      templateId: plan.templateId,
      texts,
      items,
      highlightedItemIndex: highlighted,
      mainImageIndex: Math.min(
        Math.max(plan.mainImageIndex ?? 0, 0),
        Math.max(0, composition.images.length - 1),
      ),
      // As posições manuais são relativas ao modelo: ao trocar de modelo
      // deixam de fazer sentido e são limpas.
      overrides: templateChanged ? {} : composition.overrides,
      /*
        A nota visual acompanha SEMPRE a ideia nova. O campo onde o cliente
        a reescrevia à mão saiu da revisão — quem quer outra coisa pede-a em
        "Melhorar a ideia" —, e uma nota escrita para a ideia anterior
        passava a mandar no gerador por cima da ideia nova.
      */
      visualDirection: plan.visualDirection || composition.visualDirection,
      visualDirectionLocked: false,
      background: {
        ...composition.background,
        prompt: plan.backgroundPrompt || composition.background.prompt,
      },
    };
  }

  return {
    project: null,
    brand: null,
    assets: {},
    past: [],
    future: [],
    selectedLayerId: null,
    editingLayerId: null,
    zoom: 'fit',
    view: 'rascunho',
    mobileTab: 'ajustes',
    stage: 'pedido',
    loading: true,
    loadError: null,
    isDraft: false,
    uploading: 0,
    planning: false,
    generating: false,
    exporting: false,
    phase: null,
    saveStatus: 'idle',
    saveError: null,
    notice: null,
    planSource: null,
    backgroundMode: null,
    attempt: 0,
    recentIdeas: [],
    recentBrandRefs: [],
    recentReferenceIds: [],
    memorySink: null,
    improvingBrief: false,

    setMemorySink(sink) {
      set({ memorySink: sink });
    },

    startDraft(accountId, brand) {
      flushPendingSave();
      set({
        project: createProject(accountId, brand),
        brand,
        assets: {},
        past: [],
        future: [],
        selectedLayerId: null,
        editingLayerId: null,
        notice: null,
        planSource: null,
        backgroundMode: null,
        saveStatus: 'idle',
        saveError: null,
        view: 'rascunho',
        stage: 'pedido',
        phase: null,
        attempt: 0,
        loading: false,
        loadError: null,
        isDraft: true,
        // As de outra empresa não servem a esta. Chegam já a seguir.
        recentIdeas: [],
        recentBrandRefs: [],
        recentReferenceIds: [],
      });

      // O logótipo é preciso logo: entra na composição antes de haver textos.
      void resolveAssets(brandAssetIds(brand)).then((resolved) => {
        if (Object.keys(resolved).length === 0) return;
        set((state) => ({ assets: { ...state.assets, ...resolved } }));
      });

      const draftId = get().project?.id ?? null;
      void brandHistory(accountId, brand.id, draftId).then(({ recentBase, ...history }) => {
        const current = get().project;
        if (!current || current.id !== draftId) return;
        set({ ...history, project: withProposedBase(current, recentBase) });
      });
    },

    async load(projectId, brand) {
      flushPendingSave();
      set({
        loading: true,
        loadError: null,
        isDraft: false,
        past: [],
        future: [],
        selectedLayerId: null,
        editingLayerId: null,
        notice: null,
        saveStatus: 'idle',
        saveError: null,
        view: 'rascunho',
        attempt: 0,
      });
      try {
        const stored = await getBackend().getProject(projectId);
        if (!stored) {
          // Sem projecto na memória: o que lá estava (um rascunho, outro
          // projecto) não pode passar por ser este. A gravação pendente dele
          // já saiu no início desta função.
          set({ loading: false, project: null, loadError: 'Este projecto já não existe.' });
          return;
        }
        /*
          Fronteira do armazenamento.

          Um projecto gravado antes da mudança de arquitectura criativa vem
          com um estilo que já não existe e sem direcção criativa. Traduzir e
          preencher aqui — no único ponto por onde um projecto entra no
          editor — poupa a toda a aplicação defender-se contra isso.
        */
        const migrated = migrateProject(stored);

        /*
          O website, nas publicações de antes de ele entrar por omissão.

          Até aqui só entravam os contactos marcados na marca, e o website
          — que na maior parte das marcas vive nos dados da empresa — ficava
          sempre de fora. Uma vez por publicação: depois de proposto, se o
          cliente o tirar, fica tirado (`websiteDefaulted`).
        */
        const website = brandWebsite(brand);
        const needsWebsite =
          !migrated.composition.websiteDefaulted &&
          Boolean(website) &&
          !migrated.composition.contacts.some((contact) => contact.type === 'website');
        const project: Project = migrated.composition.websiteDefaulted
          ? migrated
          : {
              ...migrated,
              composition: {
                ...migrated.composition,
                websiteDefaulted: true,
                contacts: needsWebsite
                  ? [{ type: 'website', value: website ?? '' }, ...migrated.composition.contacts]
                  : migrated.composition.contacts,
              },
            };

        // Ideias e referências recentes da mesma marca. Ver `brandHistory`.
        const { recentIdeas, recentBrandRefs, recentReferenceIds, recentBase } = await brandHistory(
          project.accountId,
          project.brandId,
          project.id,
        );

        const assets = await resolveAssets([
          ...project.composition.images.map((image) => image.assetId),
          ...project.composition.items.map((item) => item.assetId),
          project.composition.background.assetId,
          project.composition.artwork.assetId,
          // As versões anteriores: a faixa de versões mostra-as e "Repor"
          // precisa delas já carregadas.
          ...project.composition.artwork.history.map((version) => version.assetId),
          ...brandAssetIds(brand),
        ]);
        set({
          // Sem arte e sem escolha do cliente, a base alterna com o feed.
          project: project.composition.artwork.assetId
            ? project
            : withProposedBase(project, recentBase),
          brand,
          assets,
          recentIdeas,
          recentBrandRefs,
          recentReferenceIds,
          loading: false,
          planSource: project.planSource,
          backgroundMode: project.composition.background.producedBy,
          view: project.composition.background.assetId ? 'arte-final' : 'rascunho',
          stage: project.composition.artwork.assetId
            ? 'arte'
            : project.composition.texts.headline?.value
              ? 'revisao'
              : 'pedido',
        });

        // O website acabado de propor fica gravado: é uma alteração real.
        if (project !== migrated) scheduleSave();

        // Projecto criado na tela de criação: já tem pedido mas ainda não tem
        // textos. Preparamos a composição logo, para o utilizador cair no
        // editor com algo para ajustar em vez de um ecrã vazio.
        const semTextos = Object.keys(project.composition.texts).length === 0;
        if (project.brief.trim() && semTextos) {
          void get().preparePlan();
        }
      } catch (error) {
        set({
          loading: false,
          loadError:
            error instanceof Error ? error.message : 'Não foi possível abrir este projecto.',
        });
      }
    },

    setBrand(brand) {
      set({ brand });
      // A marca pode ter mudado de logótipo noutra página: garantimos que o
      // recurso novo fica disponível para o motor de composição.
      void resolveAssets(brandAssetIds(brand)).then((resolved) => {
        if (Object.keys(resolved).length === 0) return;
        set((state) => ({ assets: { ...state.assets, ...resolved } }));
      });
    },

    teardown() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      set({
        project: null,
        assets: {},
        past: [],
        future: [],
        selectedLayerId: null,
        editingLayerId: null,
        notice: null,
        loading: true,
      });
    },

    setBrief(brief) {
      const { project } = get();
      if (!project) return;
      set({ project: { ...project, brief } });
      scheduleSave();
    },

    async improveBrief() {
      const { project, brand } = get();
      if (!project || !brand) return { ok: false };

      const original = project.brief.trim();
      if (original.length < 3) {
        return { ok: false, errors: ['Escreve primeiro o que queres comunicar.'] };
      }

      set({ improvingBrief: true });
      try {
        const response = await fetch('/api/ai/brief', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            brief: original,
            company: {
              name: brand.company.name,
              segment: brand.company.segment,
              description: brand.company.description,
            },
          }),
        });

        const data = await response.json();
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error ?? 'Não foi possível melhorar o pedido.');
        }

        /*
          O estado mais recente, não o do início do pedido.

          O cliente pode ter continuado a escrever enquanto a chamada corria.
          Se o texto mudou, não lhe passamos por cima: o que ele escreveu
          ganha ao que nós propomos, que é a regra do produto inteiro.
        */
        const current = get().project;
        if (!current) return { ok: false };
        if (current.brief.trim() !== original) {
          return {
            ok: false,
            errors: ['Continuaste a escrever. Experimenta outra vez quando acabares.'],
          };
        }

        set({ project: { ...current, brief: data.brief } });
        scheduleSave();

        const changes = Array.isArray(data.changes) ? data.changes : [];
        return {
          ok: true,
          notice:
            changes.length > 0
              ? `Pedido organizado: ${changes.slice(0, 3).join(', ')}.`
              : 'Pedido organizado.',
        };
      } catch (error) {
        return {
          ok: false,
          errors: [
            error instanceof Error
              ? error.message
              : 'Não foi possível melhorar o pedido. O teu texto ficou como estava.',
          ],
        };
      } finally {
        set({ improvingBrief: false });
      }
    },

    rename(name) {
      const { project } = get();
      if (!project) return;
      // Espaços repetidos fora, e um nome vazio volta ao de omissão em vez
      // de deixar uma publicação sem rótulo na lista.
      const clean = name.replace(/\s+/g, ' ').trim() || DEFAULT_PROJECT_NAME;
      if (clean === project.name) return;
      set({ project: { ...project, name: clean } });
      scheduleSave();
    },

    async addImages(files) {
      const { project, brand } = get();
      if (!project || !brand) return { ok: false };

      const room = APP.uploads.maxImagesPerProject - project.composition.images.length;
      if (room <= 0) {
        return {
          ok: false,
          errors: [`Já tens ${APP.uploads.maxImagesPerProject} fotografias nesta publicação.`],
        };
      }

      const accepted: File[] = [];
      const errors: string[] = [];
      for (const file of files.slice(0, room)) {
        const check = checkImageFile(file, 'product');
        if (check.ok) accepted.push(file);
        else errors.push(`${file.name}: ${check.reason}`);
      }
      if (files.length > room) {
        errors.push(`Só couberam ${room} das ${files.length} fotografias escolhidas.`);
      }
      if (accepted.length === 0) return { ok: false, errors };

      set((state) => ({ uploading: state.uploading + accepted.length }));
      const backend = getBackend();
      const newAssets: Record<string, ResolvedAsset> = {};
      const added: string[] = [];

      for (const file of accepted) {
        try {
          const size = await readImageSize(file).catch(() => null);
          const asset = await backend.uploadAsset({
            accountId: project.accountId,
            kind: 'product',
            file,
            name: file.name,
            width: size?.width ?? null,
            height: size?.height ?? null,
          });
          const url = await backend.resolveAssetUrl(asset);
          registerAsset(asset, url);
          newAssets[asset.id] = { url, width: asset.width, height: asset.height };
          added.push(asset.id);
        } catch (error) {
          errors.push(
            `${file.name}: ${error instanceof Error ? error.message : 'falha ao carregar.'}`,
          );
        } finally {
          set((state) => ({ uploading: Math.max(0, state.uploading - 1) }));
        }
      }

      if (added.length === 0) return { ok: false, errors };

      set((state) => ({ assets: { ...state.assets, ...newAssets } }));
      mutate((composition) => ({
        ...composition,
        images: [
          ...composition.images,
          ...added.map((assetId) => ({
            assetId,
            focal: { x: 0.5, y: 0.5 },
            note: '',
            kind: 'produto' as const,
          })),
        ],
      }));

      return { ok: true, errors: errors.length > 0 ? errors : undefined };
    },

    removeImage(assetId) {
      mutate((composition) => {
        const images = composition.images.filter((image) => image.assetId !== assetId);
        return {
          ...composition,
          images,
          mainImageIndex: Math.min(composition.mainImageIndex, Math.max(0, images.length - 1)),
        };
      });
    },

    setMainImage(index) {
      mutate((composition) => ({
        ...composition,
        mainImageIndex: Math.min(Math.max(index, 0), Math.max(0, composition.images.length - 1)),
      }));
    },

    async replaceImage(assetId, file) {
      const { project } = get();
      if (!project) return { ok: false };

      const check = checkImageFile(file, 'product');
      if (!check.ok) return { ok: false, errors: [check.reason] };

      set((state) => ({ uploading: state.uploading + 1 }));
      try {
        const backend = getBackend();
        const size = await readImageSize(file).catch(() => null);
        const asset = await backend.uploadAsset({
          accountId: project.accountId,
          kind: 'product',
          file,
          name: file.name,
          width: size?.width ?? null,
          height: size?.height ?? null,
        });
        const url = await backend.resolveAssetUrl(asset);
        registerAsset(asset, url);
        set((state) => ({
          assets: { ...state.assets, [asset.id]: { url, width: asset.width, height: asset.height } },
        }));
        mutate((composition) => ({
          ...composition,
          images: composition.images.map((image) =>
            image.assetId === assetId
              ? { assetId: asset.id, focal: { x: 0.5, y: 0.5 }, note: image.note, kind: image.kind }
              : image,
          ),
        }));
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          errors: [
            error instanceof Error ? error.message : 'Não foi possível substituir a imagem.',
          ],
        };
      } finally {
        set((state) => ({ uploading: Math.max(0, state.uploading - 1) }));
      }
    },

    addItem(name) {
      const { project } = get();
      if (!project) return;
      /*
        Só um texto vira nome. Um evento de clique passado por engano como
        argumento ficava gravado como nome do produto e rebentava a revisão
        (`item.name.trim is not a function`).
      */
      const safeName = typeof name === 'string' ? name : '';
      // O mesmo limite que a revisão mostra; era o do modelo antigo (cinco).
      const capacity = APP.itemCapacity;
      if (project.composition.items.length >= capacity) {
        set({
          notice: `Uma publicação mostra até ${capacity} produtos. Remove um antes de acrescentar outro.`,
        });
        return;
      }
      mutate((composition) => ({
        ...composition,
        items: [...composition.items, createItem(safeName)],
      }));
    },

    removeItem(itemId) {
      mutate((composition) => {
        const index = composition.items.findIndex((item) => item.id === itemId);
        if (index === -1) return composition;
        const items = composition.items.filter((item) => item.id !== itemId);
        // O destaque acompanha: se a peça removida era a escolhida, passa
        // para a que ficou no lugar dela.
        const highlighted =
          composition.highlightedItemIndex > index
            ? composition.highlightedItemIndex - 1
            : composition.highlightedItemIndex;
        return {
          ...composition,
          items,
          highlightedItemIndex: Math.min(Math.max(highlighted, 0), Math.max(0, items.length - 1)),
        };
      });
    },

    setItemName(itemId, name) {
      // Guardado como foi escrito: um `trim` aqui impedia escrever nomes de
      // mais de uma palavra. Mesma causa que em `setText`.
      mutate((composition) => ({
        ...composition,
        items: composition.items.map((item) =>
          // Edição manual: fica protegida de novas propostas.
          item.id === itemId ? { ...item, name, locked: true } : item,
        ),
      }));
    },

    setItemLock(itemId, locked) {
      mutate((composition) => ({
        ...composition,
        items: composition.items.map((item) =>
          item.id === itemId ? { ...item, locked } : item,
        ),
      }));
    },

    setImageNote(assetId, note) {
      // Guardado como foi escrito, pela mesma razão de `setText`.
      mutate((composition) => ({
        ...composition,
        images: composition.images.map((image) =>
          image.assetId === assetId ? { ...image, note } : image,
        ),
      }));
    },

    setImageKind(assetId, kind) {
      mutate((composition) => ({
        ...composition,
        images: composition.images.map((image) =>
          image.assetId === assetId ? { ...image, kind } : image,
        ),
      }));
    },

    setLayout(layout) {
      mutate((composition) => {
        const direction = composition.direction;
        if (!direction || direction.layout === layout) return composition;
        /*
          `layoutChanged`: a frase de composição que o modelo escreveu era
          para a grelha dele. Com outra, quem descreve a disposição é o
          esboço — a frase antiga contradizia-o.
        */
        return withDirection(composition, { ...direction, layout, layoutChanged: true });
      });
    },

    async setItemImage(itemId, file) {
      const { project } = get();
      if (!project) return { ok: false };

      const check = checkImageFile(file, 'product');
      if (!check.ok) return { ok: false, errors: [check.reason] };

      set((state) => ({ uploading: state.uploading + 1 }));
      try {
        const backend = getBackend();
        const size = await readImageSize(file).catch(() => null);
        const asset = await backend.uploadAsset({
          accountId: project.accountId,
          kind: 'product',
          file,
          name: file.name,
          width: size?.width ?? null,
          height: size?.height ?? null,
        });
        const url = await backend.resolveAssetUrl(asset);
        registerAsset(asset, url);
        set((state) => ({
          assets: {
            ...state.assets,
            [asset.id]: { url, width: asset.width, height: asset.height },
          },
        }));
        mutate((composition) => ({
          ...composition,
          items: composition.items.map((item) =>
            item.id === itemId ? { ...item, assetId: asset.id } : item,
          ),
        }));
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          errors: [
            error instanceof Error
              ? error.message
              : 'Não foi possível usar esta imagem na peça.',
          ],
        };
      } finally {
        set((state) => ({ uploading: Math.max(0, state.uploading - 1) }));
      }
    },

    clearItemImage(itemId) {
      mutate((composition) => ({
        ...composition,
        items: composition.items.map((item) =>
          item.id === itemId ? { ...item, assetId: null } : item,
        ),
      }));
    },

    setHighlightedItem(index) {
      mutate((composition) => ({
        ...composition,
        highlightedItemIndex: Math.min(
          Math.max(index, 0),
          Math.max(0, composition.items.length - 1),
        ),
      }));
    },

    setFormat(format) {
      const current = get().project?.composition;
      // Se o modelo actual não serve o novo formato, o motor cairia num
      // modelo de reserva sem dizer nada. Preferimos avisar.
      const servesFormat = current
        ? getTemplate(current.templateId).formats.includes(format)
        : true;

      // As posições manuais são relativas às proporções da arte: mudar de
      // formato invalida-as. O logótipo volta a caber na grelha do formato.
      mutate((composition) =>
        withDirection({ ...composition, format, overrides: {} }, composition.direction),
      );

      if (!servesFormat) {
        set({
          notice:
            'O modelo actual não foi pensado para este formato. Toca em "Actualizar proposta" para escolher outro.',
        });
      }
    },

    setStyle(style) {
      // O estilo pesa na escolha das referências: escolhem-se de novo.
      mutate((composition) => withDirection({ ...composition, style }, composition.direction));
    },

    setColors(colors) {
      // Nota: isto altera APENAS esta publicação. O perfil da empresa fica
      // intacto — ver `resetColorsToBrand` para voltar atrás.
      mutate((composition) => ({
        ...composition,
        colors: { ...composition.colors, ...colors },
        colorsFromBrand: false,
      }));
    },

    resetColorsToBrand() {
      const { brand } = get();
      if (!brand) return;
      mutate((composition) => ({
        ...composition,
        colors: { ...brand.identity.colors },
        colorsFromBrand: true,
      }));
    },

    setFonts(fonts) {
      mutate((composition) => ({ ...composition, ...fonts }));
    },

    toggleContact(contact, enabled) {
      mutate((composition) => {
        const without = composition.contacts.filter((item) => item.type !== contact.type);
        return {
          ...composition,
          contacts: enabled ? [...without, contact] : without,
        };
      });
    },

    setContactValue(type, value) {
      // O `trim` decide se o contacto fica ligado; o valor guardado é o que
      // foi escrito. Endereços têm espaços e eram impossíveis de escrever.
      const empty = value.trim().length === 0;
      mutate((composition) => {
        const without = composition.contacts.filter((item) => item.type !== type);
        // Escrever um valor é o acto que liga o contacto: ninguém escreve um
        // número para o deixar de fora. Apagar tudo desliga-o.
        return {
          ...composition,
          contacts: empty ? without : [...without, { type, value }],
        };
      });
    },

    setLogoVisible(visible) {
      mutate((composition) => ({
        ...composition,
        logo: { ...composition.logo, show: visible },
      }));
    },

    setLogoVariant(variant) {
      mutate((composition) => ({ ...composition, logo: { ...composition.logo, variant } }));
    },

    setVisualDirection(text) {
      mutate(
        (composition) => ({
          ...composition,
          visualDirection: text,
          visualDirectionLocked: true,
        }),
        { history: false },
      );
    },

    async preparePlan(options = {}) {
      const { project, brand } = get();
      if (!project || !brand) return { ok: false };

      /*
        "Melhorar a ideia" só existe com uma ideia para melhorar. Sem ela, o
        pedido é o de uma proposta normal.
      */
      const refinement = (options.refine ?? '').replace(/\s+/g, ' ').trim().slice(0, 600);
      const refine = refinement.length > 0 && Boolean(project.composition.direction?.idea);
      // Sem ideia nenhuma, "Outra ideia" é a primeira: não há o que trocar.
      const reshuffle =
        !refine && Boolean(options.reshuffle) && Boolean(project.composition.direction?.idea);
      const attempt = reshuffle ? get().attempt + 1 : get().attempt;

      /*
        "Outra ideia" é uma recusa, e a memória da empresa aprende com ela.

        Uma recusa só não diz muito; quatro recusas de cenas com pessoas
        dizem que esta empresa prefere o produto em destaque.
      */
      const rejected = project.composition.direction;
      if (reshuffle && rejected?.idea) {
        remember({
          kind: 'outra-ideia',
          projectId: project.id,
          detail: `Recusou a ideia «${quote(rejected.idea)}»${
            rejected.approach ? ` (abordagem ${rejected.approach})` : ''
          } e pediu outra.`,
        });
      }
      /*
        Uma melhoria diz ainda mais do que uma recusa: o cliente gostou da
        ideia e disse o que lhe faltava. "Mais luz", "sem pessoas", "o
        produto maior" — repetidos, são preferências da marca.
      */
      if (refine && rejected?.idea) {
        remember({
          kind: 'melhoria',
          projectId: project.id,
          detail: `Pediu para melhorar a ideia «${quote(rejected.idea, 100)}»: «${quote(refinement, 160)}».`,
        });
      }

      /*
        "Outra ideia" usa primeiro uma candidata já proposta.

        ──────────────────────────────────────────────────────────────────────
        O modelo propõe duas ou três direcções em cada chamada e nós guardamos
        as que sobram. Pedir outra ideia gasta primeiro essas: é instantâneo e
        não custa nada.
        
        Isto substituiu `nextArrangement`, que percorria as VARIAÇÕES DE
        DISPOSIÇÃO do modelo — texto à esquerda, ao centro, à direita. Mudar o
        lado do texto não é outra ideia; é a mesma ideia alinhada de outra
        maneira, e era por isso que "outra composição" devolvia sempre a mesma
        arte.
        ──────────────────────────────────────────────────────────────────────
      */
      /*
        As ideias que o cliente já viu nesta publicação, para a próxima ser
        mesmo outra. A actual entra quando ele a troca.
      */
      const seenIdeas = [
        ...new Set(
          [...(project.composition.seenIdeas ?? []), reshuffle ? rejected?.idea : null].filter(
            (idea): idea is string => Boolean(idea),
          ),
        ),
      ].slice(-12);

      const banked = project.composition.alternatives;
      if (reshuffle && banked.length > 0) {
        const [next, ...rest] = banked;
        mutate((composition) => ({
          ...withDirection(composition, next),
          alternatives: rest,
          seenIdeas,
          // As posições manuais eram relativas à ideia anterior.
          overrides: {},
          // A nota visual acompanha a ideia nova (ver `applyPlan`).
          visualDirection: next.idea,
          visualDirectionLocked: false,
        }));
        set({ attempt, notice: null });
        return { ok: true };
      }

      /*
        Os passos do indicador, pelo caminho que este pedido segue.

        Era "A ler o teu pedido" e depois "A procurar outra ideia" — também
        na primeira proposta, onde não há outra ideia nenhuma. O cliente lia
        que estávamos a trocar uma ideia que ele nunca viu.
      */
      const steps = refine
        ? ['A ler o que pediste', 'A melhorar a ideia']
        : reshuffle
          ? ['A ler o teu pedido', 'A formular outra ideia']
          : ['A ler o teu pedido', 'A formular a ideia'];
      const startedAt = Date.now();
      set({
        planning: true,
        notice: null,
        phase: {
          kind: 'plano',
          label: steps[0],
          steps,
          ...(refine ? { title: 'A melhorar a proposta' } : {}),
          indeterminate: true,
          startedAt,
        },
      });
      try {
        const texts = project.composition.texts;
        const lockedTexts: Record<string, string> = {};
        // Apagados pelo cliente: protegidos e vazios. Ver `setText`.
        const removedTexts: TextRole[] = [];
        const currentTexts: Record<string, string> = {};
        for (const role of TEXT_ROLES) {
          const entry = texts[role];
          if (entry?.locked && entry.value) lockedTexts[role] = entry.value;
          if (entry?.locked && !entry.value.trim() && role !== 'headline') removedTexts.push(role);
          // Aparado ao limite do pedido: um texto longo não pode chumbar a melhoria.
          if (entry?.value.trim()) currentTexts[role] = entry.value.trim().slice(0, 240);
        }

        // Lidas as imagens anexadas, a ideia começa a ser formulada.
        const attachments = await attachmentsFor(project.composition, get().assets);
        set((state) =>
          state.phase?.startedAt === startedAt
            ? { phase: { ...state.phase, label: steps[1] } }
            : {},
        );

        const response = await fetch('/api/ai/plan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            brief: project.brief,
            format: project.composition.format,
            style: project.composition.style,
            imageCount: project.composition.images.length,
            itemCount: project.composition.items.length,
            attempt,
            /*
              O que o servidor precisa de saber para não repetir.

              `currentIdea` só vai quando o cliente pediu outra: fora disso
              não há ideia a evitar. `recentIdeas` é o controlo de variedade
              (§14) — as ideias de outras publicações desta marca.
            */
            currentIdea:
              reshuffle || refine
                ? (project.composition.direction?.idea ?? undefined)
                : undefined,
            /*
              Na melhoria, o que o cliente pediu e os textos que já reviu: a
              ideia muda no que ele disse, e o resto fica.
            */
            refinement: refine ? refinement : undefined,
            currentTexts: refine ? currentTexts : undefined,
            removedTexts,
            seenIdeas,
            recentIdeas: get().recentIdeas,
            /*
              As regras da identidade entram no CONCEITO, não só na geração.

              Antes só chegavam ao prompt da imagem, pelo que o conceito era
              proposto sem saber o que a marca proíbe e só depois era
              corrigido — ou não era.
            */
            identity: identityRulesFrom(brand),
            /*
              O estilo aprendido com as artes da empresa, em palavras.

              Entra no CONCEITO, e não só na imagem: uma marca que publica
              cartazes tipográficos e planos não deve receber três ideias de
              cena cinematográfica para depois o gerador as "corrigir".
            */
            learnedStyle: styleSummaryText(brand.identity.styleLearning, 900),
            // O que o uso ensinou sobre esta empresa, em regras curtas.
            memory: activeMemoryRules(brand.identity.memory),
            // As imagens anexadas, vistas pelo modelo que cria a ideia.
            attachments,
            brand: {
              name: brand.company.name,
              segment: brand.company.segment,
              description: brand.company.description,
              contacts: project.composition.contacts,
              colors: project.composition.colors,
            },
            lockedTexts,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error ?? 'O servidor não conseguiu preparar a publicação.');
        }

        const plan = data.plan as Plan;
        const direction = (data.direction ?? null) as CreativeDirection | null;
        const style = (data.style ?? project.composition.style) as StyleId;
        /*
          Na melhoria, as alternativas guardadas ficam: são as ideias que o
          cliente ainda não viu, e "Outra ideia" a seguir deve mostrar uma
          delas — não uma variação da que ele acabou de melhorar.
        */
        const alternatives = refine
          ? project.composition.alternatives
          : ((data.alternatives ?? []) as CreativeDirection[]);
        const keepTexts = refine && !mentionsTexts(refinement);
        const keepItems = refine && !mentionsItems(refinement);
        /*
          A grelha que o cliente escolheu à mão sobrevive à melhoria: ele
          melhorou a ideia, não pediu outra disposição.
        */
        const current = project.composition.direction;
        const settled =
          refine && direction && current?.layoutChanged && current.layout
            ? { ...direction, layout: current.layout, layoutChanged: true }
            : direction;

        mutate(
          (composition) =>
            withDirection(
              {
                ...applyPlan(composition, plan, { keepTexts, keepItems }),
                alternatives,
                // A ideia melhorada não é uma ideia vista e trocada.
                seenIdeas: reshuffle ? seenIdeas : composition.seenIdeas,
                // `auto` resolve-se numa escolha concreta: o cliente passa a
                // ver qual foi, em vez de ficar com "automático" no selector.
                style,
              },
              settled,
            ),
          { status: 'composicao' },
        );

        set((state) => ({
          attempt,
          planSource: data.source,
          notice: data.notice ?? null,
          // A proposta existe: o cliente passa a revê-la antes de gerar.
          stage: state.stage === 'arte' ? 'arte' : 'revisao',
          project: state.project
            ? { ...state.project, missingFields: plan.missingFields ?? [], planSource: data.source }
            : null,
        }));

        /*
          Sem `notice` no resultado: o aviso já fica no topo do editor
          (`notice`, acima), e devolvê-lo fazia o mesmo texto aparecer
          também numa notificação — duas vezes a mesma frase.
        */
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          errors: [
            error instanceof Error
              ? error.message
              : 'Não foi possível preparar a composição. O teu rascunho não foi alterado.',
          ],
        };
      } finally {
        set({ planning: false, phase: null });
      }
    },

    async generateFinalArt() {
      const { project, brand } = get();
      if (!project || !brand) return { ok: false };

      const format = getFormat(project.composition.format);
      set({ generating: true, notice: null });

      try {
        const response = await fetch('/api/ai/background', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            prompt: project.composition.background.prompt || project.composition.visualDirection,
            templateId: project.composition.templateId,
            format: project.composition.format,
            style: project.composition.style,
            colors: project.composition.colors,
            seed: project.brief || project.name,
            attempt: get().attempt,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error ?? 'A geração do fundo falhou.');
        }

        let blob: Blob;
        let width = format.width;
        let height = format.height;
        const producedBy: 'ia' | 'local' = data.mode === 'ia' ? 'ia' : 'local';

        if (data.mode === 'ia' && typeof data.dataUrl === 'string') {
          const fetched = await fetch(data.dataUrl);
          // O gerador devolve mais resolução do que a arte usa. Reduzimos à
          // largura do formato antes de guardar — e redesenhamos sempre, para
          // não guardar os metadados do gerador (ver `generateArtwork`).
          const reduced = await downscaleImageBlob(await fetched.blob(), format.width, 0.92, {
            reencode: true,
          });
          blob = reduced.blob;
          if (reduced.width > 0) {
            width = reduced.width;
            height = reduced.height;
          }
        } else {
          const recipe = data.recipe as BackgroundRecipe;
          const canvas = paintBackground(recipe, format.width, format.height);
          blob = await backgroundToBlob(canvas);
        }

        const backend = getBackend();
        const asset = await backend.uploadAsset({
          accountId: project.accountId,
          kind: 'generated-bg',
          file: blob,
          name: producedBy === 'ia' ? 'fundo-gerado' : 'fundo-local',
          width,
          height,
          provenance: producedBy === 'ia' ? 'ia' : 'local',
        });
        const url = await backend.resolveAssetUrl(asset);
        registerAsset(asset, url);

        set((state) => ({
          assets: { ...state.assets, [asset.id]: { url, width, height } },
          backgroundMode: producedBy,
          notice: data.notice ?? null,
          view: 'arte-final',
        }));

        // O fundo é uma camada própria. Mudar o preço mais tarde não mexe aqui.
        mutate(
          (composition) => ({
            ...composition,
            background: {
              mode: 'gerado',
              assetId: asset.id,
              prompt: composition.background.prompt,
              producedBy,
            },
          }),
          { status: 'arte-final' },
        );

        return { ok: true, notice: data.notice };
      } catch (error) {
        // O rascunho e todas as edições mantêm-se exactamente como estavam.
        return {
          ok: false,
          errors: [
            error instanceof Error
              ? error.message
              : 'Não foi possível gerar a arte. O teu rascunho está intacto.',
          ],
        };
      } finally {
        set({ generating: false });
      }
    },

    async generateArtwork() {
      const { project, brand, assets } = get();
      if (!project || !brand) return { ok: false };

      const composition = project.composition;
      if (!composition.texts.headline?.value?.trim()) {
        return {
          ok: false,
          errors: ['Falta o título. Confirma os textos na revisão antes de gerar.'],
        };
      }

      /*
        Sem direcção criativa não se gera.

        Antes bastava um `templateId`, e havia sempre um por omissão — por
        isso era impossível chegar à geração sem composição. Agora a
        composição é uma ideia criada para o pedido, e não existe por
        omissão: se falta, o pedido ainda não foi interpretado.
      */
      if (!composition.direction) {
        return {
          ok: false,
          errors: [
            'Ainda não há uma ideia para esta publicação. Volta a preparar a proposta antes de gerar.',
          ],
        };
      }

      const format = getFormat(composition.format);
      /*
        O logótipo e os contactos fazem SEMPRE parte da arte.

        ────────────────────────────────────────────────────────────────────
        Havia dois interruptores — "colar o meu ficheiro por cima" e "colar
        os contactos por cima" — que punham a aplicação a desenhar o
        logótipo e a linha de contactos sobre a arte acabada. Saíram, a
        pedido do cliente: o resultado parecia colado, e o logótipo caía em
        cima do texto que o gerador tinha posto naquele canto.

        A exactidão que os interruptores davam passou a vir de três
        técnicas, todas nesta função ou chamadas daqui:

         1. o ficheiro certo para o fundo, em primeiro lugar, preparado no
            servidor (`buildReferences`, `prepareLogoReference`);
         2. a transcrição do logótipo no prompt (`readLogo`);
         3. a VERIFICAÇÃO depois de gerar, com uma correcção automática
            quando o logótipo sai errado (`reviewArtwork`).

        A terceira é a que importa. As duas primeiras reduzem a
        probabilidade de erro; a verificação é a única que o apanha.
        ────────────────────────────────────────────────────────────────────
      */
      const drawLogo = composition.logo.show;

      // Um só relógio para a operação inteira: reiniciá-lo em cada passo
      // escondia que gerar, verificar e corrigir leva minutos, não segundos.
      const startedAt = Date.now();
      const phaseOf = (label: string, extra: Partial<WorkPhase> = {}): WorkPhase => ({
        kind: 'arte',
        label,
        indeterminate: true,
        startedAt,
        ...extra,
      });

      set({
        generating: true,
        notice: null,
        phase: phaseOf('A preparar os produtos e a marca', { indeterminate: false }),
      });

      try {
        const { list: references, libraryUsed } = await buildReferences({
          composition,
          brand,
          assets,
          includeLogo: drawLogo,
          projectId: project.id,
          brief: [
            project.brief,
            composition.texts.headline?.value,
            ...composition.items.map((item) => item.name),
          ]
            .filter(Boolean)
            .join(' '),
        });
        const logoReference =
          references.find((reference) => reference.role === 'logotipo')?.dataUrl ?? null;
        // A arte de outra empresa, para o verificador confirmar que não se copiou.
        const recreateReference =
          references.find((reference) => reference.role === 'recriar')?.dataUrl ?? null;

        /*
          ────────────────────────────────────────────────────────────────────
          O ESBOÇO aprovado na revisão, logo a seguir ao logótipo.

          É o mesmo que o cliente viu — a mesma função, com a mesma entrada —,
          desenhado em cinzentos na proporção do gerador, com a moldura da
          publicação ao centro. E vai por palavras também, zona a zona.

          Sem esboço (uma direcção sem grelha que falhou), a geração segue:
          a disposição volta a ser do gerador, como antes.
          ────────────────────────────────────────────────────────────────────
        */
        let layoutForPrompt: { label: string; zones: string[] } | null = null;
        const sketchInput = sketchInputFor(composition, brand, assets);
        if (sketchInput) {
          try {
            const sketch = computeSketch(sketchInput);
            const ratio = await generatorRatio(composition.format);
            const label = getLayout(sketch.layout).label;
            const at = references[0]?.role === 'logotipo' ? 1 : 0;
            references.splice(at, 0, {
              role: 'esboco',
              label,
              dataUrl: paintGeneratorSketch(sketch, ratio, sketchInput.fonts),
            });
            layoutForPrompt = { label, zones: describeSketch(sketch, ratio) };
          } catch {
            layoutForPrompt = null;
          }
        }

        const texts = {
          headline: composition.texts.headline?.value.trim() ?? '',
          subheadline: composition.texts.subheadline?.value.trim() ?? '',
          cta: composition.texts.cta?.value.trim() ?? '',
          badge: composition.texts.badge?.value.trim() ?? '',
          price: composition.texts.price?.value.trim() ?? '',
        };
        const contacts = namedContactsOf(composition);

        const request = {
          /*
            A direcção aprovada, com a ideia que o cliente possa ter
            reescrito.

            `visualDirectionLocked` é a prova de que ele mexeu no campo. O
            gerador recebe o texto dele, não o nosso: é a primeira linha da
            prioridade da informação — o que o cliente confirmou ganha a tudo
            o resto.
          */
          direction: {
            ...composition.direction,
            idea:
              composition.visualDirectionLocked && composition.visualDirection.trim()
                ? composition.visualDirection.trim()
                : composition.direction.idea,
            // Com a grelha trocada, a frase do modelo descrevia outra
            // disposição: quem manda é o esboço.
            composition: composition.direction.layoutChanged
              ? ''
              : composition.direction.composition,
          },
          // A disposição do esboço, zona a zona.
          layout: layoutForPrompt,
          referenceUsage: composition.references,
          format: composition.format,
          style: composition.style,
          company: brand.company.name,
          segment: brand.company.segment,
          colors: composition.colors,
          // A cor que pinta o fundo desta arte; a outra é o realce.
          base: composition.base ?? 'primaria',
          logoSize: composition.logo.size,
          contactsPlacement: composition.contactsPlacement ?? 'texto',
          typography: {
            display: getFont(composition.fontDisplay).label,
            body: getFont(composition.fontBody).label,
            displayKind: getFont(composition.fontDisplay).kind,
            bodyKind: getFont(composition.fontBody).kind,
          },
          texts,
          items: composition.items.map((item, index) => ({
            name: item.name.trim(),
            highlighted: index === composition.highlightedItemIndex,
            hasImage: Boolean(item.assetId),
          })),
          drawLogo,
          contacts,
          references,
          // Identidade aprovada no cadastro: é o que mantém as publicações
          // desta empresa coerentes entre si.
          guidelines: guidelinesFrom(brand),
          // O estilo das artes que a empresa já publicou. As artes da
          // biblioteca seguem em `references`, com o papel `estilo-marca`.
          brandStyle: styleForArtwork(brand.identity.styleLearning),
          // O que o uso ensinou sobre esta empresa.
          memory: activeMemoryRules(brand.identity.memory),
        };

        const reviewInput = {
          format: composition.format,
          logo: drawLogo ? logoReference : null,
          headline: texts.headline,
          texts: [texts.subheadline, texts.cta, texts.price, texts.badge].filter(Boolean),
          contacts: contacts.map((contact) => contact.value),
          recreate: recreateReference,
          // O único preço que a arte pode ter; qualquer outro é inventado.
          prices: texts.price ? [texts.price] : [],
          /*
            Sem botão: o cliente retirou-o, ou nunca houve. Uma arte que saia
            com um botão inventado é corrigida — foi o defeito que o cliente
            apontou ("pedi para remover o CTA e ela gerou com CTA").
          */
          noCta: !texts.cta,
          sketch: Boolean(layoutForPrompt),
          // O que os exemplos de acabamento mostravam: a arte não os repete.
          examples: (composition.references ?? [])
            .map((usage) => getReference(usage.referenceId)?.content ?? '')
            .filter(Boolean)
            .slice(0, 3),
        };

        /*
          Os textos que o cliente reescreveu, para a memória da empresa.

          Só os que ele mudou à mão em relação ao que a IA propôs — é a
          correcção mais directa que existe do que a empresa quer dizer.
        */
        for (const role of TEXT_ROLES) {
          const entry = composition.texts[role];
          if (!entry?.locked || !entry.proposed) continue;
          const now = entry.value.trim();
          if (!now || now === entry.proposed.trim()) continue;
          remember({
            kind: 'texto',
            projectId: project.id,
            detail: `Reescreveu ${TEXT_ROLE_LABELS[role].toLowerCase()}: «${quote(entry.proposed, 90)}» passou a «${quote(now, 90)}».`,
          });
        }

        set({ phase: phaseOf('A gerar a publicação') });
        const first = await requestArtwork(request, []);

        set({ phase: phaseOf('A verificar o logótipo e as margens') });
        const firstReview = await reviewArtwork({ art: first, ...reviewInput });

        let chosen = first;
        let chosenReview = firstReview;
        let corrected = false;

        /*
          UMA correcção automática, no máximo.

          Cada geração custa perto de 0,20 USD e minuto e meio. Repetir até
          acertar podia custar dez vezes isso sem garantia de sair melhor; uma
          tentativa com os defeitos explícitos no topo do prompt resolve a
          maior parte, e o que sobrar é dito ao cliente com clareza.
        */
        if (firstReview?.retry) {
          set({
            phase: phaseOf('A corrigir e gerar outra vez', {
              retrying: true,
              detail: firstReview.issues[0],
            }),
          });
          try {
            const second = await requestArtwork(request, firstReview.issues.slice(0, 4));
            set({ phase: phaseOf('A verificar a correcção', { retrying: true }) });
            const secondReview = await reviewArtwork({ art: second, ...reviewInput });

            /*
              Fica a melhor das duas.

              Sem verificação da segunda, fica a segunda: foi gerada com as
              correcções explícitas, e da primeira sabemos que falhou.
            */
            if (!secondReview || secondReview.score <= firstReview.score) {
              chosen = second;
              chosenReview = secondReview;
              corrected = true;
            }
          } catch {
            // A correcção falhou: fica a primeira, com o aviso do que
            // encontrámos. Uma arte com defeitos declarados vale mais do que
            // nenhuma arte.
          }
        }

        set({
          phase: phaseOf('A guardar a arte', {
            indeterminate: false,
            retrying: Boolean(firstReview?.retry),
          }),
        });

        /*
          A publicação ainda é a mesma?

          Uma geração leva minuto e meio, e nesse tempo o cliente pode ter
          aberto outra publicação. `mutate` escreve no projecto que estiver
          aberto — e a arte de uma ia parar à outra.
        */
        if (get().project?.id !== project.id) {
          return {
            ok: false,
            errors: [
              'Mudaste de publicação durante a geração, por isso a arte não foi guardada nesta.',
            ],
          };
        }

        const fetched = await fetch(chosen.dataUrl);
        /*
          O gerador devolve mais resolução do que o formato usa — e um
          manifesto C2PA ("trainedAlgorithmicMedia", "OpenAI") num bloco
          `caBX` do PNG, que as redes lêem para pôr "conteúdo gerado por IA".

          Redesenhar SEMPRE pelo canvas (`reencode`) guarda só os píxeis. O
          ficheiro descarregado já era redesenhado; o que ficava com o
          manifesto era a cópia guardada — a que a prévia mostra e que se
          salva com o botão direito —, nos formatos em que o gerador devolve
          a largura certa (quadrado, story, reels) e nada era reduzido.
        */
        const reduced = await downscaleImageBlob(await fetched.blob(), format.width, 0.92, {
          reencode: true,
        });

        const backend = getBackend();
        const asset = await backend.uploadAsset({
          accountId: project.accountId,
          // Reutilizamos este tipo: é o recurso produzido pelo gerador.
          kind: 'generated-bg',
          file: reduced.blob,
          name: 'arte-gerada',
          width: reduced.width || format.width,
          height: reduced.height || format.height,
          provenance: 'ia',
        });
        const url = await backend.resolveAssetUrl(asset);
        registerAsset(asset, url);

        const remaining = chosenReview?.issues ?? [];

        set((state) => ({
          assets: {
            ...state.assets,
            [asset.id]: {
              url,
              width: reduced.width || format.width,
              height: reduced.height || format.height,
            },
          },
          stage: 'arte',
          view: 'arte-final',
          /*
            O que a verificação ainda encontrou fica à vista, num aviso que
            não desaparece sozinho. Uma notificação de três segundos sobre um
            logótipo errado é uma notificação que o cliente não chega a ler
            antes de publicar.
          */
          notice:
            remaining.length > 0
              ? `Verificámos a arte e ainda há ${remaining.length === 1 ? 'um ponto' : 'pontos'} a rever: ${remaining.slice(0, 2).join(' ')} Podes gerar outra vez.`
              : null,
        }));

        mutate(
          (current) => ({
            ...current,
            artwork: {
              assetId: asset.id,
              prompt: chosen.prompt || current.artwork.prompt,
              producedBy: 'ia',
              generatedAt: new Date().toISOString(),
              width: reduced.width || format.width,
              height: reduced.height || format.height,
              origin: 'geracao',
              summary: '',
              // "Gerar outra" já não apaga a anterior: vai para o histórico.
              history: historyWith(current.artwork),
            },
            // A rotação da biblioteca: a próxima geração prefere outras.
            brandRefs: libraryUsed,
            // Um texto reescrito conta uma vez para a memória, não em cada geração.
            texts: settleProposed(current.texts),
            /*
              Uma arte nova nunca leva acabamentos colados por cima.

              Os interruptores saíram do ecrã, mas um projecto antigo pode
              ter as duas opções ligadas. Desligá-las aqui — e não na
              migração — protege as artes antigas: essas foram geradas sem
              logótipo, à espera da camada, e perdê-la deixava-as sem marca.
            */
            finish: { overlayLogo: false, overlayContacts: false },
          }),
          { status: 'arte-final' },
        );

        return {
          ok: true,
          notice:
            remaining.length > 0
              ? undefined
              : corrected
                ? 'Arte gerada. A verificação encontrou um defeito na primeira versão e corrigimo-lo.'
                : chosenReview
                  ? 'Arte gerada e verificada.'
                  : undefined,
        };
      } catch (error) {
        // A revisão fica exactamente como estava.
        return {
          ok: false,
          errors: [
            error instanceof Error
              ? error.message
              : 'Não foi possível gerar a arte. A tua revisão está intacta.',
          ],
        };
      } finally {
        set({ generating: false, phase: null });
      }
    },

    async editArtwork(input) {
      const { project, brand, assets, generating } = get();
      if (!project || !brand) return { ok: false };
      if (generating) {
        return { ok: false, errors: ['Já há uma geração em curso. Espera que termine.'] };
      }

      const composition = project.composition;
      const current = composition.artwork;
      const currentUrl = current.assetId ? assets[current.assetId]?.url : undefined;
      if (!current.assetId || !currentUrl) {
        return { ok: false, errors: ['Ainda não há arte para editar. Gera a arte primeiro.'] };
      }

      const zones = input.zones
        .filter((zone) => zone.shape.strokes.length > 0)
        .slice(0, ZONE_LIMIT);
      if (zones.length === 0) {
        return {
          ok: false,
          errors: ['Pinta primeiro, por cima da arte, a zona que queres mudar.'],
        };
      }
      const silent = zones.findIndex((zone) => zone.comment.trim().length < 3);
      if (silent >= 0) {
        return { ok: false, errors: [`Diz o que queres mudar na zona ${silent + 1}.`] };
      }

      const format = getFormat(composition.format);
      const startedAt = Date.now();
      const phaseOf = (label: string, extra: Partial<WorkPhase> = {}): WorkPhase => ({
        kind: 'edicao',
        label,
        indeterminate: true,
        startedAt,
        ...extra,
      });

      set({
        generating: true,
        notice: null,
        phase: phaseOf('A preparar as zonas', { indeterminate: false }),
      });

      try {
        const prepared = await prepareZoneEdit({
          artUrl: currentUrl,
          // A moldura da publicação: é sobre ela que o cliente pintou.
          frame: { width: format.width, height: format.height },
          zones: zones.map((zone) => zone.shape),
        });
        const logo = await logoDataUrlFor(brand, composition, assets);
        const texts = (['headline', 'subheadline', 'cta', 'price', 'badge'] as const)
          .map((role) => composition.texts[role]?.value.trim() ?? '')
          .filter(Boolean);
        const contacts = namedContactsOf(composition).map((contact) => contact.value);

        const request = {
          art: prepared.art,
          map: prepared.map,
          format: composition.format,
          zones: zones.map((zone, index) => ({
            request: zone.comment.trim(),
            position: zone.position,
            mask: prepared.masks[index],
            image: zone.image,
          })),
          preserveOutside: input.preserveOutside,
          company: brand.company.name,
          colors: composition.colors,
          texts,
          contacts,
          logo,
        };

        const reviewInput = {
          format: composition.format,
          logo: null,
          headline: composition.texts.headline?.value.trim() ?? '',
          texts: [],
          contacts,
          edit: {
            before: prepared.art,
            zones: zones.map((zone, index) => ({
              number: index + 1,
              request: zone.comment.trim(),
              position: zone.position,
            })),
          },
        };

        set({ phase: phaseOf('A aplicar as alterações') });
        const first = await requestEdit(request, []);

        set({ phase: phaseOf('A verificar as alterações') });
        const firstReview = await reviewArtwork({ art: first, ...reviewInput });

        let chosen = first;
        let chosenReview = firstReview;
        let corrected = false;

        /*
          A mesma regra da geração: UMA correcção automática, no máximo.

          Uma zona que não mudou, marcas do mapa na arte ou um logótipo que
          ficou pior justificam outra tentativa. Uma RECOMPOSIÇÃO também —
          o cliente pediu para o resto ficar igual e o gerador mexeu na arte
          toda —, porque repetir é a única forma de cumprir o que ele pediu.
        */
        const recomposedFirst = input.preserveOutside && !first.composited;
        const firstIssues = [
          ...(recomposedFirst
            ? [
                'A arte foi recomposta: o enquadramento mudou. Mantém tudo exactamente na mesma posição e no mesmo tamanho, e muda só as zonas pedidas.',
              ]
            : []),
          ...(firstReview?.issues ?? []),
        ];

        if (firstReview?.retry || recomposedFirst) {
          set({
            phase: phaseOf('A corrigir e aplicar outra vez', {
              retrying: true,
              detail: firstIssues[0],
            }),
          });
          try {
            const second = await requestEdit(request, firstIssues.slice(0, 4));
            set({ phase: phaseOf('A verificar a correcção', { retrying: true }) });
            const secondReview = await reviewArtwork({ art: second, ...reviewInput });

            // Uma recomposição pesa como um defeito grave: o cliente pediu
            // explicitamente para o resto ficar igual.
            const firstScore = (firstReview?.score ?? 0) + (recomposedFirst ? 3 : 0);
            const secondScore =
              (secondReview?.score ?? 0) +
              (input.preserveOutside && !second.composited ? 3 : 0);
            if (secondScore <= firstScore) {
              chosen = second;
              chosenReview = secondReview;
              corrected = true;
            }
          } catch {
            // A correcção falhou: fica a primeira, com o aviso do que vimos.
          }
        }

        set({
          phase: phaseOf('A guardar a nova versão', {
            indeterminate: false,
            retrying: Boolean(firstReview?.retry || recomposedFirst),
          }),
        });

        // A mesma guarda da geração: a edição pertence a ESTA publicação.
        if (get().project?.id !== project.id) {
          return {
            ok: false,
            errors: [
              'Mudaste de publicação durante a edição, por isso a nova versão não foi guardada nesta.',
            ],
          };
        }

        const fetched = await fetch(chosen.dataUrl);
        // Redesenhada sempre, como a geração: só os píxeis, sem os metadados
        // do gerador (ver `generateArtwork`).
        const reduced = await downscaleImageBlob(await fetched.blob(), format.width, 0.92, {
          reencode: true,
        });
        const width = reduced.width || prepared.width;
        const height = reduced.height || prepared.height;

        const backend = getBackend();
        const asset = await backend.uploadAsset({
          accountId: project.accountId,
          kind: 'generated-bg',
          file: reduced.blob,
          name: 'arte-editada',
          width,
          height,
          provenance: 'ia',
        });
        const url = await backend.resolveAssetUrl(asset);
        registerAsset(asset, url);

        const remaining = [
          ...(input.preserveOutside && !chosen.composited
            ? ['A IA mexeu também fora das zonas — confirma o resto da arte.']
            : []),
          ...(chosenReview?.issues ?? []),
        ];
        const summary = zones
          .map((zone, index) => `Zona ${index + 1}: ${zone.comment.trim()}`)
          .join(' · ')
          .slice(0, 400);

        /*
          O que o cliente corrige numa edição é o sinal mais claro do que
          a empresa quer — "aumenta o logótipo", "tira as pessoas".
        */
        remember({
          kind: 'edicao',
          projectId: project.id,
          detail: `Numa edição por zonas pediu: ${zones
            .map((zone) => `«${quote(zone.comment, 90)}» (${zone.position})`)
            .join('; ')}.`,
        });

        set((state) => ({
          assets: { ...state.assets, [asset.id]: { url, width, height } },
          stage: 'arte',
          view: 'arte-final',
          notice:
            remaining.length > 0
              ? `Aplicámos a edição, mas ${remaining.length === 1 ? 'há um ponto' : 'há pontos'} a rever: ${remaining.slice(0, 2).join(' ')} A versão anterior está guardada nas versões.`
              : null,
        }));

        mutate(
          (now) => ({
            ...now,
            artwork: {
              ...now.artwork,
              assetId: asset.id,
              producedBy: 'ia',
              generatedAt: new Date().toISOString(),
              width,
              height,
              origin: 'edicao',
              summary,
              // A versão que acabou de ser editada fica no histórico.
              history: historyWith(now.artwork),
            },
          }),
          { status: 'arte-final' },
        );

        return {
          ok: true,
          notice:
            remaining.length > 0
              ? undefined
              : corrected
                ? 'Edição aplicada. A primeira tentativa falhou a verificação e corrigimo-la.'
                : chosenReview
                  ? 'Edição aplicada e verificada.'
                  : 'Edição aplicada.',
        };
      } catch (error) {
        return {
          ok: false,
          errors: [
            error instanceof Error
              ? error.message
              : 'Não foi possível editar a arte. A versão que tinhas ficou intacta.',
          ],
        };
      } finally {
        set({ generating: false, phase: null });
      }
    },

    restoreArtworkVersion(assetId) {
      const { project } = get();
      if (!project) return;
      const artwork = project.composition.artwork;
      const version = artwork.history.find((entry) => entry.assetId === assetId);
      if (!version || artwork.assetId === assetId) return;

      /*
        Repor é trocar de lugar, não apagar.

        A versão actual entra no histórico e a escolhida sai dele: voltar
        atrás é sempre reversível, que é o que torna seguro experimentar.
      */
      mutate(
        (composition) => ({
          ...composition,
          artwork: {
            ...composition.artwork,
            assetId: version.assetId,
            generatedAt: version.createdAt,
            width: version.width,
            height: version.height,
            origin: version.origin,
            summary: version.summary,
            history: historyWith(composition.artwork).filter(
              (entry) => entry.assetId !== version.assetId,
            ),
          },
        }),
        { status: 'arte-final' },
      );

      if (!get().assets[assetId]) {
        void resolveAssets([assetId]).then((resolved) => {
          if (Object.keys(resolved).length === 0) return;
          set((state) => ({ assets: { ...state.assets, ...resolved } }));
        });
      }
    },

    setLogoPlacement(placement) {
      // Escolhida pelo cliente: as grelhas seguintes respeitam-na, se a aceitarem.
      mutate((composition) => ({
        ...composition,
        logo: { ...composition.logo, placement, placementChosen: true },
      }));
    },

    setLogoSize(size) {
      mutate((composition) => ({ ...composition, logo: { ...composition.logo, size } }));
    },

    setBase(base) {
      // Escolhida pelo cliente: deixa de alternar sozinha com o feed.
      mutate((composition) => ({ ...composition, base, baseChosen: true }));
    },

    setContactsPlacement(placement) {
      mutate((composition) => ({ ...composition, contactsPlacement: placement }));
    },

    setFinish(patch) {
      mutate((composition) => ({ ...composition, finish: { ...composition.finish, ...patch } }));
    },

    backToReview() {
      set({ stage: 'revisao', view: 'rascunho', selectedLayerId: null, editingLayerId: null });
    },

    fillMissingField(field, value) {
      const { project, brand } = get();
      if (!project) return;
      const trimmed = value.trim();
      if (!trimmed) return;

      if (field === 'price') {
        mutate((composition) => ({
          ...composition,
          texts: { ...composition.texts, price: { value: trimmed, locked: true } },
        }));
      } else if (field === 'items') {
        // A resposta é uma lista separada por vírgulas. Cada nome fica
        // protegido: foi o utilizador que o escreveu.
        const capacity = APP.itemCapacity;
        const names = trimmed
          .split(/\s*(?:,|;|\/|\be\b)\s*/i)
          .map((name) => name.trim())
          .filter((name) => name.length >= 2)
          .slice(0, capacity);
        if (names.length === 0) return;
        mutate((composition) => ({
          ...composition,
          items: names.map((name) => ({ ...createItem(name), locked: true })),
          highlightedItemIndex: 0,
        }));
      } else if (field === 'whatsapp' || field === 'website') {
        mutate((composition) => ({
          ...composition,
          contacts: [
            ...composition.contacts.filter((c) => c.type !== field),
            { type: field as ContactType, value: trimmed },
          ],
        }));
        if (brand) {
          set({
            notice:
              'Este contacto ficou nesta publicação. Para o usar sempre, guarda-o também na área Marca.',
          });
        }
      }

      set((state) => ({
        project: state.project
          ? {
              ...state.project,
              missingFields: state.project.missingFields.filter((m) => m.field !== field),
            }
          : null,
      }));
      scheduleSave();
    },

    dismissNotice() {
      set({ notice: null });
    },

    setText(role, value) {
      /*
        O valor é guardado COMO FOI ESCRITO.

        ────────────────────────────────────────────────────────────────────
        Fazia `value.trim()` e guardava o resultado. Como o campo da revisão
        é controlado pelo valor do store, a barra de espaço deixava de
        funcionar: escrevias um espaço no fim de uma palavra, o `trim`
        apagava-o, e o campo voltava sem ele. Era impossível escrever a
        segunda palavra de um título.

        O `trim` é agora só para DECIDIR se o campo está vazio. Um texto com
        espaços intermédios — que é qualquer frase — chega intacto ao
        gerador, e os espaços nas pontas são removidos onde isso interessa:
        na montagem do prompt.
        ────────────────────────────────────────────────────────────────────
      */
      const empty = value.trim().length === 0;
      const previous = get().project?.composition.texts[role];
      mutate((composition) => {
        const texts = { ...composition.texts };
        const proposed = composition.texts[role]?.proposed;
        /*
          ────────────────────────────────────────────────────────────────────
          Apagar um texto é uma DECISÃO, não um campo por preencher.

          O campo vazio era apagado da composição, e "Actualizar proposta"
          voltava a preenchê-lo — `applyPlan` só respeita o que está
          protegido. Uma arte pedida sem botão saía com "Encomenda já".
          Agora fica protegido e vazio: o plano não lhe toca, o pedido diz ao
          modelo que foi retirado, e o prompt da imagem diz que não há botão.

          O título é a excepção: uma arte sem título não existe, e um título
          apagado é um título por escrever — o plano seguinte propõe outro.
          ────────────────────────────────────────────────────────────────────
        */
        if (empty && role === 'headline') delete texts[role];
        else if (empty) texts[role] = { value: '', locked: true, ...(proposed ? { proposed } : {}) };
        // Edição manual: fica protegido de novas reformulações. O que a IA
        // propôs fica guardado ao lado, para a memória da empresa.
        else texts[role] = { value, locked: true, proposed };
        return { ...composition, texts };
      });

      // Retirar o que a IA propôs ensina alguma coisa: "esta marca não usa etiquetas".
      const project = get().project;
      if (empty && role !== 'headline' && previous?.value.trim() && previous.proposed && project) {
        remember({
          kind: 'texto',
          projectId: project.id,
          detail: `Retirou da arte o campo «${TEXT_ROLE_LABELS[role] ?? role}», que a IA tinha proposto como «${quote(previous.proposed, 80)}».`,
        });
      }
    },

    setTextLock(role, locked) {
      mutate((composition) => {
        const current = composition.texts[role];
        if (!current) return composition;
        return {
          ...composition,
          texts: { ...composition.texts, [role]: { ...current, locked } },
        };
      });
    },

    selectLayer(id) {
      set({ selectedLayerId: id, editingLayerId: null });
    },

    setEditingLayer(id) {
      set({ editingLayerId: id, selectedLayerId: id ?? get().selectedLayerId });
    },

    moveLayer(id, delta) {
      mutate((composition) => {
        const current = overrideOf(composition, id);
        return patchOverride(id, {
          dx: current.dx + delta.dx,
          dy: current.dy + delta.dy,
        })(composition);
      });
    },

    scaleLayer(id, factor) {
      mutate((composition) => {
        const current = overrideOf(composition, id);
        const next = Math.min(1.8, Math.max(0.5, Number((current.scale * factor).toFixed(3))));
        return patchOverride(id, { scale: next })(composition);
      });
    },

    alignLayer(id, align) {
      mutate((composition) => patchOverride(id, { align, dx: 0 })(composition));
    },

    setLayerWeight(id, weight) {
      mutate((composition) => patchOverride(id, { weight })(composition));
    },

    resetLayer(id) {
      mutate((composition) => {
        if (!composition.overrides[id]) return composition;
        const overrides = { ...composition.overrides };
        delete overrides[id];
        return { ...composition, overrides };
      });
    },

    undo() {
      const { past, project } = get();
      if (past.length === 0 || !project) return;
      const previous = past[past.length - 1];
      set({
        past: past.slice(0, -1),
        future: [project.composition, ...get().future].slice(0, HISTORY_LIMIT),
        project: { ...project, composition: previous },
        editingLayerId: null,
      });
      scheduleSave();
    },

    redo() {
      const { future, project } = get();
      if (future.length === 0 || !project) return;
      const next = future[0];
      set({
        future: future.slice(1),
        past: [...get().past, project.composition].slice(-HISTORY_LIMIT),
        project: { ...project, composition: next },
        editingLayerId: null,
      });
      scheduleSave();
    },

    setZoom(zoom) {
      set({ zoom });
    },

    setView(view) {
      set({ view, editingLayerId: null });
    },

    setMobileTab(mobileTab) {
      set({ mobileTab });
    },

    async saveNow() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      await persist();
    },

    async exportArt() {
      const { project, brand, assets } = get();
      if (!project || !brand) return { ok: false };

      set({ exporting: true });
      try {
        // Com arte gerada, o ficheiro é essa arte com o acabamento aplicado —
        // exactamente a mesma função que desenha a prévia.
        const artwork = project.composition.artwork;
        if (artwork.assetId && assets[artwork.assetId]?.url) {
          const result = await exportFinishedArtwork({
            project,
            brand,
            assets,
          });
          // Descarregar é ficar com a arte: diz que esta ideia serviu.
          const direction = project.composition.direction;
          const facts = [
            direction?.approach ? `abordagem ${direction.approach}` : null,
            `formato ${project.composition.format}`,
          ]
            .filter(Boolean)
            .join(', ');
          remember({
            kind: 'descarga',
            projectId: project.id,
            detail: `Descarregou a arte da ideia «${quote(
              direction?.idea ?? project.composition.texts.headline?.value,
            )}» (${facts}).`,
          });
          return { ok: true, notice: result.notice };
        }

        const result = await exportPng({ project, brand, assets });
        const notice =
          result.missingImages.length > 0
            ? `${result.missingImages.length} imagem(ns) não carregaram e ficaram de fora.`
            : `Ficheiro ${result.width} × ${result.height} descarregado.`;
        return { ok: true, notice };
      } catch (error) {
        return {
          ok: false,
          errors: [
            error instanceof Error ? error.message : 'Não foi possível exportar o ficheiro.',
          ],
        };
      } finally {
        set({ exporting: false });
      }
    },
  };
});

/** Contactos propostos por omissão, para a lista do painel. */
export function suggestedContacts(brand: Brand) {
  return defaultContactsForComposition(brand);
}
