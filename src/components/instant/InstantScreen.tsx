'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Download, Gem, Pencil, RefreshCw, Sparkles } from 'lucide-react';
import { resolveAssets } from '@/lib/data/assetCache';
import { finishInputFrom } from '@/lib/composition/finishArtwork';
import { FORMATS, STYLES, getFormat, getStyle } from '@/lib/domain/catalog';
import {
  applyInstantInput,
  instantInputFrom,
  instantProblems,
  type InstantBrandInput,
} from '@/lib/domain/instant';
import type { Account, Brand, FormatId, FormatSpec, StyleId } from '@/lib/domain/types';
import { deriveAccent } from '@/lib/utils/color';
import { LogoUploader } from '@/components/brand/LogoUploader';
import { StageLoader } from '@/components/editor/StageLoader';
import { usePaintedArt } from '@/components/editor/usePaintedArt';
import { ColorField } from '@/components/ui/ColorField';
import { Logo } from '@/components/ui/Logo';
import {
  Badge,
  Button,
  Callout,
  Card,
  Field,
  Input,
  Segmented,
  Select,
  Spinner,
  Textarea,
} from '@/components/ui/primitives';
import { SonarGrid } from '@/components/ui/SonarGrid';
import { useToast } from '@/components/ui/Toast';
import { useEditor } from '@/store/editor';

/**
 * Arte instantânea: uma arte na hora, sem passar pelo cadastro.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O caminho curto do produto. O cadastro completo decide uma identidade
 * visual e leva tempo; aqui o painel de criação pede o mínimo — nome,
 * logótipo, duas cores — e gera.
 *
 * Vive FORA de `(painel)` de propósito. A casca do painel exige uma marca
 * pronta e manda quem não a tem para `/onboarding` — exactamente o passo
 * que este ecrã existe para saltar. Fica ao lado de `/entrar` e
 * `/onboarding`, que têm o mesmo problema e a mesma solução.
 *
 * O que não se salta é a REVISÃO: ela acontece, só não pára para perguntar.
 * `preparePlan` propõe a ideia e os textos e `generateArtwork` gera a
 * seguir, no mesmo clique. Quem quiser decidir antes de gerar abre a arte
 * no editor e gera outra vez de lá — é a mesma publicação, com o mesmo
 * identificador.
 *
 * A marca é GRAVADA antes de gerar, e não mantida em memória. Três razões:
 * o projecto guarda `brandId` e um projecto a apontar para uma marca que
 * não existe não abre no editor; a arte é um ficheiro que tem de ficar na
 * conta de alguém; e a segunda arte deste cliente passa a ser ainda mais
 * rápida, porque os campos vêm preenchidos.
 * ──────────────────────────────────────────────────────────────────────────
 */

/** Um pedido curto de mais não dá uma ideia; vale dizê-lo antes de gerar. */
const MIN_BRIEF = 12;

