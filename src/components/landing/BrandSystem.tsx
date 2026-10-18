'use client';

import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import escultura from '@/escultura/escultura.webp';
import esculturaLarga from '@/escultura/escultura-larga.webp';
import esculturaTelemovel from '@/escultura/escultura-telemovel.webp';
import { CalloutMotion, type CalloutRest } from './liquid/callouts';
import { clamp, computeRect, LiquidEngine, type Anchor, type EngineOptions, type Rect } from './liquid/engine';
import { Container } from './ui';

/**
 * Segunda secção: os dados da empresa, organizados num design system.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Diz o que a Kriar faz ANTES de criar uma arte: analisa o logótipo, as
 * cores, as letras, os produtos e o tom da empresa, cria com eles um
 * sistema de design só dela e é esse sistema que envia à IA.
 *
 * A imagem é uma escultura de partículas verdes — os dados —, com cinco
 * pontos assinalados, cada um preso a uma partícula e com o nome de um
 * elemento do sistema: logótipo, cores, tipografia, componentes,
 * publicações. Ao chegar ao ecrã, as partículas juntam-se e assentam; os
 * pontos aparecem quando a escultura está montada. O cursor desfá-la em
 * dados, os pontos vão com as partículas deles e os nomes balançam atrás
 * (`liquid/callouts.ts`); tudo volta sempre ao mesmo sítio.
 *
 * Num ecrã largo, as pontas da escultura continuam até às margens: a imagem
 * deitada traz o prolongamento (`escultura-larga.webp`), feito das gotas da
 * própria escultura (`scripts/converter-escultura.mjs`). A escultura em si
 * mede-se como antes; o prolongamento fica dos lados, a sair do ecrã.
 *
 * O motor, a disposição e a escultura são os do "Sculpture Hero" de
 * guglielmogiannattasio.it (`liquid/engine.ts`); a escultura foi pintada
 * com o verde da página. Daqui saíram a barra de navegação (a página tem a
 * sua), o tema claro, as fontes do Google e a ligação de crédito visível — o
 * crédito fica no código.
 *
 * Sem WebGL2, vê-se a mesma imagem parada, com os pontos. Com menos
 * movimento pedido pelo sistema, não há montagem à entrada, o cursor mexe
 * metade e os nomes vão com os pontos, sem balanço.
 * ──────────────────────────────────────────────────────────────────────────
 */

/** O fundo da página (`ink-950`), em RGB de 0 a 1 — e o da escultura pintada. */
const BACKGROUND: [number, number, number] = [5 / 255, 7 / 255, 6 / 255];

/**
 * Os pontos assinalados.
 *
 * `u`/`v` é a partícula, em fracções da escultura sem o prolongamento
 * (conferidas a olho sobre as pérolas); `dx`/`dy` é para onde vai o nome, em
 * fracções da largura e da altura da escultura no ecrã — acima quando `dy` é
 * negativo, abaixo quando é positivo.
 */
type Callout = { u: number; v: number; dx: number; dy: number };

const ELEMENTS = ['Logótipo', 'Cores', 'Tipografia', 'Componentes', 'Publicações'] as const;

const CALLOUTS: Record<'largo' | 'telemovel', Callout[]> = {
  largo: [
    { u: 0.2723, v: 0.4792, dx: -0.045, dy: 0.25 },
    { u: 0.4781, v: 0.2875, dx: -0.03, dy: -0.2 },
    { u: 0.5144, v: 0.517, dx: 0.06, dy: 0.33 },
    { u: 0.6001, v: 0.338, dx: 0.035, dy: -0.22 },
    { u: 0.9052, v: 0.5271, dx: -0.02, dy: 0.2 },
  ],
  telemovel: [
    { u: 0.6025, v: 0.2785, dx: -0.16, dy: -0.15 },
    // Mais abaixo e um pouco à direita: a 0,13 ficava por baixo do nome da tipografia.
    { u: 0.8232, v: 0.3662, dx: 0.04, dy: 0.24 },
    { u: 0.5205, v: 0.4023, dx: 0.13, dy: 0.1 },
    { u: 0.2764, v: 0.5692, dx: 0.19, dy: 0.14 },
    { u: 0.1514, v: 0.6962, dx: 0.16, dy: 0.17 },
  ],
};

