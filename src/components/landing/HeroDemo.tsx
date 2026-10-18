'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  Check,
  ChevronDown,
  Download,
  ImagePlus,
  Loader2,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Sparkles,
  Star,
  Wand2,
} from 'lucide-react';
import { getFormat } from '@/lib/domain/catalog';
import { DEMO_BRAND, HERO_SCRIPT } from '@/lib/landing/content';
import type { DemoEntry, DemoMode } from '@/lib/landing/demos';
import { cn } from '@/lib/utils/cn';
import { Logo } from '@/components/ui/Logo';
import { Blueprint } from './Blueprint';
import { KIANDA_SWATCHES, KiandaBottle, KiandaLogo, Swatch } from './KiandaArt';

/**
 * A demonstração do topo: o sistema a trabalhar, em cinco passos.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Não é um vídeo: é a interface da Kriar desenhada em React, com as mesmas
 * superfícies, os mesmos rótulos e as mesmas frases do editor e da revisão
 * — "Vamos criar?", "Rever publicação", "Nada é gerado até confirmares.",
 * "Editado por ti. Não volta a ser reescrito.". Quem a vê aqui reconhece o
 * ecrã depois de entrar.
 *
 *  1. o pedido é escrito;
 *  2. entram a fotografia do produto e as cores da empresa;
 *  3. a Kriar apresenta os textos e a ideia para rever;
 *  4. o título proposto é substituído pelo do cliente, letra a letra;
 *  5. a arte final aparece, grande.
 *
 * O RELÓGIO é um só: um tempo decorrido que só avança enquanto a
 * demonstração está visível, o separador está à frente e ninguém a pausou.
 * Tudo o que se vê é uma função desse tempo (`frameAt`), e o estado só muda
 * quando o fotograma muda — durante as pausas do guião não há renderizações.
 * O resto do movimento é CSS (opacidade e transformações), sem bibliotecas.
 *
 * Com menos movimento pedido pelo sistema, mostra o estado final parado e a
 * lista dos cinco passos.
 *
 * A arte do passo 5 vem do manifesto (`DEMO_SELECTION.hero`). Enquanto não
 * existir, o lugar mostra o esboço técnico — nunca uma arte desenhada à mão
 * a fazer de resultado.
 * ──────────────────────────────────────────────────────────────────────────
 */

const REQUEST = HERO_SCRIPT.request;
const EDITED = HERO_SCRIPT.headline;

/** Milissegundos por letra: o pedido escreve-se mais depressa do que a correcção. */
const TYPE_MS = 46;
const EDIT_MS = 62;

/** Marcos do guião, em milissegundos desde o início de cada volta. */
const AT = (() => {
  const typeStart = 700;
  const typeEnd = typeStart + REQUEST.length * TYPE_MS;
  const product = typeEnd + 450;
  const colors = product + 650;
  const press1 = colors + 1100;
  const planning = press1 + 260;
  const review = planning + 1100;
  const select = review + 2300;
  const editStart = select + 520;
  const editEnd = editStart + EDITED.length * EDIT_MS;
  const locked = editEnd + 160;
  const press2 = locked + 1050;
  const generating = press2 + 260;
  const art = generating + 2300;
  const leave = art + 5400;
  const loop = leave + 520;
  return {
    typeStart,
    typeEnd,
    product,
    colors,
    press1,
    planning,
    review,
    select,
    editStart,
    editEnd,
    locked,
    press2,
    generating,
    art,
    leave,
    loop,
  };
})();

/**
 * Os cinco passos: onde começam e o instante que os representa (para onde
 * salta quem carrega no passo).
 */
const STEPS = [
  {
    label: 'Pedido',
    from: 0,
    show: AT.typeEnd + 120,
    text: `«${REQUEST}»`,
  },
  {
    label: 'Produto e cores',
    from: AT.product,
    show: AT.press1 - 240,
    text: 'Entram a fotografia do frasco e as cores da marca.',
  },
  {
    label: 'Proposta',
    from: AT.planning,
    show: AT.review + 900,
    text: 'A Kriar apresenta os textos e a ideia para rever.',
  },
  {
    label: 'Edição',
    from: AT.select,
    show: AT.locked + 300,
    text: `O título passa a «${EDITED}».`,
  },
  {
    label: 'Arte final',
    from: AT.press2,
    show: AT.art + 900,
    text: 'A arte é gerada, verificada e fica pronta a descarregar.',
  },
] as const;

