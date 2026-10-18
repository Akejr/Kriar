import type { ReactNode } from 'react';
import Image from 'next/image';
import { Check, Download, ImagePlus, Pencil, Sparkles } from 'lucide-react';
import { DEMO_BRAND } from '@/lib/landing/content';
import type { DemoEntry } from '@/lib/landing/demos';
import { KIANDA_PHOTOS, KIANDA_SYMBOL } from '@/lib/landing/kianda';
import { Blueprint } from './Blueprint';
import { KIANDA_SWATCHES, Swatch } from './KiandaArt';
import { Container, IndexTag, Lead, Node, SectionIntro, reveal } from './ui';

/**
 * Como funciona: três passos, cada um com uma vinheta da interface.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Os passos ligam-se como os pontos assinalados da escultura da secção da
 * marca: um ponto a pulsar e o nome numerado ("01 A MARCA") por cima de
 * cada um, e um carril que os une, com um brilho a percorrê-lo. Nos ecrãs
 * estreitos ficam em coluna, com um traço de cada ponto ao seguinte.
 *
 * As vinhetas são HTML e CSS, sem JavaScript próprio: cada peça tem uma
 * animação que a faz entrar no momento dela de uma volta de nove segundos.
 * O `LandingMotion` liga-as quando chegam ao ecrã e pára-as quando saem.
 *
 * O estado SEM animação é o estado final de cada vinheta (tudo preenchido).
 * É o que vê quem pede menos movimento, quem não tem JavaScript, e quem
 * ainda não chegou à secção — nunca um painel vazio.
 *
 * A terceira é a que mais importa: mostra o título proposto a ser trocado
 * pelo do cliente ANTES de gerar. É a resposta a "e se a IA escrever
 * disparates?".
 * ──────────────────────────────────────────────────────────────────────────
 */