type VariantKey = 'largo' | 'telemovel';

type Variant = {
  src: string;
  /** A proporção da escultura, sem o prolongamento das pontas. */
  aspect: number;
  /** Quantas vezes a imagem é mais larga do que a escultura. */
  span: number;
  callouts: Callout[];
};

const VARIANTS: Record<VariantKey, Variant> = {
  // A deitada, com as pontas prolongadas para os ecrãs largos.
  largo: {
    src: esculturaLarga.src,
    aspect: escultura.width / escultura.height,
    span: esculturaLarga.width / escultura.width,
    callouts: CALLOUTS.largo,
  },
  // A ao alto já ocupa a largura do telemóvel.
  telemovel: {
    src: esculturaTelemovel.src,
    aspect: esculturaTelemovel.width / esculturaTelemovel.height,
    span: 1,
    callouts: CALLOUTS.telemovel,
  },
};

/** Os pontos em fracções da imagem inteira, que é o que o motor conhece. */
const anchorsOf = (variant: Variant): Anchor[] =>
  variant.callouts.map(({ u, v }) => ({ u: (u + (variant.span - 1) / 2) / variant.span, v }));

/**
 * Abaixo de 640 px, a escultura ao alto. A mesma pergunta decide a imagem
 * do `<picture>` (antes de o JavaScript correr) e a do motor: medindo a
 * secção em vez do ecrã, a barra de deslocamento punha as duas em
 * desacordo entre 640 e 655 px.
 */
const MOBILE_QUERY = '(max-width: 639px)';

const IMAGE_ALT =
  'Uma escultura de partículas verdes, os dados da tua empresa, com cinco pontos assinalados: o logótipo, as cores, a tipografia, os componentes e as publicações, os elementos do sistema de design.';

/** Quanto tempo as partículas levam a juntar-se: os pontos aparecem a seguir. */
const ASSEMBLY_MS = 2600;

/**
 * A indicação "Passa o cursor pelos dados", ao centro, por baixo da
 * escultura. Num ecrã baixo (1024 × 768, por exemplo) o nome da tipografia
 * desce até lá: a indicação passa para o lado do nome, do lado mais perto
 * do centro; se não couber de nenhum lado, não aparece. Só conta o
 * repouso — ao primeiro toque, a indicação apaga-se.
 */
function placeHint(hint: HTMLElement, rests: CalloutRest[], rect: Rect, bandBottom: number, w: number) {
  const top = Math.min(rect.y + rect.h * 0.96, bandBottom - 18);
  const half = hint.offsetWidth / 2;
  const height = hint.offsetHeight;
  const GAP = 14;
  const blocker = (x: number) =>
    rests.find(
      (rest) =>
        !rest.hidden &&
        rest.left < x + half + GAP &&
        rest.left + rest.width > x - half - GAP &&
        rest.top < top + height + 6 &&
        rest.top + rest.height > top - 6,
    );
  const fits = (x: number) => x - half >= 8 && x + half <= w - 8 && !blocker(x);

  const center = clamp(rect.x + rect.w / 2, half + 8, w - half - 8);
  let x: number | undefined = center;
  const hit = blocker(center);
  if (hit) {
    x = [hit.left - GAP - half, hit.left + hit.width + GAP + half]
      .filter(fits)
      .sort((a, b) => Math.abs(a - center) - Math.abs(b - center))[0];
  }
  if (x === undefined) {
    hint.style.display = 'none';
    return;
  }
  hint.style.left = `${x}px`;
  hint.style.top = `${top}px`;
}

const options = (reducedMotion: boolean): EngineOptions => ({
  interactive: true,
  strength: 1,
  radius: 210,
  density: 1,
  dotSize: 1,
  spread: 1,
  turbulence: 1,
  liquid: 1,
  streaks: true,
  restStyle: 'image',
  returnSpeed: 1,
  ambient: false,
  ambientIntensity: 1,
  speed: 1,
  intro: true,
  reducedMotion,
  bg: BACKGROUND,
  // A escultura foi pintada com o fundo exacto da página: nada a adivinhar nos cantos.
  imgBg: BACKGROUND,
});