const stepEnd = (index: number) => STEPS[index + 1]?.from ?? AT.loop;

/** Os passos reais do indicador de geração (`StageLoader.tsx`). */
const GENERATION_STEPS = [
  'A preparar os produtos e a marca',
  'A gerar a publicação',
  'A verificar o logótipo e as margens',
  'A guardar a arte',
];

type Stage = 'vazio' | 'a-preparar' | 'revisao' | 'a-gerar' | 'arte';
type TitleState = 'proposto' | 'seleccionado' | 'a-escrever' | 'editado';

type Frame = {
  step: number;
  requestChars: number;
  product: boolean;
  colors: boolean;
  press: 'preparar' | 'gerar' | null;
  stage: Stage;
  title: TitleState;
  titleChars: number;
  generationStep: number;
  leaving: boolean;
  /**
   * Quanto do passo activo já tinha passado quando ele começou a ser
   * mostrado. Só muda ao mudar de passo ou ao saltar: é o atraso negativo da
   * barra de progresso, e mexer-lhe a meio fazia a barra saltar.
   */
  fillOffset: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function frameAt(t: number): Omit<Frame, 'fillOffset'> {
  let step = 0;
  STEPS.forEach((entry, index) => {
    if (t >= entry.from) step = index;
  });
  const stage: Stage =
    t >= AT.art
      ? 'arte'
      : t >= AT.generating
        ? 'a-gerar'
        : t >= AT.review
          ? 'revisao'
          : t >= AT.planning
            ? 'a-preparar'
            : 'vazio';
  const title: TitleState =
    t >= AT.locked ? 'editado' : t >= AT.editStart ? 'a-escrever' : t >= AT.select ? 'seleccionado' : 'proposto';
  const press =
    t >= AT.press1 && t < AT.planning + 120
      ? 'preparar'
      : t >= AT.press2 && t < AT.generating + 120
        ? 'gerar'
        : null;

  return {
    step,
    requestChars: clamp(Math.floor((t - AT.typeStart) / TYPE_MS), 0, REQUEST.length),
    product: t >= AT.product,
    colors: t >= AT.colors,
    press,
    stage,
    title,
    titleChars: clamp(Math.floor((t - AT.editStart) / EDIT_MS), 0, EDITED.length),
    generationStep: clamp(Math.floor((t - AT.generating) / 560), 0, GENERATION_STEPS.length - 1),
    leaving: t >= AT.leave,
  };
}

function sameFrame(a: Omit<Frame, 'fillOffset'>, b: Omit<Frame, 'fillOffset'>): boolean {
  return (
    a.step === b.step &&
    a.requestChars === b.requestChars &&
    a.product === b.product &&
    a.colors === b.colors &&
    a.press === b.press &&
    a.stage === b.stage &&
    a.title === b.title &&
    a.titleChars === b.titleChars &&
    a.generationStep === b.generationStep &&
    a.leaving === b.leaving
  );
}

const INITIAL: Frame = { ...frameAt(0), fillOffset: 0 };
/** O estado final, para quem pede menos movimento. */
const FINAL: Frame = { ...frameAt(AT.art + 1200), fillOffset: 0 };

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

function useReducedMotion(): boolean {
  return React.useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_QUERY);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(REDUCED_QUERY).matches,
    // No servidor não se sabe: renderiza-se o início do guião, que é também
    // um ecrã com sentido para quem não tem JavaScript.
    () => false,
  );
}