export function HowItWorks({ reviewArt }: { reviewArt: DemoEntry }) {
  const steps = [
    {
      tag: 'A marca',
      title: 'Apresenta a tua marca',
      text: 'Adiciona o logótipo, as cores e as informações da empresa. Fica guardado: todas as publicações o usam.',
      vignette: <BrandVignette />,
    },
    {
      tag: 'O pedido',
      title: 'Conta o que queres comunicar',
      text: 'Descreve a publicação como a explicarias a um designer e anexa os produtos que queres destacar.',
      vignette: <RequestVignette />,
    },
    {
      tag: 'A arte',
      title: 'Revê, cria e publica',
      text: 'Ajusta a proposta, gera a arte e descarrega-a nas medidas da tua rede.',
      vignette: <ReviewVignette art={reviewArt} />,
    },
  ];

  return (
    <section id="como-funciona" aria-labelledby="como-funciona-titulo" className="relative py-24 sm:py-32">
      <Container>
        <SectionIntro
          id="como-funciona-titulo"
          stacked
          title={[
            'Tu conheces o teu negócio.',
            /*
              Os hífenes não partem: corrida, a 320 px a frase partia em
              "ajuda- / te".
            */
            <>
              A Kriar <span className="whitespace-nowrap">ajuda-te</span>{' '}
              <span className="whitespace-nowrap">a mostrá-lo.</span>
            </>,
          ]}
        >
          <Lead>
            Três passos, sem ferramentas de design. A marca fica guardada; depois, cada publicação
            começa com uma frase tua.
          </Lead>
        </SectionIntro>

        {/*
          `grid-cols-1`: com a coluna implícita, o texto sem quebra das
          vinhetas alargava os passos a 320 px, para dentro da margem.
        */}
        <ol className="relative mt-16 grid grid-cols-1 gap-14 sm:mt-20 lg:grid-cols-3 lg:gap-6">
          <span aria-hidden className="lp-steps-rail max-lg:hidden" />
          {steps.map((step, index) => (
            <li key={step.title} {...reveal(index * 110)} className="relative min-w-0 pl-9 lg:pl-0">
              {index < steps.length - 1 ? <span aria-hidden className="lp-step-link lg:hidden" /> : null}
              <div className="flex items-center gap-3">
                {/*
                  Nos ecrãs estreitos o ponto sai para a margem, por cima do
                  traço. A posição vai num invólucro: a classe do ponto
                  (`.lp-node`, no `landing.css`) já diz `position: relative`,
                  e vem depois do Tailwind — ganhava ao `max-lg:absolute`.
                */}
                <span className="max-lg:absolute max-lg:left-0 max-lg:top-[7.5px]">
                  <Node delay={index * 0.6} />
                </span>
                <IndexTag index={index + 1}>{step.tag}</IndexTag>
              </div>
              <div className="mt-6">{step.vignette}</div>
              <h3 className="mt-7 text-[1.25rem] font-semibold tracking-[-0.02em] text-fg">{step.title}</h3>
              <p className="mt-2.5 max-w-[24rem] text-pretty text-[15px] leading-relaxed text-fg-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

/** Moldura comum das vinhetas: um bocado de painel da aplicação. */
function Vignette({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      data-play="idle"
      aria-hidden
      className="lp-vig lp-edge relative h-[15rem] overflow-hidden rounded-[20px] bg-ink-900/70 p-5 ring-1 ring-line"
    >
      <span className="lp-dots pointer-events-none absolute inset-0 opacity-60" />
      <p className="relative mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-faint">{label}</p>
      <div className="relative">{children}</div>
    </div>
  );
}

/** Texto que se escreve: o recorte revela-o e o cursor segue a aresta. */
function Typed({ text, timing }: { text: string; timing: string }) {
  return (
    <span className="relative inline-block max-w-full align-top">
      <span className={`lp-type-text block whitespace-nowrap ${timing}`}>{text}</span>
      <span aria-hidden className={`lp-type-caret absolute top-[0.12em] h-[1.05em] w-px bg-neon ${timing}`} />
    </span>
  );
}

function BrandVignette() {
  return (
    <Vignette label="Marca">
      <div className="flex items-center gap-3">
        {/* O símbolo do logótipo da Kianda (`src/kianda/`), sobre a superfície clara dos logótipos escuros. */}
        <span className="lp-k-06 grid size-14 shrink-0 place-items-center rounded-[12px] bg-[#F4F2EE] ring-1 ring-line">
          <Image src={KIANDA_SYMBOL.src} alt="" sizes="28px" className="h-9 w-auto" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[10.5px] font-medium text-fg-muted">Nome da empresa</p>
          <div className="flex h-8 items-center rounded-[9px] border border-line bg-ink-900/80 px-2.5 text-[12px] text-fg">
            <Typed text={DEMO_BRAND.name} timing="lp-t-14-32" />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[10.5px] font-medium text-fg-muted">Cores</p>
        <div className="flex items-center gap-1.5">
          {KIANDA_SWATCHES.map((color, index) => (
            <Swatch key={color} color={color} className={`size-7 ${['lp-k-38', 'lp-k-46', 'lp-k-54'][index]}`} />
          ))}
        </div>
      </div>

      <div className="lp-k-62 mt-3 flex items-center justify-between gap-3">
        <p className="text-[10.5px] font-medium text-fg-muted">Tipografia</p>
        <p className="flex items-baseline gap-2 text-fg">
          <span className="text-[17px] leading-none" style={{ fontFamily: 'var(--font-brand-playfair), serif' }}>
            Aa
          </span>
          <span className="text-[11px] text-fg-muted">
            {DEMO_BRAND.fonts.display} · {DEMO_BRAND.fonts.body}
          </span>
        </p>
      </div>

      <p className="lp-k-70 mt-4 inline-flex items-center gap-1.5 rounded-full bg-neon/10 px-2 py-0.5 text-[10.5px] font-medium text-neon ring-1 ring-neon/30">
        <Check className="size-3" />
        Guardado na marca
      </p>
    </Vignette>
  );
}

function RequestVignette() {
  return (
    <Vignette label="O que queres comunicar?">
      <div className="lp-focus-req rounded-[10px] border border-line bg-ink-900/80 px-2.5 py-2 text-[12px] leading-relaxed text-fg">
        <Typed text="Promoção de fim de semana" timing="lp-t-08-22" />
        <br />
        <Typed text="nos difusores a 7.500 Kz." timing="lp-t-23-36" />
      </div>

      <p className="lp-k-46 mt-2 inline-flex items-center gap-1.5 rounded-full bg-neon/10 px-2 py-0.5 text-[10px] font-medium text-neon">
        <Sparkles className="size-2.5" />
        preço reconhecido: 7.500 Kz
      </p>

      <p className="mb-1.5 mt-3 text-[10.5px] font-medium text-fg-muted">Anexos</p>
      {/* As fotografias da Kianda, como o cliente as anexa: o difusor da promoção primeiro. */}
      <div className="flex items-center gap-2">
        <span className="lp-k-54 relative size-11 shrink-0 overflow-hidden rounded-[8px] ring-1 ring-neon/40">
          <Image src={KIANDA_PHOTOS.difusor.src} alt="" fill sizes="44px" className="object-cover" />
        </span>
        <span className="lp-k-62 relative size-11 shrink-0 overflow-hidden rounded-[8px] ring-1 ring-line">
          <Image src={KIANDA_PHOTOS.perfume.src} alt="" fill sizes="44px" className="object-cover" />
        </span>
        <span className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[8px] border border-dashed border-line-strong text-[10.5px] font-medium text-fg-muted">
          <ImagePlus className="size-3" />
          Anexar mais
        </span>
      </div>
    </Vignette>
  );
}

/**
 * A arte do fim da vinheta é a do manifesto, quando existe (é a mesma
 * publicação: a promoção de fim de semana). Sem ela, uma miniatura do
 * esboço — do tamanho de um ícone, sem fazer de resultado.
 */
function ReviewVignette({ art }: { art: DemoEntry }) {
  return (
    <Vignette label="Rever publicação">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10.5px] font-medium text-fg-muted">Título</p>
        <span className="inline-flex items-center gap-1 rounded-full border border-neon/40 bg-neon/10 px-1.5 py-0.5 text-[9.5px] font-medium text-neon">
          <Check className="size-2.5" />
          Pronto a gerar
        </span>
      </div>
      <div className="lp-focus-title relative mt-1.5 flex h-9 items-center rounded-[9px] border border-line bg-ink-900/80 pl-2.5 pr-8 text-[12px] text-fg">
        {/* O proposto só existe durante a animação; o estado final é o editado. */}
        <span className="lp-proposed absolute inset-y-0 left-2.5 flex items-center opacity-0">
          <span className="lp-proposed-text rounded-[2px] whitespace-nowrap">Promoção de fim de semana</span>
        </span>
        <Typed text="Fim de semana perfumado" timing="lp-t-32-50" />
        <Pencil className="lp-pencil absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neon" />
      </div>
      <p className="lp-k-54 mt-1.5 text-[10px] text-fg-faint">Editado por ti. Não volta a ser reescrito.</p>

      <div className="mt-3 flex items-center gap-3">
        <span className="lp-k-press glow-neon inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] bg-neon px-3 text-[11.5px] font-semibold text-ink-950">
          <Sparkles className="size-3" />
          Gerar arte
        </span>
        <span className="lp-k-70 flex min-w-0 items-center gap-2">
          <span className="w-8 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-line-strong">
            {art.image ? (
              <Image
                src={art.image}
                alt=""
                width={art.width}
                height={art.height}
                sizes="32px"
                className="block h-auto w-full"
              />
            ) : (
              <Blueprint annotations={false} titleLines={1} contacts={1} />
            )}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1 text-[10.5px] font-medium text-fg-muted">
            <Download className="size-3 shrink-0 text-neon" />
            <span className="truncate">Descarregar PNG</span>
          </span>
        </span>
      </div>
    </Vignette>
  );
}