export function BrandSystem() {
  const rootRef = React.useRef<HTMLElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const hintRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const calloutRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const engineRef = React.useRef<LiquidEngine | null>(null);
  const motionRef = React.useRef<CalloutMotion | null>(null);
  /** A imagem que está no palco (só muda quando a nova acaba de carregar). */
  const variantRef = React.useRef<Variant>(VARIANTS.largo);
  const loadedRef = React.useRef(false);
  const keyRef = React.useRef<VariantKey | null>(null);

  // `null` até à primeira medida: o telemóvel nunca chega a descarregar a imagem deitada.
  const [variantKey, setVariantKey] = React.useState<VariantKey | null>(null);
  const [isTouch, setIsTouch] = React.useState(false);

  const relayout = React.useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const w = root.clientWidth;
    const h = root.clientHeight;
    const mobile = window.matchMedia(MOBILE_QUERY).matches;
    const key: VariantKey = mobile ? 'telemovel' : 'largo';
    if (key !== keyRef.current) {
      keyRef.current = key;
      setVariantKey(key);
    }
    // Antes de o motor ter imagem, o palco mostra a do `<picture>`, escolhida pela mesma medida.
    if (!loadedRef.current) variantRef.current = VARIANTS[key];
    const variant = variantRef.current;

    const content = contentRef.current;
    /*
      A faixa da escultura: do topo da secção até ao texto. Ao contrário do
      original, não entra por baixo do título no telemóvel: os pontos
      assinalados e o título liam-se mal um sobre o outro.
    */
    const band = { top: mobile ? 28 : 40, bottom: content ? content.offsetTop - 12 : h };
    const rect = computeRect(w, h, variant.aspect, band, { scale: 1, mobileScale: 1, x: 0, y: 0 });
    // A imagem inteira: a escultura no meio e, dos lados, o prolongamento das pontas.
    const stage: Rect = {
      x: rect.x - (rect.w * (variant.span - 1)) / 2,
      y: rect.y,
      w: rect.w * variant.span,
      h: rect.h,
    };

    const img = imgRef.current;
    if (img) {
      img.style.left = `${stage.x}px`;
      img.style.top = `${stage.y}px`;
      img.style.width = `${stage.w}px`;
      img.style.height = `${stage.h}px`;
    }

    /*
      Os pontos assinalados em repouso: a partícula, a linha e o nome. Um
      ponto que caia fora do ecrã (nos tablets a escultura sai pelos lados)
      esconde-se inteiro — um nome sem a partícula não aponta para nada.
    */
    const rests: CalloutRest[] = variant.callouts.map((callout, index) => {
      const element = calloutRefs.current[index];
      const ax = rect.x + callout.u * rect.w;
      const ay = rect.y + callout.v * rect.h;
      const hidden = ax < 16 || ax > w - 16;
      if (element) element.hidden = hidden;
      const label = element?.children[2] as HTMLElement | undefined;
      const width = hidden || !label ? 0 : label.offsetWidth;
      const height = hidden || !label ? 0 : label.offsetHeight;
      const lx = ax + callout.dx * rect.w;
      const ly = ay + callout.dy * rect.h;
      return {
        hidden,
        ax,
        ay,
        lx,
        ly,
        left: clamp(lx - width / 2, 8, Math.max(8, w - width - 8)),
        top: callout.dy < 0 ? ly - height : ly,
        width,
        height,
      };
    });
    if (motionRef.current) {
      motionRef.current.place(rests, w);
      root.dataset.placed = '1';
    }

    const hint = hintRef.current;
    if (hint) {
      // A escultura ao alto do telemóvel não deixa sítio para a indicação.
      hint.style.display = mobile ? 'none' : '';
      if (!mobile) placeHint(hint, rests, rect, band.bottom, w);
    }

    engineRef.current?.resize(w, h, stage);
  }, []);

  // O motor e os pontos: criados uma vez, o motor com o seu próprio canvas.
  React.useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;
    let disposed = false;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const coarse = window.matchMedia('(hover: none), (pointer: coarse)');
    setIsTouch(coarse.matches);

    // Os pontos esperam pela escultura montada; sem montagem, aparecem logo.
    if (!motion.matches) root.dataset.intro = 'on';

    const callouts = new CalloutMotion(calloutRefs.current.filter((element): element is HTMLDivElement => Boolean(element)));
    callouts.calm = motion.matches;
    motionRef.current = callouts;

    // Um canvas novo por motor: um contexto WebGL libertado nunca se reaproveita.
    const canvas = document.createElement('canvas');
    canvas.className = 'lp-ds-canvas';
    stage.appendChild(canvas);

    let engine: LiquidEngine | null = null;
    const fail = () => {
      root.dataset.gl = 'off';
      delete root.dataset.intro;
      // Sem motor, os pontos ficam parados no sítio.
      callouts.follow(new Float32Array(ELEMENTS.length * 2));
    };
    try {
      engine = new LiquidEngine(canvas, options(motion.matches), fail);
      engine.onAnchors = (offsets) => callouts.follow(offsets);
      engineRef.current = engine;
    } catch {
      fail();
    }

    const resize = new ResizeObserver(() => relayout());
    resize.observe(root);
    if (contentRef.current) resize.observe(contentRef.current);
    // A largura dos nomes muda quando a letra da página chega.
    document.fonts?.ready.then(() => {
      if (!disposed) relayout();
    });

    // Só anima com a secção à vista e o separador à frente.
    const intersection = new IntersectionObserver((entries) => {
      for (const entry of entries) engine?.setVisible(entry.isIntersecting && !document.hidden);
    });
    intersection.observe(root);
    const onVisibility = () => engine?.setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    const onMotion = () => {
      engine?.setOptions({ reducedMotion: motion.matches });
      callouts.calm = motion.matches;
    };
    motion.addEventListener?.('change', onMotion);

    const position = (event: PointerEvent) => {
      const box = root.getBoundingClientRect();
      return [event.clientX - box.left, event.clientY - box.top] as const;
    };
    let touched = false;
    const markTouched = () => {
      if (touched) return;
      touched = true;
      root.dataset.touched = '1';
    };
    const onMove = (event: PointerEvent) => {
      const [x, y] = position(event);
      const touch = event.pointerType === 'touch';
      if (touch && event.buttons === 0 && event.pressure === 0) return;
      engine?.pointer('move', x, y, touch);
      markTouched();
    };
    const onDown = (event: PointerEvent) => {
      const [x, y] = position(event);
      engine?.pointer('down', x, y, event.pointerType === 'touch');
      markTouched();
    };
    const onUp = (event: PointerEvent) => {
      const [x, y] = position(event);
      engine?.pointer('up', x, y, event.pointerType === 'touch');
    };
    const onLeave = (event: PointerEvent) => {
      const [x, y] = position(event);
      engine?.pointer('leave', x, y, event.pointerType === 'touch');
    };
    root.addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('pointerdown', onDown, { passive: true });
    root.addEventListener('pointerup', onUp, { passive: true });
    root.addEventListener('pointercancel', onUp, { passive: true });
    root.addEventListener('pointerleave', onLeave, { passive: true });

    return () => {
      disposed = true;
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      motion.removeEventListener?.('change', onMotion);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onUp);
      root.removeEventListener('pointerleave', onLeave);
      engine?.destroy();
      engineRef.current = null;
      callouts.destroy();
      motionRef.current = null;
      canvas.remove();
      loadedRef.current = false;
      delete root.dataset.gl;
      delete root.dataset.intro;
      delete root.dataset.placed;
    };
  }, [relayout]);

  /*
    A imagem certa para a largura: a deitada, ou a ao alto no telemóvel. O
    canvas apaga-se durante a troca, com a imagem parada a cobri-la, e a
    escultura volta a montar-se — com os pontos escondidos até assentar.
  */
  React.useEffect(() => {
    const root = rootRef.current;
    const engine = engineRef.current;
    if (!root || !variantKey) return;
    const variant = VARIANTS[variantKey];
    let cancelled = false;
    let reveal = 0;
    const image = new Image();
    image.decoding = 'async';
    const assembles = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const swapping = root.dataset.gl === 'on';
    if (swapping) {
      root.dataset.swap = '1';
      // Até a nova imagem chegar, os pontos estariam dispostos para a antiga.
      if (assembles) root.dataset.intro = 'on';
    }
    image.onload = () => {
      if (cancelled) return;
      loadedRef.current = true;
      variantRef.current = variant;
      relayout();
      if (engine && root.dataset.gl !== 'off') {
        try {
          if (assembles) root.dataset.intro = 'on';
          engine.onFirstFrame = () => {
            if (cancelled) return;
            root.dataset.gl = 'on';
            delete root.dataset.swap;
            // Os pontos entram quando as partículas acabam de se juntar.
            reveal = window.setTimeout(() => delete root.dataset.intro, assembles ? ASSEMBLY_MS : 0);
          };
          engine.setImage(image, { span: variant.span, anchors: anchorsOf(variant) });
          relayout();
        } catch {
          root.dataset.gl = 'off';
          delete root.dataset.intro;
        }
      } else {
        delete root.dataset.swap;
        delete root.dataset.intro;
      }
    };
    image.onerror = () => {
      delete root.dataset.swap;
      delete root.dataset.intro;
    };
    const timer = window.setTimeout(() => (image.src = variant.src), swapping ? 280 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(reveal);
      image.onload = null;
      image.onerror = null;
    };
  }, [variantKey, relayout]);

  return (
    <section
      ref={rootRef}
      id="a-tua-marca"
      aria-labelledby="marca-titulo"
      className="lp-ds bg-ink-950 text-fg"
    >
      <div ref={stageRef} className="lp-ds-stage" aria-hidden="true">
        {/* Escolhida pelo browser ao ler a página: o telemóvel só descarrega a sua. */}
        <picture>
          <source media={MOBILE_QUERY} srcSet={esculturaTelemovel.src} />
          <img ref={imgRef} className="lp-ds-fallback" src={esculturaLarga.src} alt="" draggable={false} />
        </picture>
      </div>
      <span className="sr-only">{IMAGE_ALT}</span>

      {/* Decorativos: o texto alternativo acima já diz o que assinalam. */}
      <div className="lp-ds-callouts" aria-hidden="true">
        {ELEMENTS.map((name, index) => (
          <div
            key={name}
            ref={(element) => {
              calloutRefs.current[index] = element;
            }}
            className="lp-ds-callout"
            style={{ ['--lp-ds-delay' as string]: `${index * 0.45}s` }}
          >
            <span className="lp-ds-callout-dot" />
            <span className="lp-ds-callout-line" />
            <span className="lp-ds-callout-label">
              <b>{String(index + 1).padStart(2, '0')}</b>
              {name}
            </span>
          </div>
        ))}
      </div>

      <div ref={hintRef} className="lp-ds-hint" aria-hidden="true">
        {isTouch ? 'Toca nos dados' : 'Passa o cursor pelos dados'}
      </div>

      <div className="lp-ds-spacer" />

      <div ref={contentRef} className="relative z-[2] pb-12 sm:pb-16">
        <Container className="grid items-end gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-14">
          <h2
            id="marca-titulo"
            className="text-balance text-[clamp(2.25rem,min(5.2cqw,9cqh),4.75rem)] font-semibold leading-[0.98] tracking-[-0.045em] text-fg"
          >
            <span className="block">Conhecemos a tua marca</span>
            <span className="block text-neon">antes de criar.</span>
          </h2>

          <div className="max-w-[28rem] lg:justify-self-end lg:pb-1">
            <p className="text-pretty text-[1rem] leading-relaxed text-fg-muted sm:text-[1.0625rem]">
              Analisamos os dados da tua empresa: o logótipo, as cores, as letras, os produtos e o
              tom com que falas aos clientes. Com eles, criamos um sistema de design único, só para a
              tua marca, e é esse sistema que enviamos à IA. Assim, cada publicação é diferente, mas
              todas têm a cara da tua empresa.
            </p>
            <a
              href="#como-funciona"
              className="group mt-6 inline-flex items-center gap-2 border-b border-line-strong pb-1 text-[14.5px] font-medium text-fg transition-colors hover:border-neon/60 hover:text-neon"
            >
              Ver como funciona
              <ArrowRight
                className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                aria-hidden
              />
            </a>
          </div>
        </Container>
      </div>
    </section>
  );
}