export function HeroDemo({ art, mode }: { art: DemoEntry; mode: DemoMode }) {
  const reduced = useReducedMotion();
  const rootRef = React.useRef<HTMLElement>(null);
  const elapsed = React.useRef(0);

  const [frame, setFrame] = React.useState<Frame>(INITIAL);
  const [inView, setInView] = React.useState(false);
  const [tabHidden, setTabHidden] = React.useState(false);
  const [userPaused, setUserPaused] = React.useState(false);
  /** Muda a cada volta e a cada salto, para a barra do passo recomeçar. */
  const [epoch, setEpoch] = React.useState(0);

  const playing = !reduced && inView && !tabHidden && !userPaused;

  React.useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  React.useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      // Um intervalo atrasado (separador em segundo plano, máquina ocupada)
      // não pode saltar meio guião de uma vez.
      elapsed.current += Math.min(now - last, 120);
      last = now;

      let looped = false;
      if (elapsed.current >= AT.loop) {
        elapsed.current = 0;
        looped = true;
      }
      const t = elapsed.current;
      const next = frameAt(t);
      if (looped) setEpoch((value) => value + 1);
      setFrame((previous) => {
        if (!looped && sameFrame(previous, next)) return previous;
        const fillOffset =
          looped || next.step !== previous.step ? t - STEPS[next.step].from : previous.fillOffset;
        return { ...next, fillOffset };
      });
    }, 50);
    return () => window.clearInterval(timer);
  }, [playing]);

  const seek = React.useCallback((index: number) => {
    const target = STEPS[index];
    if (!target) return;
    elapsed.current = target.show;
    setFrame({ ...frameAt(target.show), fillOffset: target.show - target.from });
    setEpoch((value) => value + 1);
  }, []);

  const shown = reduced ? FINAL : frame;
  const paused = !playing;

  return (
    <figure
      ref={rootRef}
      aria-labelledby="demo-legenda"
      data-paused={paused ? '' : undefined}
      // O passo e a etapa à vista, legíveis de fora: servem os testes e
      // quem inspeccionar a página sem ter de interpretar classes.
      data-step={shown.step + 1}
      data-stage={shown.stage}
      className="lp-demo @container relative w-full"
    >
      {/* Brilho discreto por trás da janela: dá profundidade sem efeitos pesados. */}
      <span aria-hidden className="lp-demo-glow pointer-events-none absolute -inset-x-10 -inset-y-12 -z-10" />

      <div
        aria-hidden
        inert
        className={cn(
          // Opaca, como os painéis da aplicação: com transparência, os pulsos
          // do campo de pontos atravessavam a interface e sujavam a leitura.
          'lp-edge relative overflow-hidden rounded-[18px] bg-ink-900 shadow-[0_50px_120px_-40px_rgba(0,0,0,0.95)] ring-1 ring-line-strong transition-opacity duration-500',
          shown.leaving && 'opacity-0',
        )}
      >
        <TopBar />
        <MobileTabs stage={shown.stage} />

        <div className="relative grid h-[30rem] @xl:h-[32.5rem] @xl:grid-cols-[minmax(0,0.84fr)_minmax(0,1fr)]">
          <div
            className={cn(
              'min-h-0 transition-opacity duration-700',
              shown.stage === 'vazio' ? 'block' : 'hidden @xl:block',
              shown.stage === 'arte' && '@xl:opacity-45',
            )}
          >
            <EditorPanel frame={shown} />
          </div>
          <div
            className={cn(
              'relative min-h-0 @xl:border-l @xl:border-line',
              shown.stage === 'vazio' ? 'hidden @xl:block' : 'block',
            )}
          >
            <StagePanel frame={shown} art={art} mode={mode} />
          </div>
        </div>
      </div>

      <figcaption id="demo-legenda" className="sr-only">
        Demonstração animada da Kriar com uma marca fictícia, a {DEMO_BRAND.name}. Em cinco passos:
        o pedido «{REQUEST}» é escrito; entram a fotografia do produto e as cores da empresa; a
        Kriar apresenta os textos e a ideia para rever; o título é alterado para «{EDITED}»; e a
        arte final aparece.
      </figcaption>

      {reduced ? (
        <StaticSteps />
      ) : (
        <StepRail
          step={shown.step}
          epoch={epoch}
          fillOffset={shown.fillOffset}
          userPaused={userPaused}
          onSeek={seek}
          onTogglePause={() => setUserPaused((value) => !value)}
        />
      )}
    </figure>
  );
}

// --- Moldura ------------------------------------------------------------------