export function InstantScreen({
  account,
  brand,
  onSaveBrand,
}: {
  account: Account;
  brand: Brand;
  /** Grava a marca na sessão e devolve-a como ficou gravada. */
  onSaveBrand: (next: Brand) => Promise<Brand>;
}) {
  const router = useRouter();
  const { show } = useToast();

  const startDraft = useEditor((state) => state.startDraft);
  const setBrief = useEditor((state) => state.setBrief);
  const setFormatInStore = useEditor((state) => state.setFormat);
  const setStyleInStore = useEditor((state) => state.setStyle);
  const preparePlan = useEditor((state) => state.preparePlan);
  const generateArtwork = useEditor((state) => state.generateArtwork);
  const exportArt = useEditor((state) => state.exportArt);
  const saveNow = useEditor((state) => state.saveNow);
  const project = useEditor((state) => state.project);
  const editorBrand = useEditor((state) => state.brand);
  const assets = useEditor((state) => state.assets);
  const phase = useEditor((state) => state.phase);
  const exporting = useEditor((state) => state.exporting);
  const notice = useEditor((state) => state.notice);

  const [input, setInput] = React.useState<InstantBrandInput>(() => instantInputFrom(brand));
  const [brief, setBriefText] = React.useState('');
  const [format, setFormat] = React.useState<FormatId>('vertical');
  const [style, setStyle] = React.useState<StyleId>('auto');
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);

  const problems = instantProblems(input);
  const briefShort = brief.trim().length < MIN_BRIEF;
  const blocked = problems.length > 0 || briefShort;

  const finishInput = React.useMemo(
    () =>
      done && project && editorBrand
        ? finishInputFrom(project.composition, editorBrand, assets)
        : null,
    [done, project, editorBrand, assets],
  );
  const painted = usePaintedArt(finishInput);

  /**
   * Os ficheiros da marca, no editor, ANTES de gerar.
   *
   * `startDraft` manda-os resolver e não espera. No editor isso não se nota
   * — entre abrir o ecrã e carregar em gerar passam minutos —, mas aqui as
   * duas coisas acontecem no mesmo clique, e uma arte gerada antes de o
   * logótipo estar resolvido sai sem logótipo nenhum.
   */
  async function ensureBrandAssets(next: Brand) {
    const ids = [
      next.identity.logoAssetId,
      next.identity.logoForLightBgAssetId,
      next.identity.logoForDarkBgAssetId,
    ].filter((id): id is string => Boolean(id));
    if (ids.length === 0) return;
    const resolved = await resolveAssets(ids);
    if (Object.keys(resolved).length === 0) return;
    useEditor.setState((state) => ({ assets: { ...state.assets, ...resolved } }));
  }

  async function generate() {
    if (blocked || working) return;
    setWorking(true);
    setError(null);
    try {
      const saved = await onSaveBrand(applyInstantInput(brand, input));

      startDraft(account.id, saved);
      await ensureBrandAssets(saved);
      setBrief(brief.trim());
      setFormatInStore(format);
      setStyleInStore(style);

      const planned = await preparePlan();
      if (!planned.ok) {
        throw new Error(planned.errors?.[0] ?? 'Não foi possível preparar a ideia.');
      }

      const made = await generateArtwork();
      if (!made.ok) {
        throw new Error(made.errors?.[0] ?? 'Não foi possível gerar a arte.');
      }

      setDone(true);
      show({ tone: 'sucesso', message: made.notice ?? 'Arte gerada.' });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Não foi possível gerar a arte. Tenta de novo.',
      );
    } finally {
      setWorking(false);
    }
  }

  /** Abre a arte no editor, onde há revisão, edição por zonas e versões. */
  async function openInEditor() {
    const projectId = project?.id;
    if (!projectId) return;
    setLeaving(true);
    try {
      // O rascunho tem de estar gravado: o editor lê-o do armazenamento.
      await saveNow();
      router.push(`/editor/${projectId}`);
    } catch {
      setLeaving(false);
      show({ tone: 'erro', message: 'Não foi possível abrir o editor.' });
    }
  }

  return (
    <div className="isolate flex min-h-dvh flex-col bg-ink-950">
      {/* O mesmo campo de pontos do cadastro e da primeira dobra. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <SonarGrid
          className="size-full"
          interactive={false}
          pingArea={[0.08, 0.12, 0.92, 0.88]}
          baseOpacity={0.18}
          dotRadius={1.5}
          pingEvery={3.4}
        />
        <span className="sonar-wash absolute inset-0" />
      </div>

      <header className="relative flex h-12 shrink-0 items-center gap-3 px-4 sm:px-6">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-line to-transparent"
        />
        <Logo variant="wordmark" height={18} />
        <span aria-hidden className="text-fg-faint">
          /
        </span>
        <p className="text-[12.5px] text-fg">Arte instantânea</p>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/inicio"
            className="rounded-[8px] px-2 py-1 text-[12.5px] text-fg-muted transition-colors hover:text-fg"
          >
            Ir para o painel
          </Link>
        </div>
      </header>

      <main id="conteudo" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {done ? (
          <Result
            painted={painted}
            format={getFormat(project?.composition.format ?? format)}
            notice={notice}
            exporting={exporting}
            leaving={leaving}
            onExport={() => void exportArt()}
            onEdit={() => void openInEditor()}
            onAgain={() => {
              setDone(false);
              setBriefText('');
              setError(null);
            }}
          />
        ) : (
          <>
            <header className="mb-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-faint">
                Sem cadastro · uma arte agora
              </p>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-fg sm:text-[1.75rem]">
                Faz a tua arte na hora
              </h1>
              <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-fg-muted">
                Diz o nome da empresa, junta o logótipo e as cores, escreve o que queres
                comunicar. A Kriar propõe a ideia e gera a publicação no mesmo passo.
              </p>
            </header>

            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
              <Card className="bg-ink-900/70 p-5 backdrop-blur-sm">
                <div className="mb-4 flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-[9px] bg-neon/12 text-neon ring-1 ring-neon/30">
                    <Gem className="size-3.5" aria-hidden />
                  </span>
                  <h2 className="text-[15px] font-semibold text-fg">A tua marca</h2>
                </div>

                <div className="flex flex-col gap-4">
                  <Field label="Nome da empresa" htmlFor="instantanea-nome">
                    <Input
                      id="instantanea-nome"
                      value={input.name}
                      maxLength={80}
                      autoComplete="organization"
                      placeholder="Ex.: Perfumaria Kianda"
                      onChange={(event) =>
                        setInput((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </Field>

                  <div>
                    <p className="mb-1.5 text-[13px] font-medium text-fg">
                      Logótipo{' '}
                      <span className="text-[11px] font-normal text-fg-faint">opcional</span>
                    </p>
                    <LogoUploader
                      accountId={account.id}
                      assetId={input.logoAssetId}
                      kind="logo"
                      title="Logótipo da empresa"
                      hint="PNG com fundo transparente dá o melhor resultado"
                      onChange={(logoAssetId) =>
                        setInput((current) => ({ ...current, logoAssetId }))
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <ColorField
                      label="Cor principal"
                      id="instantanea-cor-1"
                      value={input.colors.primary}
                      onChange={(primary) =>
                        setInput((current) => ({
                          ...current,
                          colors: { ...current.colors, primary },
                        }))
                      }
                    />
                    <ColorField
                      label="Cor secundária"
                      id="instantanea-cor-2"
                      value={input.colors.secondary}
                      onChange={(secondary) =>
                        setInput((current) => ({
                          ...current,
                          colors: { ...current.colors, secondary },
                        }))
                      }
                    />
                  </div>

                  <div>
                    <ColorField
                      label="Cor de realce"
                      id="instantanea-cor-3"
                      optional
                      value={input.colors.accent}
                      onChange={(accent) =>
                        setInput((current) => ({
                          ...current,
                          colors: { ...current.colors, accent },
                        }))
                      }
                      onClear={() =>
                        setInput((current) => ({
                          ...current,
                          colors: { ...current.colors, accent: null },
                        }))
                      }
                    />
                    {!input.colors.accent ? (
                      <button
                        type="button"
                        onClick={() =>
                          setInput((current) => ({
                            ...current,
                            colors: {
                              ...current.colors,
                              accent: deriveAccent(
                                current.colors.primary,
                                current.colors.secondary,
                              ),
                            },
                          }))
                        }
                        className="mt-1.5 text-[12px] text-neon underline-offset-4 hover:underline"
                      >
                        Propor uma a partir das duas
                      </button>
                    ) : null}
                  </div>

                  <Field
                    label="Website"
                    optional
                    htmlFor="instantanea-website"
                    hint="Entra na arte como contacto. Podes tirá-lo depois."
                  >
                    <Input
                      id="instantanea-website"
                      value={input.website}
                      maxLength={120}
                      inputMode="url"
                      placeholder="www.aminhaempresa.ao"
                      onChange={(event) =>
                        setInput((current) => ({ ...current, website: event.target.value }))
                      }
                    />
                  </Field>
                </div>
              </Card>

              <Card className="bg-ink-900/70 p-5 backdrop-blur-sm">
                <div className="mb-4 flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-[9px] bg-neon/12 text-neon ring-1 ring-neon/30">
                    <Pencil className="size-3.5" aria-hidden />
                  </span>
                  <h2 className="text-[15px] font-semibold text-fg">O que queres comunicar</h2>
                </div>

                <div className="flex flex-col gap-4">
                  <Field
                    label="Descreve a publicação"
                    htmlFor="instantanea-pedido"
                    hint="Como a explicarias a um designer. Diz o produto, o preço e a ocasião, se houver."
                  >
                    <Textarea
                      id="instantanea-pedido"
                      value={brief}
                      maxLength={1200}
                      onChange={(event) => setBriefText(event.target.value)}
                      placeholder="Ex.: promoção de fim de semana nos difusores de ambiente a 7.500 Kz, com entrega em Luanda"
                      className="min-h-32"
                    />
                  </Field>

                  <Field label="Formato" htmlFor="instantanea-formato">
                    <Select
                      id="instantanea-formato"
                      value={format}
                      onChange={(event) => setFormat(event.target.value as FormatId)}
                    >
                      {FORMATS.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.platform} · {entry.hint}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <div className="flex flex-col gap-1.5">
                    <p className="text-[13px] font-medium text-fg" aria-hidden>
                      Estilo
                    </p>
                    <Segmented<StyleId>
                      label="Estilo visual da arte"
                      value={style}
                      onChange={setStyle}
                      columns={3}
                      options={STYLES.map((entry) => ({ value: entry.id, label: entry.label }))}
                    />
                    <p className="text-[12px] leading-relaxed text-fg-faint">
                      {getStyle(style).hint}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {error ? (
              <Callout tone="danger" className="mt-5">
                {error}
              </Callout>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
              <Button
                variant="primary"
                size="lg"
                loading={working}
                disabled={blocked}
                onClick={() => void generate()}
                className={blocked || working ? undefined : 'glow-neon'}
              >
                <Sparkles className="size-4" aria-hidden />
                Gerar a minha arte
              </Button>

              <p className="min-w-48 flex-1 text-[12px] leading-relaxed text-fg-muted">
                {problems.length > 0
                  ? problems[0]
                  : briefShort
                    ? 'Escreve o que queres comunicar — umas palavras chegam.'
                    : 'Leva cerca de dois minutos. A arte é verificada antes de ta mostrarmos.'}
              </p>

              <Link
                href="/onboarding"
                className="text-[12.5px] text-fg-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
              >
                Prefiro fazer o cadastro completo
              </Link>
            </div>

            <Callout tone="info" className="mt-5">
              Isto guarda a empresa e as cores na tua conta, para a próxima arte não as pedir
              outra vez. A identidade completa — tipografia, regras de composição e referências —
              fica a aguardar na área <strong>Marca</strong>, e é ela que mantém as publicações
              coerentes entre si.
            </Callout>
          </>
        )}
      </main>

      {phase ? <StageLoader phase={phase} /> : null}
    </div>
  );
}

/** A arte gerada, e o que se pode fazer com ela. */
function Result({
  painted,
  format,
  notice,
  exporting,
  leaving,
  onExport,
  onEdit,
  onAgain,
}: {
  painted: { url: string | null; painting: boolean; problem: string | null };
  format: FormatSpec;
  notice: string | null;
  exporting: boolean;
  leaving: boolean;
  onExport: () => void;
  onEdit: () => void;
  onAgain: () => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <Badge tone="neon">arte pronta</Badge>
      <h1 className="mt-3 text-center text-2xl font-semibold tracking-tight text-fg sm:text-[1.75rem]">
        A tua arte está pronta
      </h1>
      <p className="mt-1.5 max-w-xl text-center text-[13.5px] leading-relaxed text-fg-muted">
        Descarrega-a já, ou abre-a no editor para mudar o título, o sítio do logótipo e os
        contactos — e gerar outra versão.
      </p>

      <div className="mt-6 w-full max-w-[26rem]">
        <div className="relative overflow-hidden rounded-[14px] bg-ink-900 shadow-[0_36px_90px_-36px_rgba(0,0,0,0.95)] ring-1 ring-line-strong">
          {painted.url ? (
            <img
              src={painted.url}
              alt="A arte gerada para a tua publicação."
              className="block w-full"
            />
          ) : (
            /*
              A moldura reserva o lugar com a proporção do FORMATO escolhido,
              não com um 4:5 fixo: num story, a imagem a aparecer empurrava
              os botões meio ecrã para baixo.
            */
            <div
              className="grid place-items-center"
              style={{ aspectRatio: `${format.width} / ${format.height}` }}
            >
              <Spinner label="A compor o acabamento…" />
            </div>
          )}
        </div>
      </div>

      {painted.problem ? (
        <Callout tone="warn" className="mt-4 w-full max-w-[34rem]" role="status">
          {painted.problem}
        </Callout>
      ) : null}

      {/* O que a verificação ainda encontrou: fica à vista, sem desaparecer sozinho. */}
      {notice ? (
        <Callout tone="warn" className="mt-4 w-full max-w-[34rem]" role="status">
          {notice}
        </Callout>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        <Button variant="primary" size="lg" loading={exporting} onClick={onExport}>
          <Download className="size-4" aria-hidden />
          Descarregar PNG
        </Button>
        <Button variant="outline" size="lg" loading={leaving} onClick={onEdit}>
          Abrir no editor
          <ArrowRight className="size-4" aria-hidden />
        </Button>
        <Button variant="ghost" size="lg" onClick={onAgain}>
          <RefreshCw className="size-4" aria-hidden />
          Fazer outra
        </Button>
      </div>
    </div>
  );
}
