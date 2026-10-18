'use client';

import * as React from 'react';
import { Sparkles } from 'lucide-react';
import {
  analyseLogoColors,
  complementFor,
  type LogoColorAnalysis,
} from '@/lib/brand/extractColors';
import { styleSummaryText } from '@/lib/brand/styleLearning';
import {
  addSpecAccent,
  buildIdentitySpec,
  colorOf,
  removeSpecAccent,
  setSpecColor,
  setSpecTagline,
  setSpecTypography,
  setVisualAsset,
  setVisualPrompt,
} from '@/lib/brand/identitySpec';
import type { ResolvedAsset } from '@/lib/composition/resolve';
import { getBackend } from '@/lib/data';
import { registerAsset, resolveAsset } from '@/lib/data/assetCache';
import { getFont } from '@/lib/fontCatalog';
import type {
  Brand,
  BrandColorRole,
  BrandIdentitySpec,
  BrandVisual,
  BrandVisualKind,
  IdentityHint,
  VisualPreference,
} from '@/lib/domain/types';
import { blobToDataUrl, downscaleImageBlob } from '@/lib/utils/files';
import { relativeLuminance } from '@/lib/utils/color';
import { cn } from '@/lib/utils/cn';
import { Dialog } from '@/components/ui/Dialog';
import { SonarGrid } from '@/components/ui/SonarGrid';
import { useToast } from '@/components/ui/Toast';
import {
  changedInputs,
  readBaseline,
  snapshotInputs,
  writeBaseline,
  type GenerateMode,
  type IdentityInputsSnapshot,
} from './IdentityGenerate';
import { IdentityInputs } from './IdentityInputs';
import { IdentityProgress, type IdentityPhase } from './IdentityProgress';
import { IdentityProposalView, type VisualState } from './IdentityProposalView';

/** A leitura de cores do logótipo actual, pronta para seguir no pedido. */
type LogoReading = {
  assetId: string;
  tone: 'claro' | 'escuro';
  chromatic: boolean;
  /** Cores lidas, por ordem — ou o tom e o complemento, num logótipo monocromático. */
  hexes: string[];
};

/**
 * Etapa 3 do cadastro: identidade da marca.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O cliente preenche tudo e SÓ DEPOIS gera.
 *
 * Carregar o logótipo disparava todo o trabalho — guardar, ler as cores,
 * enviar a imagem ao modelo, montar a proposta e gerar a folha de
 * identidade. A ideia era poupar a descoberta de um botão; o efeito foi uma
 * proposta paga feita antes de o cliente dizer as cores, importar o manual
 * ou escrever o que evitar, e outra a seguir quando ele acabava de
 * preencher. A queixa: "a identidade da marca gera sozinha".
 *
 * Agora há um gatilho e um só: o botão "Gerar a identidade da marca", no
 * fim da coluna dos dados, com o resumo do que vai entrar logo por cima.
 * Carregar o logótipo guarda-o e lê-lhe as cores no browser (sem pedido
 * nenhum) para sugerir a paleta. Depois de haver proposta, mudar dados não
 * gera nada: o botão passa a "Gerar de novo com estas alterações".
 * ──────────────────────────────────────────────────────────────────────────
 */