function TopBar() {
  return (
    <div className="relative flex h-10 items-center gap-2 px-3.5">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-line-strong to-transparent"
      />
      <Logo variant="wordmark" height={13} />
      <span className="text-[11px] text-fg-faint">/</span>
      <span className="flex min-w-0 items-center gap-1.5 rounded-[7px] px-1 py-0.5 text-[11.5px] text-fg">
        <span className="grid size-4 shrink-0 place-items-center overflow-hidden rounded-[4px] bg-[#F4F2EE]">
          <KiandaLogo compact className="h-3.5 w-auto" />
        </span>
        <span className="truncate">{DEMO_BRAND.name}</span>
        <ChevronDown className="size-3 shrink-0 text-fg-faint" />
      </span>
      {/*
        Só com a janela larga (36rem): entre 28 e 36rem ficava "Nova public…" e
        cortava também o nome da empresa, que diz mais.
      */}
      <span className="hidden text-[11px] text-fg-faint @xl:inline">/</span>
      <span className="hidden truncate text-[11.5px] text-fg-muted @xl:inline">Nova publicação</span>

      <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line-strong bg-ink-950/70 px-2 py-0.5 text-[10px] font-medium text-fg-muted">
        <span className="size-1.5 rounded-full bg-neon" />
        {/*
          Numa janela estreita a etiqueta encurta para "Demonstração": inteira,
          deixava o nome da empresa reduzido a "Perf…". A legenda para
          leitores de ecrã diz sempre que a marca é fictícia.
        */}
        <span>
          Demonstração<span className="hidden @sm:inline"> · marca fictícia</span>
        </span>
      </span>
    </div>
  );
}

/** Os separadores do editor em ecrãs estreitos: o guião muda de um para o outro sozinho. */
function MobileTabs({ stage }: { stage: Stage }) {
  const active = stage === 'vazio' ? 'ajustes' : 'previa';
  return (
    <div className="flex @xl:hidden">
      {(
        [
          { id: 'ajustes', label: 'Ajustes' },
          { id: 'previa', label: 'Prévia' },
        ] as const
      ).map((tab) => (
        <span
          key={tab.id}
          className={cn(
            'flex-1 border-b-2 py-2 text-center text-[12px] font-medium transition-colors duration-300',
            active === tab.id ? 'border-neon text-fg' : 'border-transparent text-fg-muted',
          )}
        >
          {tab.label}
        </span>
      ))}
    </div>
  );
}

// --- Painel do pedido ---------------------------------------------------------

