'use client';

import * as React from 'react';
import Image from 'next/image';
import { ArrowLeft, Check, Globe, Instagram, Pencil, Sparkles, Star } from 'lucide-react';
import { LOGO_PLACEMENT_LABEL } from '@/lib/composition/layouts';
import { STYLES } from '@/lib/domain/catalog';
import type { LogoPlacement, StyleId } from '@/lib/domain/types';
import { DEMO_BRAND, HERO_SCRIPT, type DemoProductId } from '@/lib/landing/content';
import { KIANDA_ART, KIANDA_LOGO, KIANDA_PHOTOS } from '@/lib/landing/kianda';
import { cn } from '@/lib/utils/cn';
import { Switch } from '@/components/ui/primitives';
import { Blueprint, type BlueprintZone } from './Blueprint';
import { Hint } from './ui';

/**
 * "A IA propõe. Tu decides." — a revisão, a funcionar.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Uma réplica da revisão da aplicação com controlos verdadeiros: o título
 * escreve-se, o produto escolhe-se, o logótipo liga-se e muda de canto, os
 * contactos entram e saem, o estilo troca. Ao lado, a planta técnica da
 * disposição responde a cada mudança e realça a verde a zona que mudou.
 *
 * "Gerar arte" mostra, no lugar da planta, a arte que a Kriar gerou ANTES
 * com os dados que a secção traz por omissão (`KIANDA_ART`) — não chama a
 * IA nem finge que gera agora. Diz-se as duas coisas: que foi gerada antes
 * e, se o visitante mudou alguma coisa, que a arte é a dos dados de origem.
 * Qualquer mudança depois disso devolve a planta, como na aplicação: uma
 * arte deixa de valer quando a revisão muda.
 *
 * Os controlos são os nativos sempre que existem (campos de opção para o
 * produto, a posição e o estilo): as setas do teclado, o foco e os leitores
 * de ecrã funcionam sem código à mão. Os interruptores são os da aplicação.
 *
 * Uma superfície só, com os cinco campos separados por linhas finas e
 * numerados como os pontos da secção da marca ("01 TÍTULO"). Antes eram
 * cinco caixas dentro de um cartão — caixas dentro de caixas, a pesar mais
 * do que o que lá estava dentro.
 * ──────────────────────────────────────────────────────────────────────────
 */

const PLACEMENTS: LogoPlacement[] = [
  'superior-esquerdo',
  'superior-centro',
  'superior-direito',
  'inferior-esquerdo',
  'inferior-centro',
  'inferior-direito',
];

/** Linhas que o título ocupa na arte: uma estimativa de leitura, não uma medida. */
function linesFor(title: string): 0 | 1 | 2 | 3 {
  const length = title.trim().length;
  if (length === 0) return 0;
  if (length <= 16) return 1;
  if (length <= 34) return 2;
  return 3;
}

