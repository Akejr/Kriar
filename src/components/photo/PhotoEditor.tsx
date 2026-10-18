'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Brush, Download, RotateCcw, Trash2 } from 'lucide-react';
import { APP } from '@/config/app';
import { prepareZoneEdit, BRUSH_SIZES } from '@/lib/composition/zones';
import { closestFormat } from '@/lib/domain/catalog';
import type { Brand } from '@/lib/domain/types';
import { cn } from '@/lib/utils/cn';
import {
  blobToDataUrl,
  checkImageFile,
  dataUrlToBlob,
  downloadBlob,
  downscaleImageBlob,
  readImageSize,
} from '@/lib/utils/files';
import { StageLoader } from '@/components/editor/StageLoader';
import { CompareSlider } from '@/components/editor/zones/CompareSlider';
import { useZoneEditor } from '@/components/editor/zones/useZoneEditor';
import { ZoneCanvas } from '@/components/editor/zones/ZoneCanvas';
import { ZonePanel, zonePosition } from '@/components/editor/zones/ZonePanel';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button, Callout, Card } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import type { WorkPhase } from '@/store/editor';
import { useEditor } from '@/store/editor';

/**
 * Editar uma fotografia do cliente, por zonas.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * É o editor de zonas que já existe na arte final, apontado a outro
 * material: o cliente carrega uma fotografia, pinta por cima o que quer
 * mudar, escreve o pedido de cada zona e aplica. Nada aqui é uma segunda
 * implementação — `useZoneEditor`, `ZoneCanvas`, `ZonePanel`,
 * `prepareZoneEdit`, `CompareSlider` e a composição com máscaras no
 * servidor são os mesmos da publicação.
 *
 * Três diferenças em relação à edição de uma arte, e todas vêm do material:
 *
 *  1. A MOLDURA é a própria fotografia. Numa publicação, o cliente pinta
 *     sobre o formato (4:5) e o ficheiro do gerador tem outra proporção
 *     (3:4), e `prepareZoneEdit` faz a conta entre as duas. Aqui a moldura
 *     e o ficheiro são a mesma coisa.
 *
 *  2. NÃO HÁ VERIFICAÇÃO automática nem segunda tentativa. A da arte
 *     compara o resultado com o título, os contactos e o logótipo
 *     esperados — numa fotografia não há nada disso para comparar, e uma
 *     correcção automática custaria uma segunda geração para decidir à
 *     sorte. Fica uma passagem, e quem decide é quem vê: o resultado abre
 *     em comparação, com "voltar à anterior" ao lado.
 *
 *  3. NÃO HÁ PROJECTO nem marca envolvida, por isso também não há a store
 *     do editor — só estado local. A store só entra no fim, para a ponte
 *     "usar numa publicação".
 *
 * A garantia que faz isto valer a pena é a do servidor: com "só dentro das
 * zonas" ligado, `composeEdit` alinha o que o gerador devolveu e deixa-o
 * entrar apenas dentro das máscaras. Fora delas, a fotografia que sai é
 * igual à que entrou, ao píxel.
 * ──────────────────────────────────────────────────────────────────────────
 */

/** Uma imagem em memória, com as medidas já lidas. */
type Picture = { dataUrl: string; width: number; height: number };

/** Os passos desta operação, para o indicador de progresso. */
const PHOTO_STEPS = ['A preparar as zonas', 'A aplicar as alterações', 'A terminar'];

/** Medido com o modelo actual: sem verificação, leva perto de minuto e meio. */
const PHOTO_EXPECTED_SECONDS = 85;