function EditorPanel({ frame }: { frame: Frame }) {
  const typed = REQUEST.slice(0, frame.requestChars);
  const hasText = frame.requestChars > 0;
  const writing = frame.stage === 'vazio' && frame.requestChars < REQUEST.length;
  const proposed = frame.stage !== 'vazio' && frame.stage !== 'a-preparar';
  const format = getFormat('vertical');

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink-900/50">
      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-hidden px-4 pb-2 pt-4">
        <p className="text-[1.1rem] font-semibold leading-none tracking-tight text-fg">Vamos criar?</p>

        <div>
          <p className="mb-1.5 text-[11px] font-medium text-fg">O que queres comunicar?</p>
          <div
            className={cn(
              'relative min-h-[5.4rem] rounded-[10px] bg-ink-950/70 px-2.5 pb-5 pt-2 text-[11.5px] leading-relaxed ring-1 transition-shadow duration-300',
              writing && hasText ? 'ring-neon/35' : 'ring-line',
            )}
          >
            {/* Como num campo verdadeiro: sem texto, o cursor fica antes do exemplo. */}
            {hasText ? (
              <>
                <span className="text-fg">{typed}</span>
                {frame.stage === 'vazio' ? <Caret /> : null}
              </>
            ) : (
              <>
                <Caret />
                <span className="text-fg-faint">Ex.: Quero anunciar estes perfumes por 15.000 Kz…</span>
              </>
            )}
            <span className="absolute bottom-1.5 right-2.5 text-[9.5px] tabular-nums text-fg-faint">
              {frame.requestChars}/500
            </span>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-medium text-fg">Anexos</p>
          {frame.product ? (
            <div className="lp-pop-in flex gap-2 rounded-[10px] border border-neon/40 bg-ink-950/60 p-1.5">
              <span className="bg-checker relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-[7px] ring-1 ring-line">
                <KiandaBottle variant="alto" uid="hero-anexo" className="h-[92%] w-auto" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                <span className="flex items-center gap-1">
                  <span className="flex h-5 min-w-0 flex-1 items-center justify-between rounded-[6px] bg-ink-900/70 px-1.5 text-[10px] font-medium text-fg-muted ring-1 ring-line">
                    <span className="truncate">Foto ou produto</span>
                    <ChevronDown className="size-3 shrink-0 text-fg-faint" />
                  </span>
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-neon/15 text-neon ring-1 ring-neon/40">
                    <Star className="size-2.5 fill-current" />
                  </span>
                </span>
                <span className="truncate rounded-[6px] bg-ink-900/70 px-1.5 py-[3px] text-[10px] text-fg-faint">
                  O que queres com esta foto? (opcional)
                </span>
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-line-strong py-2.5 text-[10.5px] font-medium text-fg-muted">
              <ImagePlus className="size-3" />
              Anexar fotografias
            </div>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-fg">Cores da publicação</p>
            {frame.colors ? (
              <span className="lp-pop-in inline-flex items-center gap-1 rounded-full bg-ink-800 px-1.5 py-0.5 text-[9.5px] text-fg-muted">
                <Sparkles className="size-2.5" />
                Cores da marca
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {KIANDA_SWATCHES.map((color, index) =>
              frame.colors ? (
                <Swatch
                  key={color}
                  color={color}
                  className="lp-swatch-in size-7"
                  style={{ animationDelay: `${index * 110}ms` }}
                />
              ) : (
                <span key={color} className="size-7 rounded-full border border-dashed border-line-strong" />
              ),
            )}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-medium text-fg">Formato</p>
          {/*
            Sem o ícone de recorte do campo verdadeiro: no painel desta janela
            (cerca de 270 px nos ecrãs largos) ele empurrava "Instagram e
            Facebook" para "Instagram e Fac…". O nome inteiro diz mais do que
            o ícone.
          */}
          <div className="flex h-8 items-center gap-1.5 rounded-[10px] bg-ink-950/70 px-2.5 text-[11px] text-fg ring-1 ring-line">
            {/* A medida nunca é cortada: é a parte que o cliente confirma. */}
            <span className="min-w-0 flex-1 truncate">{format.platform}</span>
            <span className="shrink-0 tabular-nums text-fg-muted">{format.hint}</span>
            <ChevronDown className="size-3 shrink-0 text-fg-muted" />
          </div>
        </div>

        <p className="flex items-center justify-between px-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-faint">
          Logótipo e contactos
          <span className="text-[12px] leading-none">+</span>
        </p>
      </div>

      <div className="shrink-0 px-4 pb-3.5 pt-1">
        <span
          className={cn(
            'flex h-10 items-center justify-center gap-2 rounded-[11px] text-[12.5px] font-semibold transition-all duration-200',
            hasText ? 'bg-neon text-ink-950' : 'bg-neon/25 text-ink-950/50',
            hasText && frame.press !== 'preparar' && 'glow-neon',
            frame.press === 'preparar' && 'lp-press',
          )}
        >
          <Wand2 className="size-3.5" />
          {proposed ? 'Actualizar proposta' : 'Preparar proposta'}
        </span>
        <p className="mt-1.5 text-center text-[9.5px] leading-relaxed text-fg-faint">
          {proposed
            ? 'Os textos que editaste à mão ficam como estão.'
            : 'Revês tudo antes de a arte ser gerada.'}
        </p>
      </div>
    </div>
  );
}

function Caret() {
  return <span className="lp-caret ml-px inline-block h-[1.05em] w-px translate-y-[0.18em] bg-neon" />;
}

// --- Palco ----------------------------------------------------------------------

function Layer({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'absolute inset-0 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
        show ? 'opacity-100' : 'pointer-events-none translate-y-1.5 opacity-0',
      )}
    >
      {children}
    </div>
  );
}

function StagePanel({ frame, art, mode }: { frame: Frame; art: DemoEntry; mode: DemoMode }) {
  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <span aria-hidden className="lp-dots pointer-events-none absolute inset-0" />

      <Layer show={frame.stage === 'vazio'}>
        <div className="grid h-full place-items-center p-5">
          <div className="lp-edge w-full max-w-[15.5rem] rounded-[14px] bg-ink-900/85 px-5 py-5 text-center ring-1 ring-line">
            <span className="mx-auto mb-3 grid size-9 place-items-center rounded-[11px] bg-ink-800 text-fg-faint ring-1 ring-line">
              <Wand2 className="size-4" />
            </span>
            <p className="text-[12.5px] font-semibold text-fg">A proposta aparece aqui</p>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-fg-muted">
              Descreve o que queres comunicar no painel ao lado. Podes ajustar tudo antes de gerar a
              arte.
            </p>
          </div>
        </div>
      </Layer>

      <Layer show={frame.stage === 'a-preparar'}>
        <LoaderCard title="A preparar a proposta" steps={['A ler o teu pedido']} current={0} />
      </Layer>

      <Layer show={frame.stage === 'revisao'}>
        <ReviewMock frame={frame} />
      </Layer>

      <Layer show={frame.stage === 'a-gerar'}>
        <LoaderCard title="A gerar a tua arte" steps={GENERATION_STEPS} current={frame.generationStep} />
      </Layer>

      <Layer show={frame.stage === 'arte'}>
        <FinalArt art={art} mode={mode} visible={frame.stage === 'arte'} />
      </Layer>
    </div>
  );
}

