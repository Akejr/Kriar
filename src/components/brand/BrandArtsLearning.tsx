'use client';

import * as React from 'react';
import { Check, ImagePlus, RefreshCw, Sparkles, Trash2, X } from 'lucide-react';
import { APP } from '@/config/app';
import { libraryOf, LIBRARY_LIMIT } from '@/lib/brand/library';
import { readLibrary } from '@/lib/brand/libraryOps';
import { LEARN_IMAGE_LIMIT, profileText } from '@/lib/brand/styleLearning';
import { getBackend } from '@/lib/data';
import { registerAsset, resolveAsset } from '@/lib/data/assetCache';
import type { Brand, BrandStyleLearning, BrandStyleReference } from '@/lib/domain/types';
import { checkImageFile, downscaleImageBlob } from '@/lib/utils/files';
import { cn } from '@/lib/utils/cn';
import { Dropzone } from '@/components/ui/Dropzone';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { Button, Callout, IconButton, Spinner, Switch } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';

export type BrandArtsLearningHandle = {
  /** Aprende com as artes escolhidas e ainda não lidas. `true` se correu bem. */
  learnPending: () => Promise<boolean>;
};

type Picked = { id: string; file: File; url: string };
type Phase = {
  step: 'preparar' | 'ler' | 'guardar';
  startedAt: number;
  /** O que está a acontecer, para o cliente saber porque espera. */
  label: string;
};

const PROFILE_FIELDS = [
  ['composition', 'Composição'],
  ['typography', 'Tipografia'],
  ['color', 'Cor'],
  ['imagery', 'Imagem'],
  ['graphics', 'Grafismos'],
  ['copy', 'Texto'],
  ['logo', 'Logótipo'],
] as const;

/**
 * A BIBLIOTECA DA MARCA — as artes que representam a empresa, e o estilo
 * que se aprende com elas.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Duas portas de entrada:
 *
 *  · aqui (e no cadastro): o cliente envia as artes que já publica. Uma
 *    leitura por visão vê-as todas, ordena-as pelo que representam do
 *    estilo e descreve o conteúdo de cada uma; ficam TODAS guardadas, e as
 *    duas melhores seguem mais vezes como exemplo. Guardavam-se só essas
 *    duas — "enviei várias artes, mas só carregaram duas";
 *  · no editor: "Usar como referência da marca" junta uma arte gerada e
 *    aprovada pelo cliente.
 *
 * Sempre que a biblioteca muda, o perfil é lido de novo com ela. É o perfil,
 * em texto, que leva a biblioteca inteira a todos os pedidos; como imagem
 * seguem só duas ou três por geração (`pickLibraryArts`).
 *
 * Este componente não grava a marca. Entrega o resultado a
 * `onLearningChange`, e é quem o usa que decide como guardar — no cadastro
 * e na página da marca a gravação é diferente.
 * ──────────────────────────────────────────────────────────────────────────
 */
export const BrandArtsLearning = React.forwardRef<
  BrandArtsLearningHandle,
  {
    brand: Brand;
    accountId: string;
    /** Guarda o estilo novo (ou `null` para o esquecer). `true` se ficou guardado. */
    onLearningChange: (learning: BrandStyleLearning | null) => Promise<boolean>;
    /** Avisa quem está à volta: há trabalho em curso? quantas artes por ler? */
    onStateChange?: (state: { working: boolean; pending: number }) => void;
  }