export function IdentityStep({
  brand,
  accountId,
  onBrandChange,
  onWorkingChange,
}: {
  brand: Brand;
  accountId: string;
  onBrandChange: (next: Brand) => void;
  /**
   * Avisa a página quando há trabalho em curso.
   *
   * O rodapé com "Aprovar e continuar" vive na página, não aqui, e não pode
   * convidar a concluir o cadastro enquanto as peças ainda estão a ser
   * geradas.
   */
  onWorkingChange?: (working: boolean) => void;
}) {
  const { show } = useToast();

  const [phase, setPhase] = React.useState<IdentityPhase | null>(null);
  const [extracted, setExtracted] = React.useState<Array<{ hex: string; note: string }>>([]);
  const [extractionFailed, setExtractionFailed] = React.useState(false);
  /** A ler as cores do logótipo acabado de carregar. Só no browser. */
  const [readingLogo, setReadingLogo] = React.useState(false);
  const [manualHints, setManualHints] = React.useState<IdentityHint[]>(
    brand.identity.importReport?.hints ?? [],
  );
  const [manualBusy, setManualBusy] = React.useState(false);
  const [manualError, setManualError] = React.useState<string | null>(null);
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [assets, setAssets] = React.useState<Record<string, ResolvedAsset | undefined>>({});
  const [preview, setPreview] = React.useState<BrandVisual | null>(null);

  /**
   * Qual visual está a ser gerado agora, e quais ficaram por gerar.
   *
   * Sem isto, uma moldura vazia é ambígua: pode estar à espera da sua vez,
   * pode estar a ser gerada ou pode ter falhado. Três situações diferentes
   * com o mesmo aspecto — que foi exactamente a confusão que levou a pensar
   * que as imagens não apareciam.
   */
  const [generatingKind, setGeneratingKind] = React.useState<BrandVisualKind | null>(
    null,
  );
  const [failedKinds, setFailedKinds] = React.useState<BrandVisualKind[]>([]);

  /** Trava de reentrância: um duplo clique não deve gerar duas propostas. */
  const running = React.useRef(false);

  /**
   * Tom do logótipo, lido dos píxeis.
   *
   * Guardado numa referência porque é preciso em pedidos que acontecem muito
   * depois da leitura — "Gerar novo", por exemplo, corre sem ficheiro em mão.
   * Quando não houve leitura nesta sessão, deriva-se da luminância da cor
   * principal, que é a cor dominante do próprio logótipo.
   */
  const logoToneRef = React.useRef<'claro' | 'escuro' | null>(null);

  /** Contador de variantes: cada "Gerar novo" pede outro enquadramento. */
  const variantRef = React.useRef(0);

  /**
   * O ficheiro do logótipo carregado nesta sessão, e a leitura das cores.
   *
   * Ficam guardados para o botão de gerar não ter de ir buscar ao
   * armazenamento o que acabou de lá pôr. Os dois levam o identificador do
   * logótipo: trocar de ficheiro invalida-os.
   */
  const logoFileRef = React.useRef<{ assetId: string; file: Blob } | null>(null);
  const readingRef = React.useRef<LogoReading | null>(null);
  /** Só a leitura mais recente escreve — carregar dois logótipos seguidos não as cruza. */
  const readToken = React.useRef(0);

  /**
   * As cores dos campos vieram do logótipo, não do cliente.
   *
   * Permite que um logótipo trocado volte a preencher os campos. Logo que o
   * cliente escreve uma cor, a decisão passa a ser dele e nenhuma leitura
   * lhe toca.
   */
  const colorsFromLogo = React.useRef(false);

  /*
    Ainda no ecrã?

    A leitura do logótipo e a importação do manual acabam depois de um
    `await`. Se entretanto o cliente voltou às artes, a página já pode ter
    um rascunho mais novo (o estilo aprendido, por exemplo) — escrever por
    cima dele com a cópia desta etapa apagava-o.
  */
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * Marca mais recente.
   *
   * O `brand` que chega por propriedade é o do render em curso. O
   * `LogoUploader` grava o `logoAssetId` e, no mesmo gesto, entrega o
   * ficheiro para a leitura das cores — que corre com o valor anterior em
   * mão. Reconstruir a marca a partir dessa cópia no fim da leitura apagava
   * o logótipo que acabara de ser carregado. A referência é o que garante
   * que escrevemos sobre o estado verdadeiro; `commit` actualiza-a logo, sem
   * esperar pelo render seguinte.
   */
  const latest = React.useRef(brand);
  React.useEffect(() => {
    latest.current = brand;
  }, [brand]);

  const commit = React.useCallback(
    (next: Brand) => {
      latest.current = next;
      onBrandChange(next);
    },
    [onBrandChange],
  );

  /** Aplica uma alteração à identidade MAIS RECENTE. */
  const patchIdentity = React.useCallback(
    (patch: Partial<Brand['identity']>) => {
      const base = latest.current;
      commit({ ...base, identity: { ...base.identity, ...patch } });
    },
    [commit],
  );

  // O rodapé da página precisa de saber que há trabalho em curso. A limpeza
  // existe para o caso de esta etapa sair do ecrã com um pedido a correr:
  // sem ela, a página ficava com o rodapé bloqueado para sempre.
  React.useEffect(() => {
    onWorkingChange?.(phase !== null);
    return () => onWorkingChange?.(false);
  }, [phase, onWorkingChange]);

  const spec = brand.identity.spec ?? null;

  /**
   * Escreve uma especificação nova sobre a marca MAIS RECENTE.
   *
   * ────────────────────────────────────────────────────────────────────────
   * A base tem de vir de `latest.current`, nunca do `brand` do render.
   *
   * Esta função é chamada de dentro do ciclo que gera os visuais, que dura
   * minutos. Uma versão anterior fechava sobre o `brand` do render em que a
   * geração começou. Cada visual gerado reescrevia a marca com essa cópia
   * velha: o logótipo desaparecia do painel, as cores voltavam às de
   * arranque e as tipografias à escolha por omissão, a meio da geração.
   * ────────────────────────────────────────────────────────────────────────
   */
  const updateSpec = React.useCallback(
    (next: BrandIdentitySpec) => {
      const base = latest.current;
      commit({ ...base, identity: { ...base.identity, spec: next } });
    },
    [commit],
  );

  // --- Os dados da última proposta ----------------------------------------
  /*
    A fotografia dos dados com que a proposta à vista foi feita.

    É o que deixa o botão dizer "mudaste as cores desde a proposta" em vez
    de gerar outra sozinho. Uma proposta que já existia ao abrir o ecrã, sem
    registo, conta como feita com os dados actuais: não há como saber o
    contrário, e assumir que mudou era convidar a pagar uma proposta igual.
  */
  const [baseline, setBaseline] = React.useState<IdentityInputsSnapshot | null>(() =>
    spec ? (readBaseline(brand.id, spec) ?? snapshotInputs(brand, manualHints)) : null,
  );

  // Uma proposta sem registo fica registada ao abrir o ecrã, para que voltar
  // às artes e mudar o estilo apareça como alteração no regresso. Uma vez
  // só, com os valores do primeiro render: a seguir, quem escreve é a
  // geração — e reescrever aqui gravava a proposta antiga por cima da nova.
  const registered = React.useRef(false);
  React.useEffect(() => {
    if (registered.current) return;
    registered.current = true;
    if (spec && baseline && !readBaseline(brand.id, spec)) {
      writeBaseline(brand.id, spec, baseline);
    }
  });

  const changes = spec ? changedInputs(baseline, snapshotInputs(brand, manualHints)) : [];
  const mode: GenerateMode = !spec ? 'primeira' : changes.length > 0 ? 'alterado' : 'igual';

  /*
    O mínimo para gerar: o logótipo OU cores escolhidas pelo cliente.

    Sem nenhum dos dois, o pedido só levava o nome da empresa e a proposta
    inventava a paleta inteira — com o logótipo real a chegar depois e a
    não bater com nada. As cores de arranque não contam: não seguem no
    pedido (ver `colorsConfirmed`). Sem logótipo também dá, desde que haja
    cores: o nome da empresa entra em texto, como aplicação provisória.
  */
  const hasLogo = Boolean(brand.identity.logoAssetId);
  const blockedReason = phase
    ? null
    : readingLogo
      ? 'A ler as cores do logótipo…'
      : manualBusy
        ? 'A ler o manual da marca…'
        : !hasLogo && !brand.identity.colorsConfirmed
          ? 'Falta o logótipo ou as cores da marca.'
          : null;

  // --- Prévia do logótipo --------------------------------------------------
  React.useEffect(() => {
    let cancelled = false;
    const id = brand.identity.logoAssetId;
    if (!id) {
      setLogoUrl(null);
      return;
    }
    resolveAsset(id)
      .then((asset) => {
        if (!cancelled) setLogoUrl(asset?.url ?? null);
      })
      .catch(() => {
        if (!cancelled) setLogoUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [brand.identity.logoAssetId]);

  /*
    Versões para fundo claro e para fundo escuro.

    ────────────────────────────────────────────────────────────────────────
    Só o logótipo principal estava a ser resolvido, e as duas caixas de
    aplicação desenhavam-no nas duas superfícies. Quem carregava uma versão
    própria para fundos escuros via o ficheiro escuro sobre o fundo escuro,
    ilegível, com a versão correcta guardada e ignorada a dois centímetros
    de distância.
    ────────────────────────────────────────────────────────────────────────
  */
  const [logoOnLightUrl, setLogoOnLightUrl] = React.useState<string | null>(null);
  const [logoOnDarkUrl, setLogoOnDarkUrl] = React.useState<string | null>(null);

  const lightBgId = brand.identity.logoForLightBgAssetId;
  const darkBgId = brand.identity.logoForDarkBgAssetId;

  React.useEffect(() => {
    let cancelled = false;

    const read = (id: string | null, set: (url: string | null) => void) => {
      if (!id) {
        set(null);
        return;
      }
      resolveAsset(id)
        .then((asset) => {
          if (!cancelled) set(asset?.url ?? null);
        })
        .catch(() => {
          if (!cancelled) set(null);
        });
    };

    read(lightBgId, setLogoOnLightUrl);
    read(darkBgId, setLogoOnDarkUrl);

    return () => {
      cancelled = true;
    };
  }, [lightBgId, darkBgId]);

  // --- Recursos dos visuais já gerados ------------------------------------
  const visualAssetIds = (spec?.visuals ?? [])
    .map((visual) => visual.assetId)
    .filter((id): id is string => Boolean(id))
    .join(',');

  React.useEffect(() => {
    let cancelled = false;
    const ids = visualAssetIds.split(',').filter(Boolean);
    if (ids.length === 0) return;

    void Promise.all(ids.map((id) => resolveAsset(id).catch(() => null))).then(
      (resolvedList) => {
        if (cancelled) return;
        const next: Record<string, ResolvedAsset | undefined> = {};
        resolvedList.forEach((resolved, index) => {
          if (resolved) next[ids[index]] = resolved;
        });
        setAssets((current) => ({ ...current, ...next }));
      },
    );

    return () => {
      cancelled = true;
    };
  }, [visualAssetIds]);

  // --- Logótipo e cores (só no browser) ------------------------------------

  /**
   * Lê as cores do logótipo e propõe-nas nos campos.
   *
   * ────────────────────────────────────────────────────────────────────────
   * Nenhum pedido sai daqui: é análise dos píxeis no browser, a mesma de
   * antes, separada da geração. Serve para o cliente VER as cores antes de
   * gerar e as poder corrigir — que é o ponto de preencher tudo primeiro.
   *
   * O aviso de falha só aparece quando o ficheiro realmente não se leu. Um
   * logótipo monocromático não é uma falha: a cor dele é esse tom, e a
   * secundária deriva-se do oposto.
   *
   * As cores lidas só entram nos campos enquanto o cliente não escolheu as
   * dele. Uma leitura automática não pode apagar uma decisão.
   * ────────────────────────────────────────────────────────────────────────
   */
  async function readLogo(file: Blob, assetId: string): Promise<LogoReading | null> {
    readToken.current += 1;
    const token = readToken.current;
    setReadingLogo(true);

    const analysis: LogoColorAnalysis | null = await analyseLogoColors(file).catch(() => null);

    // Saiu do ecrã, carregou outro ficheiro ou retirou este: a leitura já não vale.
    if (!mounted.current || token !== readToken.current) return null;
    setReadingLogo(false);
    if (latest.current.identity.logoAssetId !== assetId) return null;

    if (!analysis || analysis.unreadable) {
      setExtracted([]);
      setExtractionFailed(true);
      readingRef.current = null;
      return null;
    }

    setExtractionFailed(false);
    logoToneRef.current = analysis.tone;

    const complement = complementFor(analysis.dominant, analysis.tone);
    const hexes = analysis.chromatic
      ? analysis.colors.map((color) => color.hex)
      : [analysis.dominant, complement];

    setExtracted(
      analysis.chromatic
        ? analysis.colors.map((color) => ({
            hex: color.hex,
            note: `${Math.round(color.share * 100)}% dos píxeis com cor`,
          }))
        : // Monocromático: mostramos o tom lido e o complemento derivado.
          [
            { hex: analysis.dominant, note: `tom do logótipo (${analysis.tone})` },
            { hex: complement, note: 'complemento derivado' },
          ],
    );

    const reading: LogoReading = {
      assetId,
      tone: analysis.tone,
      chromatic: analysis.chromatic,
      hexes,
    };
    readingRef.current = reading;

    const identity = latest.current.identity;
    if (!identity.colorsConfirmed || colorsFromLogo.current) {
      patchIdentity({
        colors: {
          primary: hexes[0] ?? identity.colors.primary,
          secondary: hexes[1] ?? complementFor(hexes[0] ?? '#000000', analysis.tone),
          // Terceira cor só se o logótipo a tiver. Sem base, fica vazia.
          accent: analysis.chromatic ? (hexes[2] ?? null) : null,
        },
        // Ficam à vista nos campos antes de gerar: é o cliente que as
        // confirma, ao carregar no botão ou ao corrigi-las.
        colorsConfirmed: true,
      });
      colorsFromLogo.current = true;
    }

    return reading;
  }

  /** O logótipo foi guardado (ou retirado). Só guarda: não gera nada. */
  function handleLogoChange(assetId: string | null) {
    patchIdentity({ logoAssetId: assetId });
    if (!assetId) {
      // Sem logótipo, o que se leu dele deixa de fazer sentido. As cores
      // ficam: o cliente pode querê-las mesmo sem o ficheiro.
      readToken.current += 1;
      setReadingLogo(false);
      setExtracted([]);
      setExtractionFailed(false);
      readingRef.current = null;
      logoFileRef.current = null;
      logoToneRef.current = null;
    }
  }

  /**
   * O ficheiro original, entregue logo a seguir a `handleLogoChange`.
   *
   * O `LogoUploader` chama as duas no mesmo gesto, por esta ordem; como
   * `commit` actualiza `latest` de imediato, o identificador já é o novo.
   */
  function handleLogoFile(file: File) {
    const assetId = latest.current.identity.logoAssetId;
    if (!assetId) return;
    logoFileRef.current = { assetId, file };
    void readLogo(file, assetId);
  }

  /** Escrever uma cor é o acto que lhe dá autoridade: passa a ser decisão do cliente. */
  function handleColorsChange(patch: Partial<Brand['identity']['colors']>) {
    colorsFromLogo.current = false;
    const base = latest.current.identity;
    patchIdentity({ colors: { ...base.colors, ...patch }, colorsConfirmed: true });
  }

  /** O logótipo guardado, como ficheiro. O carregado nesta sessão, quando há. */
  async function logoBlob(assetId: string): Promise<Blob | null> {
    if (logoFileRef.current?.assetId === assetId) return logoFileRef.current.file;
    try {
      const asset = await resolveAsset(assetId);
      if (!asset?.url) return null;
      const response = await fetch(asset.url);
      return response.ok ? await response.blob() : null;
    } catch {
      return null;
    }
  }

  async function logoDataUrl(file: Blob): Promise<string | undefined> {
    try {
      // 768 px bastam para o modelo ler forma e cor, e mantêm o pedido leve.
      // Em PNG: em JPEG a transparência saía preta — ver `downscaleImageBlob`.
      const reduced = await downscaleImageBlob(file, 768, 0.92, { mime: 'image/png' });
      return await blobToDataUrl(reduced.blob);
    } catch {
      return undefined;
    }
  }

  // --- Pipeline ------------------------------------------------------------

  /**
   * Gera a proposta com tudo o que o cliente preencheu.
   *
   * Só corre pelo botão. Os dados vêm de `latest.current` no momento do
   * clique — o que está nos campos é o que vai.
   */
  async function runProposal() {
    if (running.current) return;
    running.current = true;
    setFailedKinds([]);
    setPhase({ step: 'analise', startedAt: Date.now() });

    try {
      let working = latest.current;
      const logoId = working.identity.logoAssetId;
      let reading: LogoReading | null =
        logoId && readingRef.current?.assetId === logoId ? readingRef.current : null;
      let dataUrl: string | undefined;

      if (logoId) {
        const file = await logoBlob(logoId);
        if (file) {
          // Sem leitura nesta sessão (o ecrã foi reaberto, por exemplo), lê-se
          // agora. Continua a ser só no browser.
          if (!reading) {
            setPhase({ step: 'cores', startedAt: Date.now() });
            reading = await readLogo(file, logoId);
            working = latest.current;
            setPhase({ step: 'analise', startedAt: Date.now() });
          }
          dataUrl = await logoDataUrl(file);
        }
      }

      const hintsUsed = manualHints;

      const response = await fetch('/api/brand/identity', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          company: {
            name: working.company.name,
            segment: working.company.segment,
            description: working.company.description,
          },
          // Só vão como "declaradas" as cores que o cliente confirmou. As de
          // arranque são reserva do motor, não escolha da empresa.
          colors: working.identity.colorsConfirmed ? working.identity.colors : {},
          extractedColors: reading?.hexes ?? [],
          logoDataUrl: dataUrl,
          logoTone: reading?.tone ?? null,
          logoChromatic: reading?.chromatic ?? true,
          manualHints: hintsUsed.map((hint) => ({
            kind: hint.kind,
            value: hint.value,
            source: hint.source,
            origin: hint.origin,
          })),
          visualPreference: working.identity.visualPreference ?? null,
          constraints: working.identity.constraints ?? '',
          // O estilo aprendido no passo anterior, quando o cliente o fez.
          learnedStyle: styleSummaryText(working.identity.styleLearning, 1400),
          /*
            Sem `identidade`: o servidor não conhece essa secção.

            ────────────────────────────────────────────────────────────────
            `setSpecTagline` e `setVisualPrompt` fixam a secção `identidade`,
            que existe no browser (`BrandSectionId`) mas não na lista que a
            rota valida (`identityRequestSchema`). Uma proposta com essa
            secção fixada levava-a no pedido, a rota respondia "Pedido
            inválido." e "Gerar de novo com estas alterações" falhava sempre.
            Hoje nenhum botão abre o diálogo dessas duas edições, mas uma
            proposta gravada antes disso pode trazer a secção fixada — e o
            botão de gerar de novo é agora o caminho principal.

            Retirá-la daqui não perde a edição: quem a guarda é o browser,
            em `buildIdentitySpec`, que lê as secções fixadas da proposta
            anterior e mantém a assinatura e o visual como estavam. O modelo
            só deixa de ser avisado de uma secção cujo resultado ia ser
            descartado de qualquer forma.
            ────────────────────────────────────────────────────────────────
          */
          lockedSections: (working.identity.spec?.lockedSections ?? []).filter(
            (section) => section !== 'identidade',
          ),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? 'Não foi possível preparar a proposta.');
      }

      setPhase({ step: 'sistema', startedAt: Date.now() });

      const next = buildIdentitySpec({
        proposal: data.proposal,
        declaredColors: working.identity.colors,
        manualHints: hintsUsed,
        visualPreference: working.identity.visualPreference ?? null,
        constraints: working.identity.constraints ?? '',
        producedBy: data.source === 'ia' ? 'ia' : 'local',
        previous: working.identity.spec ?? null,
      });

      // A tipografia e as cores propostas passam a ser as da marca: é o que
      // as artes usam. Partimos de `latest.current` e não de `working` para
      // não perder nada que tenha sido gravado durante o pedido.
      const base = latest.current;
      const colors = {
        primary:
          next.colors.find((c) => c.role === 'primary')?.hex ??
          working.identity.colors.primary,
        secondary:
          next.colors.find((c) => c.role === 'secondary')?.hex ??
          working.identity.colors.secondary,
        // Sem terceira cor na proposta, fica vazia. Não herdamos uma de
        // arranque para preencher o campo.
        accent: next.colors.find((c) => c.role === 'accent')?.hex ?? null,
      };

      const proposed: Brand = {
        ...base,
        identity: {
          ...base.identity,
          colors,
          colorsConfirmed: true,
          spec: next,
          fontDisplay: next.typography.display,
          fontBody: next.typography.body,
        },
      };
      commit(proposed);
      // As cores dos campos são agora as da proposta, não leituras do logótipo.
      colorsFromLogo.current = false;

      /*
        A fotografia dos dados que SEGUIRAM no pedido, com as cores já da
        proposta.

        Das cores, as da proposta: ela reescreve os campos, e comparar com
        as de antes dava "mudaste as cores" no instante em que a proposta
        aparecia. Do resto, o que foi enviado (`working`) e não o estado de
        agora: uma preferência mudada durante a geração não entrou nesta
        proposta e tem de aparecer como alteração.
      */
      const inputs = snapshotInputs(
        { ...working, identity: { ...working.identity, colors, colorsConfirmed: true } },
        hintsUsed,
      );
      setBaseline(inputs);
      writeBaseline(proposed.id, next, inputs);

      if (data.notice) show({ tone: 'info', message: data.notice });

      /*
        Os visuais fazem parte da proposta, não de um passo seguinte.

        Antes cada um tinha o seu botão "Gerar", e o cliente recebia cinco
        molduras vazias com trabalho para fazer. Pedir uma proposta visual e
        receber uma proposta sem visuais não é uma proposta.
      */
      await generateVisualList(next.visuals, colors, dataUrl);
    } catch (error) {
      show({
        tone: 'erro',
        message:
          error instanceof Error
            ? `${error.message} Os teus ficheiros e cores não foram alterados.`
            : 'Não foi possível preparar a proposta. Os teus dados ficaram intactos.',
      });
    } finally {
      running.current = false;
      setPhase(null);
    }
  }

  // --- Manual de marca -----------------------------------------------------
  async function importManual(file: File) {
    setManualBusy(true);
    setManualError(null);
    try {
      await getBackend().uploadAsset({
        accountId,
        kind: 'brand-manual',
        file,
        name: file.name,
      });

      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/brand/import', { method: 'POST', body: form });
      const data = await response.json();
      if (!mounted.current) return;

      if (!data?.ok || !data.hints) {
        setManualError(
          data?.error ??
            'O ficheiro ficou guardado, mas não conseguimos extrair cores nem tipografias. Escreve-as à mão.',
        );
        return;
      }

      const found: IdentityHint[] = [
        ...data.hints.fonts.map((font: { name: string; supported: string | null }) => ({
          kind: 'fonte' as const,
          value: font.name,
          source: 'explicito' as const,
          origin: file.name,
          detail: font.supported
            ? `Disponível na lista: ${getFont(font.supported as never).label}`
            : 'Não está na nossa lista de tipografias',
        })),
        ...data.hints.explicitColors.map((color: { hex: string }) => ({
          kind: 'cor' as const,
          value: color.hex,
          source: 'explicito' as const,
          origin: file.name,
          detail: 'Código escrito no documento',
        })),
        ...data.hints.inferredColors.map((color: { hex: string; count: number }) => ({
          kind: 'cor' as const,
          value: color.hex,
          source: 'inferido' as const,
          origin: file.name,
          detail: `Usada ${color.count}× no documento`,
        })),
      ];

      const merged = [...manualHints, ...found].filter(
        (hint, index, all) =>
          all.findIndex(
            (other) => other.kind === hint.kind && other.value === hint.value,
          ) === index,
      );
      setManualHints(merged);

      // Sobre a marca MAIS RECENTE: o envio leva segundos, e o cliente pode
      // ter escrito noutros campos entretanto.
      const current = latest.current.identity;
      patchIdentity({
        setupMode: 'importado',
        importReport: {
          at: new Date().toISOString(),
          files: [...new Set([...(current.importReport?.files ?? []), file.name])],
          hints: merged,
          usedAi: false,
        },
      });

      show({
        tone: found.length > 0 ? 'sucesso' : 'info',
        message:
          found.length > 0
            ? `Encontrámos ${found.length} pista(s) no teu manual.`
            : 'O manual ficou guardado, mas não encontrámos cores nem tipografias escritas.',
      });
    } catch (cause) {
      if (!mounted.current) return;
      setManualError(
        cause instanceof Error ? cause.message : 'Não foi possível enviar o ficheiro.',
      );
    } finally {
      if (mounted.current) setManualBusy(false);
    }
  }

  // --- Visuais da identidade -----------------------------------------------

  /**
   * Gera UM visual e devolve o identificador do recurso.
   *
   * Um pedido, um prompt, uma imagem — e o logótipo real vai como referência
   * para aparecer no resultado. Devolve `null` em caso de falha: um visual
   * que não sai não impede os outros.
   */
  async function generateVisual(
    visual: BrandVisual,
    colors: { primary: string; secondary: string; accent: string | null },
    logoDataUrl: string | undefined,
    variant = 0,
  ): Promise<string | null> {
    const response = await fetch('/api/brand/visual', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: visual.kind,
        prompt: visual.prompt,
        company: latest.current.company.name,
        segment: latest.current.company.segment,
        colors,
        format: visual.format,
        // O tom do ficheiro decide o tom do material onde o logótipo assenta.
        // Sem ele saía o logótipo escuro sobre material escuro.
        logoTone: resolvedLogoTone(),
        variant,
        logoDataUrl,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error ?? 'A geração deste visual falhou.');
    }

    const blob = await fetch(data.dataUrl).then((r) => r.blob());
    /*
      `reencode` não é cosmética. O gerador devolve PNG de 1024 px com cerca
      de 2,7 MB. Quatro por proposta, e o cliente pede mais do que uma — sem
      recodificar, cada tentativa deixa onze megabytes no armazenamento do
      browser para imagens que se vêem numa moldura de trezentos píxeis.
    */
    const reduced = await downscaleImageBlob(blob, 1024, 0.9, { reencode: true });
    const asset = await getBackend().uploadAsset({
      accountId,
      kind: 'generated-bg',
      file: reduced.blob,
      name: `identidade-${visual.kind}`,
      width: reduced.width || 1080,
      height: reduced.height || 1080,
      provenance: 'ia',
    });
    const url = await getBackend().resolveAssetUrl(asset);
    registerAsset(asset, url);

    setAssets((current) => ({
      ...current,
      [asset.id]: { url, width: asset.width, height: asset.height },
    }));

    return asset.id;
  }

  /**
   * Gera os visuais da proposta.
   *
   * ────────────────────────────────────────────────────────────────────────
   * Sequencial de propósito. Em paralelo seriam vários pedidos de imagem
   * simultâneos ao mesmo fornecedor, com risco de limite de taxa e sem
   * ganho real de tempo percebido — o indicador mostra "2 de 4" e o cliente
   * vê que está a avançar.
   *
   * Cada visual que falha é comunicado e os outros continuam. A proposta com
   * três imagens é utilizável; abortar tudo porque uma falhou não é.
   * ────────────────────────────────────────────────────────────────────────
   */
  async function generateVisualList(
    targets: BrandVisual[],
    colors: { primary: string; secondary: string; accent: string | null },
    logoDataUrl: string | undefined,
    variant = 0,
  ) {
    const falhas: BrandVisualKind[] = [];
    const startedAt = Date.now();

    for (let index = 0; index < targets.length; index += 1) {
      const visual = targets[index];
      setGeneratingKind(visual.kind);
      setPhase({
        step: 'visuais',
        // O tempo decorrido é do conjunto, não de cada imagem: reiniciá-lo a
        // cada peça escondia que a operação toda leva minutos.
        startedAt,
        detail: targets.length > 1 ? `${index + 1} de ${targets.length}` : undefined,
      });

      try {
        const assetId = await generateVisual(visual, colors, logoDataUrl, variant);
        if (!assetId) {
          falhas.push(visual.kind);
          continue;
        }
        // A especificação mais recente: o cliente pode ter ajustado algo
        // enquanto a imagem era gerada.
        const current = latest.current.identity.spec ?? null;
        if (current) updateSpec(setVisualAsset(current, visual.kind, assetId));
      } catch {
        falhas.push(visual.kind);
      }
    }

    setGeneratingKind(null);
    setFailedKinds(falhas);

    if (falhas.length > 0) {
      const labels = targets
        .filter((visual) => falhas.includes(visual.kind))
        .map((visual) => visual.label);
      show({
        tone: 'erro',
        message: `Não conseguimos gerar: ${labels.join(', ')}. Usa "Gerar novo" para tentar outra vez.`,
      });
    }
  }

  /**
   * Gera outra folha de identidade, com o mesmo briefing.
   *
   * ────────────────────────────────────────────────────────────────────────
   * É o "Gerar novo" do cartão, e serve dois casos com o mesmo gesto: a
   * geração falhou, ou saiu mas o cliente não gostou. Em ambos o que ele
   * quer é outra fotografia.
   *
   * O briefing não muda — é a proposta aprovada, e reescrevê-la em cada
   * tentativa tirava-lhe o sentido. O que muda é o enquadramento, pelo
   * contador de variantes: sem ele a segunda geração devolvia praticamente a
   * mesma imagem.
   * ────────────────────────────────────────────────────────────────────────
   */
  async function regenerateVisual() {
    if (running.current) return;
    const current = latest.current.identity.spec;
    if (!current || current.visuals.length === 0) return;

    running.current = true;
    variantRef.current += 1;
    setFailedKinds([]);
    setPhase({ step: 'visuais', startedAt: Date.now(), detail: 'outra proposta' });

    try {
      const colors = {
        primary: colorOf(current, 'primary', latest.current.identity.colors.primary),
        secondary: colorOf(current, 'secondary', latest.current.identity.colors.secondary),
        accent: current.colors.find((entry) => entry.role === 'accent')?.hex ?? null,
      };
      await generateVisualList(
        current.visuals,
        colors,
        await currentLogoDataUrl(),
        variantRef.current,
      );
    } finally {
      running.current = false;
      setPhase(null);
    }
  }

  /**
   * Estado de cada moldura, para nenhuma ficar ambígua.
   *
   * Uma moldura vazia pode estar à espera da vez, a ser gerada agora ou ter
   * falhado. São três mensagens diferentes e o cliente tem direito a saber
   * qual é a dele.
   */
  const visualStates = React.useMemo(() => {
    const out: Partial<Record<BrandVisualKind, VisualState>> = {};
    for (const visual of spec?.visuals ?? []) {
      out[visual.kind] = visual.assetId
        ? 'pronto'
        : generatingKind === visual.kind
          ? 'a-gerar'
          : failedKinds.includes(visual.kind)
            ? 'falhou'
            : phase?.step === 'visuais'
              ? 'na-fila'
              : 'vazio';
    }
    return out;
  }, [spec, generatingKind, failedKinds, phase]);

  /**
   * O tom do logótipo, com recurso à luminância da cor principal.
   *
   * A leitura dos píxeis só acontece quando o ficheiro é carregado. Num
   * "Gerar novo" dias depois não há ficheiro em mão, e a cor principal da
   * identidade É a cor dominante do logótipo — serve de substituto honesto.
   */
  function resolvedLogoTone(): 'claro' | 'escuro' {
    if (logoToneRef.current) return logoToneRef.current;
    const primary = latest.current.identity.colors.primary;
    return relativeLuminance(primary) > 0.5 ? 'claro' : 'escuro';
  }

  /** O logótipo actual em data URL, para enviar como referência. */
  async function currentLogoDataUrl(): Promise<string | undefined> {
    const id = latest.current.identity.logoAssetId;
    if (!id) return undefined;
    const file = await logoBlob(id);
    return file ? logoDataUrl(file) : undefined;
  }

  // --- Interface -----------------------------------------------------------
  return (
    <>
      {/*
        Altura fixa, duas colunas que rolam por dentro.

        A página em si não rola: o cabeçalho das etapas e o rodapé com
        "Aprovar e continuar" ficam sempre à vista. Oito secções de proposta
        não cabem num ecrã, mas rolar dentro do painel é diferente de perder
        de vista o botão que conclui o cadastro.
      */}
      <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[18.5rem_1fr]">
        {/* Coluna esquerda */}
        <div
          className={cn(
            'relative flex min-h-0 flex-col rounded-[14px] border border-line bg-ink-900/40 p-3.5',
            // Durante a geração os campos estão desligados; deixar a coluna
            // rolar só dava uma barra a mexer sem nada para ver.
            phase ? 'overflow-hidden' : 'overflow-y-auto',
          )}
        >
          <IdentityInputs
            brand={brand}
            accountId={accountId}
            extractedColors={extracted}
            extractionFailed={extractionFailed}
            readingLogo={readingLogo}
            manualHints={manualHints}
            manualBusy={manualBusy}
            manualError={manualError}
            onIdentityChange={patchIdentity}
            onColorsChange={handleColorsChange}
            onLogoChange={handleLogoChange}
            onLogoFile={handleLogoFile}
            onManualFile={(file) => void importManual(file)}
            onPreferenceChange={(visualPreference: VisualPreference | null) =>
              patchIdentity({ visualPreference })
            }
            onConstraintsChange={(constraints) => patchIdentity({ constraints })}
            generate={{
              mode,
              changes,
              busy: phase !== null,
              blockedReason,
              onGenerate: () => void runProposal(),
            }}
          />
        </div>

        {/*
          Coluna direita: moldura fixa por fora, rolagem por dentro.

          ──────────────────────────────────────────────────────────────────
          As duas camadas não são decoração. O ecrã de progresso é
          `absolute inset-0`, e um elemento assim posicionado dentro de um
          contentor que rola mede-se pela ALTURA DO CONTEÚDO, não pela do
          painel: cobria o primeiro ecrã da proposta e deslizava com o resto,
          deixando o design system à vista por baixo. Era isso o "scroll
          bugado" — e era também a razão de o resultado parecer pronto antes
          de as imagens existirem.

          Com a moldura de fora a não rolar, `inset-0` passa a ser o painel
          visível e o progresso cobre-o sempre.
          ──────────────────────────────────────────────────────────────────
        */}
        <div className="relative min-h-0 overflow-hidden rounded-[14px] border border-line bg-ink-900/40">
          <div
            className={cn(
              'relative size-full p-3.5',
              // Nada rola enquanto se gera: a barra atrás do vidro fosco não
              // levava a sítio nenhum.
              phase ? 'overflow-hidden' : 'overflow-y-auto',
            )}
          >
            {spec ? (
              <IdentityProposalView
                spec={spec}
                brand={brand}
                assets={assets}
                logoUrl={logoUrl}
                // Cada superfície recebe o ficheiro feito para ela, com
                // recurso ao principal quando não existe versão própria.
                logoOnLightUrl={logoOnLightUrl}
                logoOnDarkUrl={logoOnDarkUrl}
                visualStates={visualStates}
                busy={phase !== null}
                onRegenerateVisual={() => void regenerateVisual()}
                onColorChange={(role: BrandColorRole, hex) =>
                  updateSpec(setSpecColor(spec, role, hex))
                }
                onAddAccent={() => updateSpec(addSpecAccent(spec))}
                onRemoveAccent={() => updateSpec(removeSpecAccent(spec))}
                onTypographyChange={(patch) => updateSpec(setSpecTypography(spec, patch))}
                onTaglineChange={(value) => updateSpec(setSpecTagline(spec, value))}
                onVisualPromptChange={(kind, prompt) =>
                  updateSpec(setVisualPrompt(spec, kind, prompt))
                }
                onPreviewVisual={setPreview}
              />
            ) : (
              <EmptyProposal />
            )}
          </div>

          {phase ? (
            <IdentityProgress
              phase={phase}
              // O logótipo já foi guardado quando o cliente o carregou; sem
              // logótipo, também não há cores a ler. Passos que não correm
              // não aparecem como feitos.
              hidden={hasLogo ? ['guardar'] : ['guardar', 'cores']}
            />
          ) : null}
        </div>
      </div>

      {/* Prévia ampliada de um visual */}
      <Dialog
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.label ?? 'Visual'}
        width="lg"
      >
        {preview?.assetId && assets[preview.assetId]?.url ? (
          <div className="flex flex-col gap-2">
            <img
              src={assets[preview.assetId]?.url}
              alt={preview.label}
              className="w-full rounded-[10px]"
            />
            <p className="text-[11.5px] leading-relaxed text-fg-faint">
              Gerado por IA a partir do teu logótipo e das cores da marca.
            </p>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

/**
 * Estado vazio da coluna direita.
 *
 * O campo de pontos aparece aqui porque não há arte nenhuma por trás com que
 * competir — é o mesmo critério usado no editor.
 *
 * O texto diz onde está o botão e que nada é gerado antes dele. Dizia
 * "adiciona o logótipo e as cores para veres a proposta", que era verdade
 * quando o logótipo disparava a geração — e deixou de ser.
 */
function EmptyProposal() {
  return (
    <div className="absolute inset-0">
      <SonarGrid
        className="flex size-full items-center justify-center"
        pingArea={[0.12, 0.15, 0.88, 0.85]}
        baseOpacity={0.22}
        dotRadius={1.5}
        pingEvery={3.4}
      >
        <span aria-hidden className="sonar-wash pointer-events-none absolute inset-0 -z-10" />
        <div className="edge-top relative max-w-sm rounded-[16px] bg-ink-900/80 px-7 py-7 text-center shadow-[0_24px_60px_-28px_rgba(0,0,0,0.9)] ring-1 ring-line backdrop-blur-sm">
          <span className="mx-auto mb-4 grid size-11 place-items-center rounded-[13px] bg-ink-800 text-fg-faint ring-1 ring-line">
            <Sparkles className="size-[1.1rem]" aria-hidden />
          </span>
          <h2 className="text-[14.5px] font-semibold text-fg">
            A proposta da tua marca aparece aqui.
          </h2>
          <p className="mx-auto mt-2 max-w-[18rem] text-[12.5px] leading-relaxed text-fg-muted">
            Preenche os dados à esquerda e carrega em «Gerar a identidade da marca».
            Até lá, nada é gerado.
          </p>
        </div>
      </SonarGrid>
    </div>
  );
}