function LoaderCard({ title, steps, current }: { title: string; steps: string[]; current: number }) {
  return (
    <div className="grid h-full place-items-center p-5">
      <div className="lp-edge w-full max-w-[15.5rem] rounded-[14px] bg-ink-900/85 p-4 ring-1 ring-line">
        <span className="mx-auto mb-3 grid size-9 animate-[kriar-pulse-soft_1.2s_ease-in-out_infinite] place-items-center rounded-[11px] bg-neon/12 text-neon ring-1 ring-neon/30">
          <Sparkles className="size-4" />
        </span>
        <p className="text-center text-[12.5px] font-semibold text-fg">{title}</p>
        <ol className="mt-3 flex flex-col gap-1.5">
          {steps.map((step, index) => (
            <li
              key={step}
              className={cn(
                'flex items-center gap-2 text-[10.5px] leading-snug transition-colors duration-300',
                index < current ? 'text-fg-muted' : index === current ? 'text-fg' : 'text-fg-faint',
              )}
            >
              <span className="grid size-3.5 shrink-0 place-items-center">
                {index < current ? (
                  <Check className="size-3 text-neon" />
                ) : index === current ? (
                  <Loader2 className="size-3 animate-[kriar-spin_0.9s_linear_infinite] text-neon" />
                ) : (
                  <span className="size-1 rounded-full bg-fg-faint" />
                )}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <span className="mt-3.5 block h-[2px] overflow-hidden rounded-full bg-neon/15">
          <span className="kriar-progress block h-full w-1/3 animate-[kriar-slide_1.1s_ease-in-out_infinite] rounded-full bg-neon" />
        </span>
      </div>
    </div>
  );
}

function ReviewMock({ frame }: { frame: Frame }) {
  const editing = frame.title === 'a-escrever';
  const selected = frame.title === 'seleccionado';
  const locked = frame.title === 'editado';
  const title =
    frame.title === 'proposto' || selected ? HERO_SCRIPT.proposedHeadline : EDITED.slice(0, frame.titleChars);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden px-3.5 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold leading-tight tracking-tight text-fg">Rever publicação</p>
            <p className="mt-0.5 text-[10.5px] text-fg-muted">Nada é gerado até confirmares.</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-neon/40 bg-neon/10 px-2 py-0.5 text-[10px] font-medium text-neon">
            <Check className="size-2.5" />
            Pronto a gerar
          </span>
        </div>

        <div className="relative mt-3 overflow-hidden rounded-[12px] border border-neon/25 bg-ink-900/75 p-2.5">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon/40 to-transparent"
          />
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-fg">
            <Sparkles className="size-3 text-neon" />A ideia para esta publicação
          </p>
          <div className="mt-2 flex gap-2.5">
            <div className="w-[3.25rem] shrink-0 overflow-hidden rounded-[4px] ring-1 ring-line-strong">
              <Blueprint annotations={false} titleLines={2} contacts={1} />
            </div>
            <p className="min-w-0 text-[11px] leading-snug text-fg">{HERO_SCRIPT.idea}</p>
          </div>
        </div>

        <div className="mt-2.5 rounded-[12px] border border-line bg-ink-900/60 p-2.5">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-fg">
            <span className="grid size-4 place-items-center rounded-full bg-ink-800 text-[9px] font-semibold text-fg-muted ring-1 ring-line">
              1
            </span>
            Textos da publicação
          </p>

          <MockField
            label="Título"
            value={title}
            focused={selected || editing}
            selected={selected}
            caret={editing}
            locked={locked}
          />
          <p
            className={cn(
              'overflow-hidden text-[9.5px] text-fg-faint transition-all duration-300',
              locked ? 'mt-1 max-h-4 opacity-100' : 'max-h-0 opacity-0',
            )}
          >
            Editado por ti. Não volta a ser reescrito.
          </p>
          <MockField label="Texto de apoio" value={HERO_SCRIPT.subheadline} className="mt-2" />
          <MockField label="Chamada para acção" value={HERO_SCRIPT.cta} className="mt-2" />
        </div>
      </div>

      <div className="relative flex shrink-0 items-center justify-between gap-2 bg-ink-950/80 px-3.5 py-2.5">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-line to-transparent"
        />
        <p className="min-w-0 text-[9.5px] leading-snug text-fg-faint">
          A arte é gerada por IA a partir destes dados.
        </p>
        <span
          className={cn(
            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] bg-neon px-3 text-[11.5px] font-semibold text-ink-950',
            frame.press === 'gerar' ? 'lp-press' : 'glow-neon',
          )}
        >
          <Sparkles className="size-3" />
          Gerar arte
        </span>
      </div>
    </div>
  );
}

function MockField({
  label,
  value,
  focused = false,
  selected = false,
  caret = false,
  locked = false,
  className,
}: {
  label: string;
  value: string;
  focused?: boolean;
  selected?: boolean;
  caret?: boolean;
  locked?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-1 text-[10px] font-medium text-fg-muted">{label}</p>
      <div
        className={cn(
          'relative flex h-7 items-center rounded-[8px] border bg-ink-950/70 pl-2 pr-7 text-[11px] transition-colors duration-200',
          focused ? 'border-neon/60' : 'border-line',
        )}
      >
        {/* `pre` e não `nowrap`: o espaço acabado de escrever não pode desaparecer. */}
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-pre text-fg">
          <span className={cn(selected && 'rounded-[2px] bg-neon/28')}>{value}</span>
          {caret ? <Caret /> : null}
        </span>
        <Pencil
          className={cn(
            'absolute right-2 top-1/2 size-3 -translate-y-1/2 transition-colors duration-300',
            locked ? 'text-neon' : 'text-fg-faint',
          )}
        />
      </div>
    </div>
  );
}

function FinalArt({ art, mode, visible }: { art: DemoEntry; mode: DemoMode; visible: boolean }) {
  const ratio = art.width / art.height;
  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-2.5 p-3.5">
      {/* O contentor mede-se a si próprio: a arte ocupa o máximo que cabe, na proporção certa. */}
      <div className="grid min-h-0 w-full flex-1 place-items-center [container-type:size]">
        <div
          className={cn(
            'relative overflow-hidden rounded-[8px] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.95)] ring-1 ring-line-strong',
            visible && 'lp-art-in',
          )}
          style={{ width: `min(100cqw, calc(100cqh * ${ratio}))`, aspectRatio: `${ratio}` }}
        >
          {art.image ? (
            <Image
              src={art.image}
              alt={art.alt}
              width={art.width}
              height={art.height}
              sizes="(min-width: 1280px) 380px, (min-width: 640px) 50vw, 90vw"
              className="block size-full object-cover"
            />
          ) : (
            <Blueprint
              ratio={ratio}
              stamp={
                mode === 'development'
                  ? { title: 'Arte por gerar', detail: art.id }
                  : { title: 'Demonstração' }
              }
              formatLabel={`${art.width} × ${art.height}`}
            />
          )}
          {visible ? <span aria-hidden className="lp-sheen pointer-events-none absolute inset-0" /> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-line bg-ink-800 px-3 text-[11px] font-medium text-fg">
          <RefreshCw className="size-3" />
          Gerar outra
        </span>
        <span className="glow-neon inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-neon px-3 text-[11px] font-semibold text-ink-950">
          <Download className="size-3" />
          Descarregar PNG
        </span>
      </div>
    </div>
  );
}

// --- Passos ------------------------------------------------------------------

function StepRail({
  step,
  epoch,
  fillOffset,
  userPaused,
  onSeek,
  onTogglePause,
}: {
  step: number;
  epoch: number;
  fillOffset: number;
  userPaused: boolean;
  onSeek: (index: number) => void;
  onTogglePause: () => void;
}) {
  return (
    <div className="mt-4 flex items-start gap-3">
      <ol className="grid min-w-0 flex-1 grid-cols-5 gap-1.5 @md:gap-2">
        {STEPS.map((entry, index) => {
          const state = index < step ? 'feito' : index === step ? 'activo' : 'por-fazer';
          return (
            <li key={entry.label} className="min-w-0">
              <button
                type="button"
                onClick={() => onSeek(index)}
                aria-current={state === 'activo' ? 'step' : undefined}
                aria-label={`Passo ${index + 1} de ${STEPS.length}: ${entry.label}`}
                className="group flex w-full min-w-0 flex-col gap-2 rounded-[6px] py-1 text-left"
              >
                <span className="relative block h-[3px] overflow-hidden rounded-full bg-line-strong">
                  {state === 'feito' ? (
                    <span className="absolute inset-0 rounded-full bg-neon/70" />
                  ) : state === 'activo' ? (
                    <span
                      key={`${epoch}-${index}`}
                      className="lp-fill absolute inset-0 origin-left rounded-full bg-neon"
                      style={{
                        animationDuration: `${stepEnd(index) - entry.from}ms`,
                        animationDelay: `-${Math.max(0, fillOffset)}ms`,
                      }}
                    />
                  ) : null}
                </span>
                <span
                  className={cn(
                    'flex min-w-0 items-baseline gap-1.5 text-[11px] leading-none transition-colors',
                    state === 'activo' ? 'text-fg' : 'text-fg-faint group-hover:text-fg-muted',
                  )}
                >
                  <span className="tabular-nums">{index + 1}</span>
                  <span className={cn('truncate', state === 'activo' ? 'inline' : 'hidden @md:inline')}>
                    {entry.label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        onClick={onTogglePause}
        aria-pressed={userPaused}
        aria-label={userPaused ? 'Retomar a demonstração' : 'Pausar a demonstração'}
        title={userPaused ? 'Retomar' : 'Pausar'}
        className="grid size-8 shrink-0 place-items-center rounded-full border border-line-strong text-fg-muted transition-colors hover:border-neon/50 hover:text-neon"
      >
        {userPaused ? <Play className="size-3.5" aria-hidden /> : <Pause className="size-3.5" aria-hidden />}
      </button>
    </div>
  );
}

/** Para quem pede menos movimento: os cinco passos, por escrito, ao lado do estado final. */
function StaticSteps() {
  return (
    <ol className="mt-4 grid gap-2 @lg:grid-cols-5">
      {STEPS.map((entry, index) => (
        <li key={entry.label} className="flex gap-2 rounded-[10px] bg-ink-900/70 p-2.5 ring-1 ring-line @lg:flex-col">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-neon/12 text-[10px] font-semibold text-neon ring-1 ring-neon/30">
            {index + 1}
          </span>
          <span className="min-w-0">
            <span className="block text-[12px] font-medium text-fg">{entry.label}</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-fg-muted">{entry.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