>(function BrandArtsLearning({ brand, accountId, onLearningChange, onStateChange }, ref) {
  const { show } = useToast();
  const [files, setFiles] = React.useState<Picked[]>([]);
  const [phase, setPhase] = React.useState<Phase | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const running = React.useRef(false);

  // A marca mais recente, para os pedidos longos não escreverem sobre uma cópia antiga.
  const latest = React.useRef(brand);
  React.useEffect(() => {
    latest.current = brand;
  }, [brand]);

  const learning = brand.identity.styleLearning ?? null;
  const library = libraryOf(learning);

  React.useEffect(() => {
    onStateChange?.({ working: phase !== null, pending: files.length });
  }, [phase, files.length, onStateChange]);

  // As miniaturas são URLs de objecto: libertam-se quando saem do ecrã.
  const filesRef = React.useRef(files);
  React.useEffect(() => {
    filesRef.current = files;
  }, [files]);
  React.useEffect(
    () => () => {
      for (const entry of filesRef.current) URL.revokeObjectURL(entry.url);
    },
    [],
  );

  function add(list: File[]) {
    setError(null);
    const room = LEARN_IMAGE_LIMIT - files.length;
    let rejected: string | null = null;
    const accepted: Picked[] = [];
    for (const file of list) {
      if (accepted.length >= room) {
        rejected = `Cabem até ${LEARN_IMAGE_LIMIT} artes de cada vez. As restantes ficaram de fora.`;
        break;
      }
      const check = checkImageFile(file);
      if (!check.ok) {
        rejected = `${file.name}: ${check.reason}`;
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        url: URL.createObjectURL(file),
      });
    }
    if (rejected) setError(rejected);
    if (accepted.length > 0) setFiles((current) => [...current, ...accepted]);
  }

  function remove(id: string) {
    setFiles((current) => {
      const entry = current.find((item) => item.id === id);
      if (entry) URL.revokeObjectURL(entry.url);
      return current.filter((item) => item.id !== id);
    });
  }

  function clearFiles() {
    setFiles((current) => {
      for (const entry of current) URL.revokeObjectURL(entry.url);
      return [];
    });
  }

  /**
   * Lê as artes enviadas, junto com a biblioteca, e guarda-as todas.
   *
   * As que já estão na biblioteca entram na leitura para o perfil contar com
   * elas, mas não se guardam outra vez. A biblioteca cresce até
   * `LIBRARY_LIMIT`; para recomeçar do zero há "Esquecer este estilo".
   */
  async function learn(): Promise<boolean> {
    const picked = filesRef.current;
    if (picked.length === 0 || running.current) return false;
    const current = latest.current.identity.styleLearning ?? null;
    const existing = libraryOf(current);
    if (existing.length >= LIBRARY_LIMIT) {
      setError(`A biblioteca já tem ${LIBRARY_LIMIT} artes. Retira algumas antes de juntar mais.`);
      return false;
    }
    running.current = true;
    setError(null);
    const startedAt = Date.now();
    const backend = getBackend();
    const uploaded: string[] = [];

    try {
      setPhase({ step: 'ler', startedAt, label: lerLabel(picked.length, existing.length) });
      const reading = await readLibrary({
        company: latest.current.company,
        fresh: picked.map((entry) => entry.file),
        library: existing,
        previous: current ? profileText(current.profile, 1200) : '',
      });

      /*
        Todas sobem para a conta, a 1024 px, pela ordem da leitura — a que
        melhor representa o estilo primeiro —, até a biblioteca encher.
      */
      const room = LIBRARY_LIMIT - existing.length;
      const chosen = reading.picks.filter((pick) => picked[pick.index]).slice(0, room);
      setPhase({
        step: 'guardar',
        startedAt,
        label: `A guardar ${chosen.length === 1 ? 'a arte' : `as ${chosen.length} artes`} na biblioteca`,
      });
      const added: BrandStyleReference[] = [];
      // Uma hora só para o lote: cada envio leva tempo, e `Date.now()` dentro
      // do ciclo fazia as últimas parecerem as mais recentes.
      const savedAt = Date.now();
      for (const [order, pick] of chosen.entries()) {
        const entry = picked[pick.index];
        if (!entry) continue;
        const stored = await downscaleImageBlob(entry.file, 1024, 0.88, { reencode: true });
        const asset = await backend.uploadAsset({
          accountId,
          // `reference` é um dos tipos que a base de dados aceita; um tipo
          // novo pedia uma migração só para isto.
          kind: 'reference',
          file: stored.blob,
          name: `arte-da-marca-${order + 1}.jpg`,
          width: stored.width || null,
          height: stored.height || null,
          provenance: 'upload',
        });
        uploaded.push(asset.id);
        registerAsset(asset, await backend.resolveAssetUrl(asset));
        added.push({
          assetId: asset.id,
          content: pick.content ?? '',
          why: pick.why ?? '',
          // As duas primeiras da leitura seguem mais vezes como exemplo.
          featured: order < 2,
          width: stored.width || null,
          height: stored.height || null,
          source: 'cadastro',
          topics: Array.isArray(pick.topics) ? pick.topics : [],
          format: formatOf(stored.width, stored.height),
          projectId: null,
          fromAssetId: null,
          // A biblioteca mostra as mais recentes primeiro: a melhor fica à frente.
          addedAt: new Date(savedAt + (chosen.length - order)).toISOString(),
        });
      }
      const left = picked.length - added.length;

      const next: BrandStyleLearning = {
        enabled: current?.enabled ?? true,
        profile: reading.profile,
        references: [...added, ...existing].slice(0, LIBRARY_LIMIT),
        analysedCount: reading.analysedCount,
        consistency: reading.consistency,
        analysedAt: new Date().toISOString(),
        producedBy: reading.producedBy,
      };

      const saved = await onLearningChange(next);
      if (!saved) {
        // Não ficou guardado: as imagens não ficam órfãs na conta.
        for (const id of uploaded) void backend.deleteAsset(id).catch(() => undefined);
        return false;
      }

      clearFiles();
      setAdding(false);
      const kept = `${added.length} ${added.length === 1 ? 'arte guardada' : 'artes guardadas'} na biblioteca`;
      show({
        tone: left > 0 ? 'aviso' : 'sucesso',
        message:
          left > 0
            ? `Estilo actualizado, com ${kept}. ${left === 1 ? 'Uma ficou' : `${left} ficaram`} de fora: a biblioteca leva até ${LIBRARY_LIMIT} artes.`
            : existing.length > 0
              ? `Estilo actualizado, com ${kept}.`
              : `Estilo aprendido, com ${kept}.`,
      });
      return true;
    } catch (cause) {
      for (const id of uploaded) void backend.deleteAsset(id).catch(() => undefined);
      setError(
        cause instanceof Error ? cause.message : 'Não foi possível aprender o estilo. Tenta de novo.',
      );
      return false;
    } finally {
      running.current = false;
      setPhase(null);
    }
  }

  React.useImperativeHandle(ref, () => ({ learnPending: learn }));

  /** Lê o perfil outra vez, só com o que está na biblioteca. */
  async function relearn(base: BrandStyleLearning, quiet = false): Promise<void> {
    if (base.references.length === 0) return;
    running.current = true;
    setPhase({
      step: 'ler',
      startedAt: Date.now(),
      label: `A ler o estilo das ${base.references.length} artes da biblioteca`,
    });
    try {
      const reading = await readLibrary({
        company: latest.current.company,
        fresh: [],
        library: base.references,
        previous: profileText(base.profile, 1200),
      });
      const saved = await onLearningChange({
        ...base,
        profile: reading.profile,
        consistency: reading.consistency,
        analysedCount: reading.analysedCount,
        analysedAt: new Date().toISOString(),
        producedBy: reading.producedBy,
      });
      if (saved && !quiet) show({ tone: 'sucesso', message: 'Estilo lido de novo com a biblioteca.' });
    } catch (cause) {
      show({
        tone: 'aviso',
        message:
          cause instanceof Error
            ? `Não foi possível ler o estilo de novo: ${cause.message}`
            : 'Não foi possível ler o estilo de novo.',
      });
    } finally {
      running.current = false;
      setPhase(null);
    }
  }

  /** Retira uma arte e lê o perfil sem ela. */
  async function removeArt(assetId: string) {
    const current = latest.current.identity.styleLearning;
    if (!current || running.current) return;
    const next: BrandStyleLearning = {
      ...current,
      references: current.references.filter((entry) => entry.assetId !== assetId),
    };
    const saved = await onLearningChange(next);
    if (!saved) return;
    // Só depois de gravado: ao contrário, uma falha deixava a biblioteca a
    // apontar para um ficheiro que já não existe.
    void getBackend().deleteAsset(assetId).catch(() => undefined);
    show({ tone: 'info', message: 'Arte retirada da biblioteca.' });
    await relearn(next, true);
  }

  async function forget() {
    const previous = latest.current.identity.styleLearning;
    const saved = await onLearningChange(null);
    if (!saved) return;
    for (const reference of previous?.references ?? []) {
      void getBackend().deleteAsset(reference.assetId).catch(() => undefined);
    }
    show({
      tone: 'info',
      message: 'Biblioteca e estilo esquecidos. As novas publicações deixam de os seguir.',
    });
  }

  const showUploader = !learning || adding;

  return (
    <div className="flex flex-col gap-4">
      {learning && !adding ? (
        <LearnedStyle
          learning={learning}
          library={library}
          busy={phase !== null}
          onToggle={(enabled) => void onLearningChange({ ...learning, enabled })}
          onAdd={() => setAdding(true)}
          onRelearn={() => void relearn(learning)}
          onRemove={(assetId) => void removeArt(assetId)}
          onForget={forget}
        />
      ) : null}

      {phase && !showUploader ? <LearningProgress phase={phase} /> : null}

      {showUploader ? (
        phase ? (
          <LearningProgress phase={phase} />
        ) : (
          <>
            <Dropzone
              multiple
              accept={APP.uploads.acceptedImageMimes.join(',')}
              onFiles={add}
              disabled={files.length >= LEARN_IMAGE_LIMIT}
              compact={files.length > 0}
              title={
                files.length >= LEARN_IMAGE_LIMIT
                  ? `Chegaste às ${LEARN_IMAGE_LIMIT} artes`
                  : files.length > 0
                    ? 'Juntar mais artes'
                    : 'Arrasta as tuas artes ou clica para escolher'
              }
              hint={`PNG, JPG ou WEBP · até ${LEARN_IMAGE_LIMIT} artes · 8 MB cada`}
            />

            {files.length > 0 ? (
              <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
                {files.map((entry, index) => (
                  <li
                    key={entry.id}
                    className="group relative aspect-[4/5] overflow-hidden rounded-[10px] bg-ink-800 ring-1 ring-line animate-[kriar-rise_0.2s_var(--ease-out-soft)]"
                  >
                    <img
                      src={entry.url}
                      alt={`Arte ${index + 1}: ${entry.file.name}`}
                      className="size-full object-cover"
                    />
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-ink-950/80 px-1.5 text-[10px] font-semibold tabular-nums text-fg">
                      {index + 1}
                    </span>
                    <IconButton
                      label={`Tirar a arte ${index + 1}`}
                      size="sm"
                      onClick={() => remove(entry.id)}
                      className="absolute right-1 top-1 bg-ink-950/80 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    >
                      <X className="size-3.5" aria-hidden />
                    </IconButton>
                  </li>
                ))}
              </ul>
            ) : null}

            {error ? <Callout tone="danger">{error}</Callout> : null}

            <div className="flex flex-wrap items-center gap-3">
              {adding ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    clearFiles();
                    setAdding(false);
                    setError(null);
                  }}
                >
                  Cancelar
                </Button>
              ) : null}
              <Button
                variant="primary"
                disabled={files.length === 0}
                onClick={() => void learn()}
                className={files.length > 0 ? 'glow-neon' : undefined}
              >
                <Sparkles className="size-4" aria-hidden />
                {files.length === 0
                  ? 'Aprender o estilo'
                  : `Aprender com ${files.length} ${files.length === 1 ? 'arte' : 'artes'}`}
              </Button>
              <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-fg-faint">
                {library.length > 0
                  ? 'Lemos as novas com as que já estão na biblioteca e guardamos todas. As que melhor representam o estilo seguem mais vezes como exemplo.'
                  : 'Quantas mais, melhor a leitura. Guardamos todas; as que melhor representam o estilo seguem mais vezes como exemplo.'}
              </p>
            </div>
          </>
        )
      ) : null}
    </div>
  );
});