export function ControlDemo() {
  const id = React.useId().replace(/:/g, '');
  const [title, setTitle] = React.useState<string>(HERO_SCRIPT.proposedHeadline);
  const [edited, setEdited] = React.useState(false);
  const [product, setProduct] = React.useState<DemoProductId>('perfume');
  const [logoShow, setLogoShow] = React.useState(true);
  const [placement, setPlacement] = React.useState<LogoPlacement>('superior-esquerdo');
  const [website, setWebsite] = React.useState(true);
  const [instagram, setInstagram] = React.useState(false);
  const [style, setStyle] = React.useState<StyleId>('auto');
  const [changed, setChanged] = React.useState<BlueprintZone | null>(null);
  /** A arte gerada está à vista, no lugar da planta. */
  const [shown, setShown] = React.useState(false);
  /** O visitante já carregou em "Gerar arte": o convite sai. */
  const [tried, setTried] = React.useState(false);
  const timer = React.useRef<number | undefined>(undefined);
  const panel = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  /** Realça a zona que mudou, durante um instante. Com a arte à vista, volta a planta. */
  const touch = React.useCallback((zone: BlueprintZone) => {
    setChanged(zone);
    setShown(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setChanged(null), 1600);
  }, []);

  const generate = () => {
    window.clearTimeout(timer.current);
    setChanged(null);
    setShown(true);
    setTried(true);
    /*
      No telemóvel a planta está por cima do cartão, e o botão no fundo
      dele: sem isto, a arte aparecia fora do ecrã de quem carregou.
    */
    if (window.matchMedia('(max-width: 767px)').matches) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      panel.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  };

  /** Os dados com que a arte foi gerada: os que a secção traz por omissão. */
  const original =
    title.trim() === KIANDA_ART.headline &&
    product === 'perfume' &&
    logoShow &&
    placement === 'superior-esquerdo' &&
    website &&
    !instagram &&
    style === 'auto';

  const lines = linesFor(title);
  const contacts = (website ? 1 : 0) + (instagram ? 1 : 0);
  const styleSpec = STYLES.find((entry) => entry.id === style) ?? STYLES[0];
  const productName = DEMO_BRAND.products.find((entry) => entry.id === product)?.name ?? '';

  const summary = [
    lines === 0 ? 'título em falta' : `título em ${lines} ${lines === 1 ? 'linha' : 'linhas'}`,
    `imagem de ${productName}`,
    logoShow ? `logótipo ${LOGO_PLACEMENT_LABEL[placement].toLowerCase()}` : 'sem logótipo',
    contacts === 0
      ? 'sem contactos'
      : `contactos: ${[website ? 'website' : null, instagram ? 'Instagram' : null].filter(Boolean).join(' e ')}`,
  ].join('; ');

  return (
    /*
      As colunas são `minmax(0, …)` desde a mais estreita (`grid-cols-1`).
      Com a coluna implícita (`auto`), a largura mínima dela era a do
      conteúdo que não quebra — o nome do produto, numa linha só —, e a
      320 px a revisão saía 18 px para fora do ecrã.

      A partir de 768 px a planta vai para o lado e acompanha a rolagem:
      num tablet ao alto ficava lá em cima, e quem mexia nos contactos, no
      fundo do cartão, já não a via responder.
    */
    <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-12">
      {/*
        A planta: primeiro no telemóvel, para se ver o efeito do que se muda
        por baixo. Sem margem de rolagem própria: a página já desconta a
        barra do topo (`scroll-padding-top`, no `landing.css`), e as duas
        somadas deixavam a arte 80 px abaixo do sítio.
      */}
      <div ref={panel} className="md:sticky md:top-24 md:order-2">
        <div className="relative mx-auto w-full max-w-[19rem] sm:max-w-[21rem] md:max-w-none">
          <span aria-hidden className="lp-soft-glow pointer-events-none absolute -inset-16 -z-10" />
          <Hint className="mb-4">{shown ? 'Arte gerada pela Kriar' : 'Esboço em directo'}</Hint>
          {/*
            A planta fica sempre por baixo: é ela que dá a medida (4:5), e a
            arte assenta por cima, com a mesma proporção.
          */}
          <div className="relative overflow-hidden rounded-[16px] shadow-[0_40px_90px_-40px_rgba(0,0,0,0.95)] ring-1 ring-line-strong">
            <Blueprint
              titleLines={lines}
              imageShape={DEMO_BRAND.products.find((entry) => entry.id === product)?.bottle ?? 'alto'}
              logo={{ show: logoShow, placement }}
              contacts={contacts}
              active={changed}
              formatLabel="1080 × 1350"
              label={shown ? undefined : `Esboço técnico da disposição: ${summary}.`}
            />
            {shown ? (
              <div className="lp-art-reveal absolute inset-0">
                <Image
                  src={KIANDA_ART.src}
                  alt={KIANDA_ART.alt}
                  fill
                  sizes="(min-width: 1024px) 400px, (min-width: 768px) 256px, 336px"
                  placeholder="blur"
                  className="object-cover"
                />
                <span aria-hidden className="lp-art-scan" />
              </div>
            ) : null}
          </div>
          {shown ? (
            <div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-fg-faint">
                {original
                  ? 'Gerada pela Kriar a partir destes dados.'
                  : 'Gerada com os dados de origem. As tuas alterações geram-se na tua conta.'}
              </p>
              <button
                type="button"
                onClick={() => setShown(false)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-[6px] text-[11.5px] font-medium text-fg-muted transition-colors hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon"
              >
                <ArrowLeft className="size-3" aria-hidden />
                Voltar ao esboço
              </button>
            </div>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-[11.5px] leading-relaxed text-fg-faint">
              <span aria-hidden className="inline-block size-2 shrink-0 rounded-[2px] ring-1 ring-neon" />
              A verde, a zona que acabaste de mudar.
            </p>
          )}
        </div>
      </div>

      {/* Quase opaco: o campo de pontos da secção não atravessa os campos do formulário. */}
      <div className="lp-edge relative overflow-hidden rounded-[24px] bg-ink-900/85 ring-1 ring-line md:order-1">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <p className="text-[1.0625rem] font-semibold tracking-tight text-fg">Rever publicação</p>
            <p className="mt-0.5 text-[12.5px] text-fg-muted">Nada é gerado até confirmares.</p>
          </div>
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium',
              lines > 0 ? 'border-neon/40 bg-neon/10 text-neon' : 'border-dashed border-line-strong text-fg-muted',
            )}
          >
            {lines > 0 ? <Check className="size-3" aria-hidden /> : null}
            {lines > 0 ? 'Pronto a gerar' : 'Falta o título'}
          </span>
        </div>

        {/*
          Duas colunas só a partir de 1280 px. Antes disso o cartão divide a
          largura com a planta, e a 1024 cada campo ficava com 240 px —
          "Mostrar logótipo" partia-se em duas linhas ao lado da miniatura.
        */}
        <div className="grid grid-cols-1 xl:grid-cols-2">
          {/* 1 · Título */}
          <Block step={1} title="Título" className="xl:col-span-2">
            <label htmlFor={`${id}-titulo`} className="sr-only">
              Título da publicação
            </label>
            <div className="relative">
              <input
                id={`${id}-titulo`}
                value={title}
                maxLength={60}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setEdited(true);
                  touch('titulo');
                }}
                placeholder="A frase principal da publicação"
                className="h-11 w-full rounded-[10px] border border-line bg-ink-950/70 pl-3 pr-10 text-[14px] text-fg outline-none transition-colors placeholder:text-fg-faint hover:border-line-strong focus:border-neon/60"
              />
              <Pencil
                aria-hidden
                className={cn(
                  'pointer-events-none absolute right-3.5 top-1/2 size-3.5 -translate-y-1/2 transition-colors',
                  edited ? 'text-neon' : 'text-fg-faint',
                )}
              />
            </div>
            <p className="mt-1.5 text-[11.5px] text-fg-faint">
              {edited
                ? 'Editado por ti. Não volta a ser reescrito.'
                : 'Proposto pela Kriar. Experimenta escrever outro.'}
            </p>
          </Block>

          {/*
            2 · Produto

            Os `fieldset` levam `min-w-0`: o browser dá-lhes
            `min-inline-size: min-content`, e o nome do produto, numa linha
            só, impedia o bloco de encolher — a opção escolhida passava por
            cima do bloco do lado.
          */}
          <Block step={2} title="Produto em destaque">
            <fieldset className="min-w-0">
              <legend className="sr-only">Produto em destaque</legend>
              <div className="flex flex-col gap-2">
                {DEMO_BRAND.products.map((entry) => {
                  const selected = entry.id === product;
                  return (
                    <label
                      key={entry.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-[11px] border bg-ink-950/60 p-2 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neon',
                        selected ? 'border-neon/40' : 'border-line hover:border-line-strong',
                      )}
                    >
                      <input
                        type="radio"
                        name={`${id}-produto`}
                        value={entry.id}
                        checked={selected}
                        onChange={() => {
                          setProduct(entry.id);
                          touch('imagem');
                        }}
                        className="sr-only"
                      />
                      <span className="relative size-11 shrink-0 overflow-hidden rounded-[8px] ring-1 ring-line">
                        <Image
                          src={KIANDA_PHOTOS[entry.id].src}
                          alt=""
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{entry.name}</span>
                      <span
                        aria-hidden
                        className={cn(
                          'grid size-6 shrink-0 place-items-center rounded-full transition-colors',
                          selected ? 'bg-neon/15 text-neon ring-1 ring-neon/40' : 'bg-ink-800 text-fg-faint',
                        )}
                      >
                        <Star className={cn('size-3', selected && 'fill-current')} />
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </Block>

          {/* 3 · Logótipo */}
          <Block step={3} title="Logótipo" className="xl:border-l">
            <div className="flex items-start justify-between gap-3">
              <Switch
                checked={logoShow}
                onChange={(next) => {
                  setLogoShow(next);
                  touch('logotipo');
                }}
                label="Mostrar logótipo"
                description={logoShow ? LOGO_PLACEMENT_LABEL[placement] : 'Fica de fora desta arte.'}
              />
              <span
                className={cn(
                  'grid h-10 w-20 shrink-0 place-items-center rounded-[9px] bg-[#F4F2EE] px-2 ring-1 ring-line transition-opacity',
                  !logoShow && 'opacity-35',
                )}
              >
                <Image src={KIANDA_LOGO.src} alt="" sizes="64px" className="h-auto w-full" />
              </span>
            </div>

            <fieldset disabled={!logoShow} className="mt-3 min-w-0 disabled:opacity-45">
              <legend className="mb-1.5 text-[11px] font-medium text-fg-muted">Posição</legend>
              <div className="grid grid-cols-3 gap-1.5">
                {PLACEMENTS.map((value) => {
                  const selected = value === placement;
                  const [row, col] = value.split('-');
                  return (
                    <label
                      key={value}
                      title={LOGO_PLACEMENT_LABEL[value]}
                      className={cn(
                        'relative flex h-9 cursor-pointer rounded-[8px] border bg-ink-950/60 p-1.5 transition-colors has-[:disabled]:cursor-not-allowed has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neon',
                        row === 'superior' ? 'items-start' : 'items-end',
                        col === 'esquerdo' ? 'justify-start' : col === 'centro' ? 'justify-center' : 'justify-end',
                        selected ? 'border-neon/50 bg-neon/8' : 'border-line hover:border-line-strong',
                      )}
                    >
                      <input
                        type="radio"
                        name={`${id}-posicao`}
                        value={value}
                        checked={selected}
                        onChange={() => {
                          setPlacement(value);
                          touch('logotipo');
                        }}
                        className="sr-only"
                      />
                      <span className="sr-only">{LOGO_PLACEMENT_LABEL[value]}</span>
                      <span
                        aria-hidden
                        className={cn(
                          'block h-1.5 w-4 rounded-[2px] transition-colors',
                          selected ? 'bg-neon' : 'bg-line-strong',
                        )}
                      />
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </Block>

          {/* 4 · Contactos */}
          <Block step={4} title="Contactos">
            <div className="flex flex-col gap-1.5">
              <ContactRow
                icon={Globe}
                label="Website"
                value={DEMO_BRAND.contacts.website}
                checked={website}
                onChange={(next) => {
                  setWebsite(next);
                  touch('contactos');
                }}
              />
              <ContactRow
                icon={Instagram}
                label="Instagram"
                value={DEMO_BRAND.contacts.instagram}
                checked={instagram}
                onChange={(next) => {
                  setInstagram(next);
                  touch('contactos');
                }}
              />
            </div>
          </Block>

          {/* 5 · Estilo */}
          <Block step={5} title="Estilo visual" className="xl:border-l">
            <fieldset className="min-w-0">
              <legend className="sr-only">Estilo visual</legend>
              <div className="flex flex-wrap gap-1.5">
                {STYLES.map((entry) => {
                  const selected = entry.id === style;
                  return (
                    <label
                      key={entry.id}
                      className={cn(
                        'cursor-pointer whitespace-nowrap rounded-[9px] border px-2.5 py-1.5 text-[12px] font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neon',
                        selected
                          ? 'border-neon/50 bg-neon/10 text-neon'
                          : 'border-line bg-ink-950/50 text-fg-muted hover:border-line-strong hover:text-fg',
                      )}
                    >
                      <input
                        type="radio"
                        name={`${id}-estilo`}
                        value={entry.id}
                        checked={selected}
                        onChange={() => {
                          setStyle(entry.id);
                          setShown(false);
                        }}
                        className="sr-only"
                      />
                      {entry.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <p className="mt-2 text-[11.5px] leading-relaxed text-fg-faint">{styleSpec.hint}</p>
          </Block>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-ink-950/30 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1" aria-live="polite">
            {/* O convite, até ao primeiro clique; depois, o que aconteceu. */}
            {!tried && lines > 0 ? (
              <Hint className="lp-hint-on">Clica em «Gerar arte» para veres o resultado</Hint>
            ) : (
              <p className="text-[12px] leading-relaxed text-fg-faint">
                {shown
                  ? 'A arte apareceu no lugar do esboço. Muda um dado e o esboço volta.'
                  : 'A arte é gerada por IA a partir destes dados. Podes voltar aqui e gerar outra vez.'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={lines === 0}
            className={cn(
              'relative inline-flex h-11 shrink-0 items-center gap-2 rounded-[12px] bg-neon px-5 text-[14.5px] font-semibold text-ink-950 transition-all duration-200 hover:bg-neon-700 active:scale-[0.985] disabled:cursor-not-allowed disabled:bg-neon/25 disabled:text-ink-950/50',
              lines > 0 && 'glow-neon',
              // O anel a pulsar à volta do botão, até ao primeiro clique.
              lines > 0 && !tried && 'lp-cta-ping',
            )}
          >
            <Sparkles className="size-4" aria-hidden />
            Gerar arte
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Um campo da revisão: uma linha fina por cima e o nome numerado. Os dois
 * campos de uma linha (a partir de 1280 px) ficam lado a lado com a mesma
 * linha por cima, e uma vertical entre eles (`xl:border-l`, dado por fora).
 */
function Block({
  step,
  title,
  className,
  children,
}: {
  step: number;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('min-w-0 border-t border-line px-5 py-5 sm:px-6', className)}>
      <h3 className="mb-3.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
        <span className="text-neon">{String(step).padStart(2, '0')}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  checked,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-[10px] border bg-ink-950/60 px-2.5 py-2 transition-colors',
        checked ? 'border-line-strong' : 'border-line',
      )}
    >
      <Icon className={cn('size-3.5 shrink-0', checked ? 'text-neon' : 'text-fg-faint')} aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('text-[10.5px] font-medium leading-none', checked ? 'text-fg-muted' : 'text-fg-faint')}>
          {label}
        </span>
        <span className="mt-1 truncate text-[12.5px] text-fg">{value}</span>
      </span>
      <Switch checked={checked} onChange={onChange} label={`Mostrar ${label} na arte`} labelHidden />
    </div>
  );
}