export function PhotoEditor({ brand, accountId }: { brand: Brand; accountId: string }) {
  const router = useRouter();
  const { show } = useToast();
  const editor = useZoneEditor();

  const startDraft = useEditor((state) => state.startDraft);
  const addImages = useEditor((state) => state.addImages);
  const saveNow = useEditor((state) => state.saveNow);

  const [photo, setPhoto] = React.useState<Picture | null>(null);
  /** A fotografia antes da última edição. Permite voltar atrás e comparar. */
  const [previous, setPrevious] = React.useState<Picture | null>(null);
  const [compare, setCompare] = React.useState(false);
  const [preserve, setPreserve] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [phase, setPhase] = React.useState<WorkPhase | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [handing, setHanding] = React.useState(false);

  const aspect = photo ? photo.height / photo.width : 1;

  /*
    Atalhos do pincel, em captura.

    Os mesmos da arte final, e pela mesma razão: Ctrl+Z tem de desfazer o
    último TRAÇO e não a última acção da página.
  */
  const { undo, redo, setBrush, brush } = editor;
  React.useEffect(() => {
    if (!photo || compare) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && (key === 'z' || key === 'y')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (key === 'y' || event.shiftKey) redo();
        else undo();
      } else if (event.key === '[' || event.key === ']') {
        event.preventDefault();
        const index = BRUSH_SIZES.findIndex((size) => Math.abs(size.value - brush) < 0.0001);
        const next = Math.min(
          BRUSH_SIZES.length - 1,
          Math.max(0, (index < 0 ? 1 : index) + (event.key === ']' ? 1 : -1)),
        );
        setBrush(BRUSH_SIZES[next].value);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [photo, compare, undo, redo, setBrush, brush]);

  /** A fotografia escolhida, reduzida e medida. */
  async function pick(files: File[]) {
    const file = files[0];
    if (!file) return;
    const check = checkImageFile(file, 'product');
    if (!check.ok) {
      setError(check.reason);
      return;
    }
    setError(null);
    try {
      /*
        1600 px e `reencode: true`, mesmo quando já cabe.

        Uma fotografia de telemóvel chega com 12 MP e vários megabytes: em
        base64 passava o limite da rota, e o gerador não aproveita a
        diferença. A reconversão limpa também os metadados do telemóvel — a
        localização incluída — antes de a fotografia sair do browser.
      */
      const reduced = await downscaleImageBlob(file, 1600, 0.92, { reencode: true });
      const size =
        reduced.width && reduced.height
          ? { width: reduced.width, height: reduced.height }
          : await readImageSize(reduced.blob);
      setPhoto({ dataUrl: await blobToDataUrl(reduced.blob), ...size });
      setPrevious(null);
      setCompare(false);
      setNotice(null);
      editor.reset();
    } catch {
      setError('Não foi possível ler esta fotografia. Tenta outro ficheiro.');
    }
  }

  async function apply() {
    if (!photo || busy) return;
    const zones = editor.zones.filter((zone) => zone.strokes.length > 0);
    if (zones.length === 0) return;

    setBusy(true);
    setError(null);
    setNotice(null);
    const startedAt = Date.now();
    const step = (label: string): WorkPhase => ({
      kind: 'edicao',
      label,
      indeterminate: true,
      startedAt,
      steps: PHOTO_STEPS,
      title: 'A editar a tua fotografia',
    });
    setPhase(step(PHOTO_STEPS[0]));

    try {
      const prepared = await prepareZoneEdit({
        artUrl: photo.dataUrl,
        // A moldura é a própria fotografia: o cliente pintou sobre ela.
        frame: { width: photo.width, height: photo.height },
        zones,
      });

      setPhase(step(PHOTO_STEPS[1]));
      const response = await fetch('/api/ai/edit-photo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          photo: prepared.art,
          map: prepared.map,
          // Só decide a proporção pedida ao gerador; o resultado volta às
          // medidas da fotografia.
          format: closestFormat(photo.width, photo.height),
          zones: zones.map((zone, index) => ({
            request: editor.extras[zone.id]?.comment.trim() ?? '',
            position: zonePosition(zone, aspect),
            mask: prepared.masks[index],
            image: editor.extras[zone.id]?.image?.dataUrl ?? null,
          })),
          preserveOutside: preserve,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? 'A edição falhou. A tua fotografia ficou intacta.');
      }

      setPhase(step(PHOTO_STEPS[2]));
      const edited: Picture = {
        dataUrl: data.dataUrl,
        width: data.width ?? photo.width,
        height: data.height ?? photo.height,
      };

      setPrevious(photo);
      setPhoto(edited);
      editor.reset();
      // Antes e depois, logo a seguir: a pergunta natural é "ficou melhor?".
      setCompare(true);

      /*
        O cliente pediu que o resto ficasse igual e o gerador recompôs a
        fotografia toda: a composição não foi possível, e isso tem de ser
        dito — é exactamente a garantia que ele escolheu.
      */
      const zonesQuietas = Array.isArray(data.zones)
        ? data.zones.filter((zone: { unchanged?: boolean }) => zone?.unchanged).length
        : 0;
      setNotice(
        preserve && data.composited === false
          ? 'A IA mexeu também fora das zonas, por isso não foi possível preservar o resto. Confere a fotografia inteira, ou volta à anterior.'
          : zonesQuietas > 0
            ? `${zonesQuietas === 1 ? 'Uma zona ficou' : `${zonesQuietas} zonas ficaram`} praticamente igual ao que estava. Experimenta ser mais específico no pedido.`
            : null,
      );
      show({ tone: 'sucesso', message: 'Edição aplicada.' });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'A edição falhou. A tua fotografia ficou intacta.',
      );
    } finally {
      setBusy(false);
      setPhase(null);
    }
  }

  function revert() {
    if (!previous) return;
    setPhoto(previous);
    setPrevious(null);
    setCompare(false);
    setNotice(null);
    editor.reset();
    show({ tone: 'info', message: 'Voltámos à fotografia anterior.' });
  }

  async function download() {
    if (!photo) return;
    const blob = await dataUrlToBlob(photo.dataUrl);
    const extension = blob.type === 'image/png' ? 'png' : 'jpg';
    downloadBlob(blob, `${APP.slug}-foto-editada.${extension}`);
  }

  /**
   * A ponte para o produto: a fotografia editada entra numa publicação
   * nova, já anexada.
   *
   * `saveNow` antes de navegar não é zelo: o rascunho vive em memória e
   * `/editor/[id]` lê o projecto do armazenamento. Sem a gravação forçada,
   * a navegação chegava lá antes da gravação automática e o editor abria em
   * "Este projecto já não existe".
   */
  async function openAsPost() {
    if (!photo) return;
    setHanding(true);
    try {
      const blob = await dataUrlToBlob(photo.dataUrl);
      const extension = blob.type === 'image/png' ? 'png' : 'jpg';
      const file = new File([blob], `foto-editada.${extension}`, { type: blob.type });

      startDraft(accountId, brand);
      const added = await addImages([file]);
      if (!added.ok) {
        throw new Error(added.errors?.[0] ?? 'Não foi possível anexar a fotografia.');
      }
      await saveNow();
      const projectId = useEditor.getState().project?.id;
      if (!projectId) throw new Error('Não foi possível abrir a publicação.');
      router.push(`/editor/${projectId}`);
    } catch (cause) {
      setHanding(false);
      show({
        tone: 'erro',
        message: cause instanceof Error ? cause.message : 'Não foi possível abrir a publicação.',
      });
    }
  }

  return (
    <div className="relative h-full overflow-hidden">
      <div className="relative h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-[82rem] px-4 py-7 sm:px-6 sm:py-9">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
                Editar fotografia
              </h1>
              <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-fg-muted">
                Envia uma fotografia tua, pinta por cima o que queres mudar e diz o que queres
                lá. Fora das zonas que marcas, a fotografia fica exactamente igual.
              </p>
            </div>
            {photo ? (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setPhoto(null);
                  setPrevious(null);
                  setCompare(false);
                  setError(null);
                  setNotice(null);
                  editor.reset();
                }}
              >
                <Trash2 className="size-4" aria-hidden />
                Começar de novo
              </Button>
            ) : null}
          </div>

          {!photo ? (
            <StartPanel onFiles={pick} error={error} />
          ) : (
            <div className="@container mt-6">
              {error ? (
                <Callout tone="danger" className="mb-4">
                  {error}
                </Callout>
              ) : null}
              {notice ? (
                <Callout tone="warn" className="mb-4" role="status">
                  {notice}
                </Callout>
              ) : null}

              {/*
                A fotografia e o painel lado a lado só quando há LARGURA
                para isso — medida no palco (`@container`), não no ecrã,
                como na arte final.
              */}
              <div className="flex flex-col items-center gap-5 @3xl:flex-row @3xl:items-start @3xl:justify-center">
                <div
                  className="relative w-full @3xl:min-w-0 @3xl:flex-1"
                  style={{
                    // A moldura cabe no ecrã também na altura: com a
                    // largura como único limite, uma fotografia em pé
                    // obrigava a rolar a meio de um traço.
                    maxWidth: `min(100%, 44rem, ${(70 / aspect).toFixed(2)}vh)`,
                  }}
                >
                  <div
                    className={cn(
                      'bg-checker relative overflow-hidden rounded-[10px] shadow-[0_32px_80px_-24px_rgba(0,0,0,0.95)] ring-1 transition-shadow duration-200',
                      compare ? 'ring-line-strong' : 'ring-neon/45',
                    )}
                    style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
                  >
                    {compare && previous ? (
                      <CompareSlider
                        before={previous.dataUrl}
                        after={photo.dataUrl}
                        beforeLabel="Antes"
                        afterLabel="Depois"
                      />
                    ) : (
                      <img
                        src={photo.dataUrl}
                        alt="A tua fotografia, com as zonas que marcaste."
                        className="absolute inset-0 size-full"
                        draggable={false}
                      />
                    )}

                    {!compare ? (
                      <ZoneCanvas
                        zones={editor.zones}
                        activeId={editor.activeId}
                        brush={editor.brush}
                        aspect={aspect}
                        disabled={busy}
                        onStroke={(stroke) => {
                          const outcome = editor.addStroke(stroke, aspect);
                          if (outcome === 'limite') {
                            show({
                              tone: 'aviso',
                              message:
                                'Já marcaste 4 zonas, o máximo por edição. Pinta junto a uma delas para a alargar, ou aplica estas primeiro.',
                            });
                          }
                        }}
                        onSelectZone={editor.setActiveId}
                      />
                    ) : null}

                    {/* O convite, enquanto não há nenhuma zona. */}
                    {!compare && editor.zones.length === 0 && !busy ? (
                      <span className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                        <span className="flex items-center gap-1.5 rounded-full bg-ink-950/80 px-3 py-1.5 text-[11.5px] font-medium text-fg ring-1 ring-neon/40 backdrop-blur-sm animate-[kriar-rise_0.25s_var(--ease-out-soft)]">
                          <Brush className="size-3.5 text-neon" aria-hidden />
                          Pinta por cima do que queres mudar
                        </span>
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <p className="text-[11.5px] tabular-nums text-fg-faint">
                      {photo.width} × {photo.height}
                    </p>
                    {compare ? (
                      <Button size="sm" variant="outline" onClick={() => setCompare(false)}>
                        <Brush className="size-3.5" aria-hidden />
                        Continuar a editar
                      </Button>
                    ) : null}
                    {previous ? (
                      <Button size="sm" variant="ghost" disabled={busy} onClick={revert}>
                        <RotateCcw className="size-3.5" aria-hidden />
                        Voltar à anterior
                      </Button>
                    ) : null}
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="primary" onClick={() => void download()}>
                        <Download className="size-3.5" aria-hidden />
                        Descarregar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={handing}
                        disabled={busy}
                        onClick={() => void openAsPost()}
                      >
                        Usar numa publicação
                        <ArrowRight className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </div>

                {/*
                  O painel fica sempre montado, também em comparação: o
                  estado das zonas é dele, e desmontá-lo ao comparar perdia
                  o pincel e o histórico de traços.
                */}
                <ZonePanel
                  editor={editor}
                  aspect={aspect}
                  busy={busy}
                  preserve={preserve}
                  subject="fotografia"
                  onPreserveChange={setPreserve}
                  onApply={() => {
                    setCompare(false);
                    void apply();
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {phase ? <StageLoader phase={phase} expectedSeconds={PHOTO_EXPECTED_SECONDS} /> : null}
    </div>
  );
}

/** O estado inicial: a zona de carregamento e o que esta tela faz. */
function StartPanel({
  onFiles,
  error,
}: {
  onFiles: (files: File[]) => void | Promise<void>;
  error: string | null;
}) {
  return (
    <div className="mt-6 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)]">
      <div>
        <Dropzone
          accept={APP.uploads.acceptedImageMimes.join(',')}
          onFiles={(files) => void onFiles(files)}
          title="Arrasta a fotografia para aqui, ou clica para escolher"
          hint="PNG, JPG, WEBP ou AVIF · até 8 MB · pelo menos 320 píxeis no lado mais curto"
          className="py-10"
        />
        {error ? (
          <Callout tone="danger" className="mt-3">
            {error}
          </Callout>
        ) : null}
        <Callout tone="info" className="mt-3">
          A fotografia é reduzida a 1600 píxeis e limpa de metadados — a localização incluída —
          antes de sair deste browser.
        </Callout>
      </div>

      <Card className="p-5">
        <h2 className="text-[13px] font-semibold text-fg">Como funciona</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {[
            {
              title: 'Pinta a zona',
              text: 'Marca com o pincel o que queres mudar: um objecto, o fundo, uma pessoa. Até quatro zonas.',
            },
            {
              title: 'Diz o que queres lá',
              text: 'Uma frase por zona — "tira o copo que está atrás", "põe um fundo cinzento liso".',
            },
            {
              title: 'O resto fica igual',
              text: 'Fora das zonas que marcaste, a fotografia que sai é igual à que entrou, ao píxel.',
            },
          ].map((step, index) => (
            <li key={step.title} className="flex gap-2.5">
              <span
                aria-hidden
                className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-ink-800 text-[10.5px] font-bold tabular-nums text-neon ring-1 ring-neon/30"
              >
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-fg">{step.title}</span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-fg-muted">
                  {step.text}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