function lerLabel(fresh: number, inLibrary: number): string {
  const novas = fresh === 1 ? 'da arte' : `das ${fresh} artes`;
  return inLibrary > 0
    ? `A ler o estilo ${novas}, com as ${Math.min(inLibrary, LEARN_IMAGE_LIMIT - fresh)} da biblioteca`
    : `A ler o estilo ${novas}`;
}

/** O formato mais próximo das medidas de uma arte enviada. */
function formatOf(width: number, height: number): BrandStyleReference['format'] {
  if (!width || !height) return null;
  const ratio = width / height;
  if (ratio < 0.68) return 'story';
  if (ratio < 0.9) return 'vertical';
  if (ratio < 1.15) return 'quadrado';
  if (ratio < 1.85) return 'horizontal';
  return 'linkedin';
}

/** A biblioteca, o perfil e as acções. */
function LearnedStyle({
  learning,
  library,
  busy,
  onToggle,
  onAdd,
  onRelearn,
  onRemove,
  onForget,
}: {
  learning: BrandStyleLearning;
  library: BrandStyleReference[];
  busy: boolean;
  onToggle: (enabled: boolean) => void;
  onAdd: () => void;
  onRelearn: () => void;
  onRemove: (assetId: string) => void;
  onForget: () => Promise<void>;
}) {
  const urls = useReferenceUrls(library);
  const approved = library.filter((entry) => entry.source === 'aprovada').length;
  const [confirming, setConfirming] = React.useState<string | null>(null);

  return (
    <div
      className={cn(
        'rounded-[14px] bg-ink-950/50 p-4 ring-1 transition-opacity',
        learning.enabled ? 'ring-neon/25' : 'ring-line opacity-80',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-fg">
            <Check className="size-4 text-neon" aria-hidden />
            Biblioteca com {library.length} {library.length === 1 ? 'arte' : 'artes'}
            {approved > 0 ? (
              <span className="font-normal text-fg-muted">
                · {approved} {approved === 1 ? 'aprovada' : 'aprovadas'} na Kriar
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-fg-muted">
            Estilo lido de {learning.analysedCount}{' '}
            {learning.analysedCount === 1 ? 'arte' : 'artes'}.
            {learning.consistency ? ` ${learning.consistency}` : ''}
          </p>
        </div>
        <Switch
          checked={learning.enabled}
          onChange={onToggle}
          disabled={busy}
          label="Usar nas novas publicações"
        />
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-fg">{learning.profile.summary}</p>

      {library.length > 0 ? (
        <ul className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
          {library.map((reference, index) => {
            const asking = confirming === reference.assetId;
            const label =
              reference.source === 'aprovada' ? 'Aprovada na Kriar' : 'Enviada por ti';
            return (
              <li
                key={reference.assetId}
                className="group relative aspect-[4/5] overflow-hidden rounded-[10px] bg-ink-800 ring-1 ring-line"
                title={[reference.why, reference.content && `Não copiamos: ${reference.content}`]
                  .filter(Boolean)
                  .join(' · ')}
              >
                {urls[reference.assetId] ? (
                  <img
                    src={urls[reference.assetId]}
                    alt={`Arte ${index + 1} da biblioteca. ${label}.`}
                    className="size-full object-cover"
                  />
                ) : null}
                <span
                  className={cn(
                    'absolute bottom-1.5 left-1.5 rounded-full bg-ink-950/85 px-1.5 py-px text-[9.5px] font-medium ring-1 backdrop-blur-sm',
                    reference.source === 'aprovada'
                      ? 'text-neon ring-neon/40'
                      : 'text-fg-muted ring-line',
                  )}
                >
                  {reference.source === 'aprovada' ? 'Aprovada' : 'Enviada'}
                </span>

                {asking ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-ink-950/85 p-2 text-center backdrop-blur-sm">
                    <p className="text-[10.5px] leading-snug text-fg">Retirar da biblioteca?</p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                        Não
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setConfirming(null);
                          onRemove(reference.assetId);
                        }}
                      >
                        Retirar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <IconButton
                    label={`Retirar a arte ${index + 1} da biblioteca`}
                    size="sm"
                    disabled={busy}
                    onClick={() => setConfirming(reference.assetId)}
                    className="absolute right-1 top-1 bg-ink-950/80 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  >
                    <X className="size-3.5" aria-hidden />
                  </IconButton>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-[12px] leading-relaxed text-fg-faint">
          A biblioteca está vazia. O estilo continua a valer; junta artes para o manter actual.
        </p>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
        Em cada publicação seguem duas ou três destas, escolhidas pelo tema e em rotação. No editor,
        &ldquo;Usar como referência da marca&rdquo; junta aqui uma arte aprovada.
      </p>

      <dl className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {PROFILE_FIELDS.map(([key, label]) =>
          learning.profile[key] ? (
            <div key={key} className="min-w-0">
              <dt className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-faint">
                {label}
              </dt>
              <dd className="mt-0.5 text-[12px] leading-relaxed text-fg-muted">
                {learning.profile[key]}
              </dd>
            </div>
          ) : null,
        )}
      </dl>

      {learning.profile.recurring.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Elementos que se repetem">
          {learning.profile.recurring.map((item) => (
            <li
              key={item}
              className="rounded-full bg-ink-800 px-2.5 py-0.5 text-[11px] text-fg-muted ring-1 ring-line"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onAdd}
          disabled={busy || library.length >= LIBRARY_LIMIT}
        >
          <ImagePlus className="size-3.5" aria-hidden />
          Juntar artes
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRelearn}
          disabled={busy || library.length === 0}
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Ler o estilo outra vez
        </Button>
        <InlineConfirm
          label="Esquecer este estilo"
          icon={<Trash2 className="size-4" aria-hidden />}
          variant="ghost"
          confirmLabel="Esquecer"
          danger
          message="As artes da biblioteca são apagadas e as novas publicações deixam de seguir este estilo."
          onConfirm={onForget}
        />
      </div>
    </div>
  );
}

function LearningProgress({ phase }: { phase: Phase }) {
  const elapsed = useElapsed(phase.startedAt);
  const steps: Array<[Phase['step'], string]> = [
    ['ler', phase.step === 'ler' ? phase.label : 'Ler o estilo'],
    ['guardar', phase.step === 'guardar' ? phase.label : 'Guardar na biblioteca'],
  ];
  const current = steps.findIndex(([step]) => step === phase.step);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-4 rounded-[14px] bg-ink-950/50 p-4 ring-1 ring-neon/25"
    >
      <Spinner />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-fg">A aprender o estilo da tua marca</p>
        <ol className="mt-2 flex flex-col gap-1.5">
          {steps.map(([step, label], index) => (
            <li
              key={step}
              className={cn(
                'flex items-center gap-2 text-[12px]',
                index < current ? 'text-fg-muted' : index === current ? 'text-fg' : 'text-fg-faint',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'grid size-4 place-items-center rounded-full',
                  index < current
                    ? 'bg-neon/15 text-neon'
                    : index === current
                      ? 'bg-neon/15 ring-1 ring-neon/40'
                      : 'bg-ink-800',
                )}
              >
                {index < current ? (
                  <Check className="size-2.5" aria-hidden />
                ) : index === current ? (
                  <span className="size-1.5 rounded-full bg-neon animate-[kriar-pulse-soft_1s_ease-in-out_infinite]" />
                ) : null}
              </span>
              {label}
            </li>
          ))}
        </ol>
        <p className="mt-2.5 text-[11px] tabular-nums text-fg-faint">
          {elapsed}s decorridos · costuma levar 20 a 40 segundos
        </p>
      </div>
    </div>
  );
}

function useReferenceUrls(references: BrandStyleReference[]): Record<string, string> {
  const [urls, setUrls] = React.useState<Record<string, string>>({});
  const key = references.map((reference) => reference.assetId).join('|');

  React.useEffect(() => {
    let cancelled = false;
    const ids = key ? key.split('|') : [];
    void Promise.all(
      ids.map((id) =>
        resolveAsset(id)
          .then((asset) => [id, asset?.url ?? ''] as const)
          .catch(() => [id, ''] as const),
      ),
    ).then((entries) => {
      if (!cancelled) setUrls(Object.fromEntries(entries.filter(([, url]) => url)));
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return urls;
}

function useElapsed(startedAt: number): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return Math.max(0, Math.round((now - startedAt) / 1000));
}
