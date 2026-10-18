'use client';

import * as React from 'react';
import {
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  MapPin,
  MessageCircle,
  Phone,
  type LucideIcon,
} from 'lucide-react';
import type { ResolvedAsset } from '@/lib/composition/resolve';
import {
  CONTACT_SEPARATOR,
  computeSketch,
  type Sketch,
  type SketchBlock,
  type SketchRole,
} from '@/lib/composition/sketch';
import { sketchInputFor } from '@/lib/composition/sketchInput';
import { measureLineWidth } from '@/lib/composition/textLayout';
import { formatContactForArt, getFormat } from '@/lib/domain/catalog';
import type { ProtagonistKind } from '@/lib/domain/direction';
import type { Brand, Composition, ContactType } from '@/lib/domain/types';
import { cn } from '@/lib/utils/cn';
import { useArtFonts } from '@/components/editor/useArtFonts';

/**
 * A PLANTA da publicação, na revisão.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Substituiu o esboço com as palavras e as cores verdadeiras. "O preview da
 * ideia é muito feio. Quero um preview técnico, não precisa de usar os
 * textos nem as cores." O esboço tentava parecer uma arte e não conseguia —
 * um rectângulo tracejado com a descrição do protagonista lá dentro, o
 * título por cima de um degradê da cor da marca — e o cliente julgava-o
 * como arte.
 *
 * Agora é uma planta, na mesma linguagem da página de entrada: campo escuro
 * com quadrícula, guias de margem tracejadas, a zona da imagem com o
 * tracejado de corte dos desenhos de arquitectura, as linhas de texto como
 * barras do comprimento real, o botão e o logótipo como contornos, cotas e
 * etiquetas técnicas minúsculas. Os contactos levam o ícone de cada canal —
 * WhatsApp, website — para se ver ONDE vai cada um.
 *
 * A geometria é a de `computeSketch`, a mesma que o gerador recebe. O verde
 * só marca a zona que acabou de mudar com um dos controlos.
 * ──────────────────────────────────────────────────────────────────────────
 */

const ICONS: Record<ContactType, LucideIcon> = {
  whatsapp: MessageCircle,
  telefone: Phone,
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  website: Globe,
  endereco: MapPin,
};

const SUBJECT_TAG: Record<ProtagonistKind, string> = {
  pessoa: 'Pessoa',
  produto: 'Produto',
  dispositivo: 'Dispositivo',
  cena: 'Cena',
  tipografia: 'Tipografia',
};

// A linguagem da planta: as cores da interface, nunca as da marca.
const LINE = 'rgb(162 173 164 / 0.55)';
const GUIDE = 'rgb(162 173 164 / 0.26)';
const BAR = '#3A463D';
const BAR_STRONG = '#56645A';

export function ReviewBlueprint({
  composition,
  brand,
  assets,
}: {
  composition: Composition;
  brand: Brand;
  assets: Record<string, ResolvedAsset | undefined>;
}) {
  const fontsReady = useArtFonts([composition.fontDisplay, composition.fontBody]);
  const input = React.useMemo(
    () => sketchInputFor(composition, brand, assets),
    [composition, brand, assets],
  );
  // As fontes entram na conta: medir com a de reserva dava outras quebras.
  const sketch = React.useMemo<Sketch | null>(
    () => (fontsReady && input ? computeSketch(input) : null),
    [fontsReady, input],
  );

  const spec = getFormat(composition.format);
  const W = sketch?.width ?? spec.width;
  const H = sketch?.height ?? spec.height;
  const rows = Math.max(6, Math.round((12 * H) / W));

  /*
    O verde marca o que MUDOU com um controlo — a grelha, o logótipo, os
    contactos —, e não o que muda a escrever: cada letra do título piscava
    a zona inteira.
  */
  const arrangement: Arrangement = {
    grid: `${composition.direction?.layout ?? ''}|${composition.format}`,
    logo: `${composition.logo.show}|${composition.logo.placement}|${composition.logo.size}`,
    contacts: composition.contactsPlacement ?? 'texto',
  };
  const active = useChangedRoles(sketch, arrangement);

  const contacts = React.useMemo(
    () =>
      composition.contacts
        .filter((contact) => contact.value.trim())
        .map((contact) => ({
          type: contact.type,
          text: formatContactForArt(contact.type, contact.value),
        }))
        .filter((entry) => entry.text),
    [composition.contacts],
  );

  return (
    <figure className="flex flex-col gap-2">
      <div
        className="@container relative w-full overflow-hidden rounded-[6px] shadow-[0_22px_48px_-24px_rgba(0,0,0,0.95)] ring-1 ring-line-strong"
        style={{
          aspectRatio: `${W} / ${H}`,
          backgroundColor: '#0A0D0B',
          backgroundImage:
            'linear-gradient(to right, rgb(41 51 44 / 0.5) 1px, transparent 1px), linear-gradient(to bottom, rgb(41 51 44 / 0.5) 1px, transparent 1px)',
          backgroundSize: `calc(100% / 12) calc(100% / ${rows})`,
        }}
        role="img"
        aria-label={describeForReader(sketch, contacts.length)}
      >
        {sketch && input ? (
          <>
            <MarginGuide sketch={sketch} />
            {sketch.blocks.map((block) => (
              <Zone
                key={block.role}
                block={block}
                sketch={sketch}
                active={active.includes(block.role)}
                fonts={input.fonts}
                subject={composition.direction?.subject}
                contacts={contacts}
              />
            ))}
          </>
        ) : null}
        <Corners />
      </div>

      <figcaption className="flex items-baseline justify-between gap-3 px-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-fg-faint">
        <span>Planta da disposição</span>
        <span className="tabular-nums">
          {W} × {H}
        </span>
      </figcaption>
    </figure>
  );
}

/** Os controlos da disposição, cada um pela parte da planta que mexe. */
type Arrangement = { grid: string; logo: string; contacts: string };

/**
 * Os papéis que mudaram com o último controlo, durante um instante.
 *
 * Mudar o logótipo também empurra o texto uns píxeis — mas o que o cliente
 * mexeu foi o logótipo, e é isso que se marca. Só a grelha marca tudo o que
 * mudou de sítio.
 */
function useChangedRoles(sketch: Sketch | null, arrangement: Arrangement): SketchRole[] {
  const [active, setActive] = React.useState<SketchRole[]>([]);
  const geometry = React.useRef<Map<SketchRole, string>>(new Map());
  const last = React.useRef<Arrangement | null>(null);
  const { grid, logo, contacts } = arrangement;

  React.useEffect(() => {
    if (!sketch) return;
    const now = new Map(
      sketch.blocks.map((block) => [
        block.role,
        [block.x, block.y, block.w, block.h].map((value) => Math.round(value)).join(','),
      ]),
    );
    const before = geometry.current;
    const previous = last.current;
    geometry.current = now;
    last.current = { grid, logo, contacts };
    if (!previous) return;

    const moved = [...now.entries()]
      .filter(([role, key]) => before.get(role) !== key)
      .map(([role]) => role);
    const changed =
      previous.grid !== grid
        ? moved
        : previous.logo !== logo
          ? moved.filter((role) => role === 'logotipo')
          : previous.contacts !== contacts
            ? moved.filter((role) => role === 'contactos')
            : [];
    if (changed.length === 0) return;
    setActive(changed);
    const timer = window.setTimeout(() => setActive([]), 1200);
    return () => window.clearTimeout(timer);
  }, [sketch, grid, logo, contacts]);

  return active;
}

function pct(value: number, total: number): string {
  return `${(value / total) * 100}%`;
}

/** A margem do conteúdo, tracejada, com a cota no canto. */
function MarginGuide({ sketch }: { sketch: Sketch }) {
  const { width: W, height: H, margin } = sketch;
  const share = Math.round((margin / Math.min(W, H)) * 100);
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute rounded-[2px] border border-dashed"
        style={{
          left: pct(margin, W),
          right: pct(margin, W),
          top: pct(margin, H),
          bottom: pct(margin, H),
          borderColor: GUIDE,
        }}
      />
      {/* Cota da margem: da aresta à guia, a meio da faixa de cima. */}
      <span
        aria-hidden
        className="pointer-events-none absolute h-px @max-[220px]:hidden"
        style={{ left: 0, width: pct(margin, W), top: pct(margin / 2, H), background: LINE }}
      >
        <span className="absolute -top-[3px] left-0 h-[7px] w-px" style={{ background: LINE }} />
        <span className="absolute -top-[3px] right-0 h-[7px] w-px" style={{ background: LINE }} />
      </span>
      <Tag
        className="@max-[220px]:hidden"
        style={{ left: pct(margin + 6, W), top: pct(margin / 2, H), transform: 'translateY(-50%)' }}
      >
        Margem {share}%
      </Tag>
    </>
  );
}

/** Marcas de canto, como numa folha de desenho. */
function Corners() {
  const base = 'pointer-events-none absolute size-[9px]';
  const color = { borderColor: 'rgb(162 173 164 / 0.6)' };
  return (
    <>
      <span aria-hidden className={cn(base, 'left-1.5 top-1.5 border-l border-t')} style={color} />
      <span aria-hidden className={cn(base, 'right-1.5 top-1.5 border-r border-t')} style={color} />
      <span aria-hidden className={cn(base, 'bottom-1.5 left-1.5 border-b border-l')} style={color} />
      <span aria-hidden className={cn(base, 'bottom-1.5 right-1.5 border-b border-r')} style={color} />
    </>
  );
}

/** Etiqueta técnica: 9 px em qualquer tamanho, para continuar legível. */
function Tag({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute z-10 whitespace-nowrap rounded-[3px] px-1 py-[3px] font-mono text-[9px] uppercase leading-none tracking-[0.14em] text-[#A2ADA4]',
        className,
      )}
      style={{ background: 'rgb(10 13 11 / 0.88)', ...style }}
    >
      {children}
    </span>
  );
}

/** Uma zona da planta, na sua caixa. As medidas internas são relativas a ela. */
function Zone({
  block,
  sketch,
  active,
  fonts,
  subject,
  contacts,
}: {
  block: SketchBlock;
  sketch: Sketch;
  active: boolean;
  fonts: { display: string; body: string };
  subject: ProtagonistKind | undefined;
  contacts: Array<{ type: ContactType; text: string }>;
}) {
  const { width: W, height: H } = sketch;
  const box: React.CSSProperties = {
    left: pct(block.x, W),
    top: pct(block.y, H),
    width: pct(block.w, W),
    height: pct(block.h, H),
  };
  const moving =
    'absolute transition-[left,top,width,height] duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none';
  const highlight = active ? (
    <span
      aria-hidden
      className="pointer-events-none absolute -inset-[3px] rounded-[3px] outline outline-1 outline-neon animate-[kriar-rise_0.35s_var(--ease-out-soft)]"
    />
  ) : null;

  if (block.role === 'imagem') {
    return (
      <div
        className={cn(moving, 'rounded-[2px] border')}
        style={{
          ...box,
          borderColor: active ? 'transparent' : 'rgb(162 173 164 / 0.4)',
          backgroundColor: 'rgb(10 13 11 / 0.45)',
          backgroundImage:
            'repeating-linear-gradient(135deg, rgb(162 173 164 / 0.2) 0, rgb(162 173 164 / 0.2) 1px, transparent 1px, transparent 7px)',
        }}
      >
        {/* A cruz de centro: onde o protagonista assenta. */}
        <span aria-hidden className="absolute inset-y-0 left-1/2 w-px" style={{ background: 'rgb(162 173 164 / 0.45)' }} />
        <span aria-hidden className="absolute inset-x-0 top-1/2 h-px" style={{ background: 'rgb(162 173 164 / 0.45)' }} />
        {/* Do tamanho de uma cota, e não da zona: em percentagem saía uma elipse. */}
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border"
          style={{ borderColor: 'rgb(162 173 164 / 0.55)', background: '#0A0D0B' }}
        />
        <Tag className="left-1.5 top-1.5">Imagem{subject ? ` · ${SUBJECT_TAG[subject]}` : ''}</Tag>
        {highlight}
      </div>
    );
  }

  if (block.role === 'logotipo') {
    const atBottom = block.y > H / 2;
    const atRight = block.x + block.w / 2 > W * 0.6;
    const share = Math.round((block.w / W) * 100);
    return (
      <div className={moving} style={box}>
        <span
          aria-hidden
          className="absolute inset-0 rounded-[2px] border"
          style={{ borderColor: LINE, background: 'rgb(10 13 11 / 0.6)' }}
        />
        {/* O "X" de um elemento por colocar, como nas plantas. */}
        <svg
          aria-hidden
          className="absolute inset-0 size-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d="M0 0 L100 100 M100 0 L0 100"
            stroke="rgb(162 173 164 / 0.35)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            fill="none"
          />
        </svg>
        {/* Cota da largura, do lado de dentro da arte. */}
        <span
          aria-hidden
          className="absolute inset-x-0 h-px @max-[220px]:hidden"
          style={
            {
              [atBottom ? 'bottom' : 'top']: 'calc(100% + 5px)',
              background: LINE,
            } as React.CSSProperties
          }
        >
          <span className="absolute -top-[3px] left-0 h-[7px] w-px" style={{ background: LINE }} />
          <span className="absolute -top-[3px] right-0 h-[7px] w-px" style={{ background: LINE }} />
        </span>
        {/*
          A etiqueta ao lado, na faixa do logótipo: por baixo ficava em cima
          do título. Com os contactos no rodapé, ao lado é deles — sobe.
        */}
        {atBottom && sketch.contactsPlacement === 'rodape' ? (
          <Tag className="left-0 @max-[220px]:hidden" style={{ bottom: 'calc(100% + 11px)' }}>
            Logo · {share}%
          </Tag>
        ) : (
          <Tag
            className="top-1/2 -translate-y-1/2 @max-[220px]:hidden"
            style={atRight ? { right: 'calc(100% + 6px)' } : { left: 'calc(100% + 6px)' }}
          >
            Logo · {share}%
          </Tag>
        )}
        {highlight}
      </div>
    );
  }

  if (block.role === 'cta') {
    const fontSize = block.fontSize ?? 30;
    const text = block.lines?.[0] ?? '';
    const textWidth = Math.min(
      block.w * 0.8,
      measureLineWidth(text, fonts.body, block.weight ?? 600, fontSize),
    );
    return (
      <div
        className={cn(moving, 'rounded-full border')}
        style={{ ...box, borderColor: 'rgb(162 173 164 / 0.7)' }}
      >
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: pct(textWidth, block.w),
            height: pct(fontSize * 0.42, block.h),
            background: BAR_STRONG,
          }}
        />
        {highlight}
      </div>
    );
  }

  if (block.role === 'contactos') {
    return (
      <div className={moving} style={box}>
        <ContactLines block={block} sketch={sketch} family={fonts.body} contacts={contacts} />
        {highlight}
      </div>
    );
  }

  // Etiqueta, título, apoio e preço: uma barra por linha.
  const fontSize = block.fontSize ?? 30;
  const slot = (block.lineHeight ?? 1.2) * fontSize;
  const family = block.font === 'display' ? fonts.display : fonts.body;
  const thickness =
    block.role === 'titulo' ? 0.6 : block.role === 'preco' ? 0.56 : block.role === 'etiqueta' ? 0.5 : 0.42;
  const color = block.role === 'titulo' || block.role === 'preco' ? BAR_STRONG : BAR;

  return (
    <div
      className={cn(moving, block.role === 'etiqueta' && 'rounded-full border')}
      style={{ ...box, ...(block.role === 'etiqueta' ? { borderColor: LINE } : {}) }}
    >
      {(block.lines ?? []).map((line, index) => {
        const text = block.uppercase ? line.toLocaleUpperCase('pt-PT') : line;
        const measured = measureLineWidth(
          text,
          family,
          block.weight ?? 400,
          fontSize,
          block.tracking ?? 0,
        );
        const width =
          block.role === 'etiqueta' ? block.w * 0.7 : Math.min(block.w, Math.max(fontSize, measured));
        const height = fontSize * thickness;
        const left =
          block.role === 'etiqueta'
            ? (block.w - width) / 2
            : block.align === 'center'
              ? (block.w - width) / 2
              : block.align === 'right'
                ? block.w - width
                : 0;
        const top = index * slot + (slot - height) / 2;
        return (
          <span
            key={index}
            aria-hidden
            className="absolute rounded-[2px]"
            style={{
              left: pct(left, block.w),
              top: pct(top, block.h),
              width: pct(width, block.w),
              height: pct(height, block.h),
              background: color,
              opacity: block.role === 'apoio' ? 0.75 : 1,
            }}
          />
        );
      })}
      {highlight}
    </div>
  );
}

/**
 * As linhas de contactos: cada contacto com o ícone do canal e uma barra do
 * comprimento real do texto.
 *
 * O ícone ocupa o princípio do próprio contacto, e não espaço a mais: a
 * linha fica com a largura que o esboço do gerador lhe dá.
 */
function ContactLines({
  block,
  sketch,
  family,
  contacts,
}: {
  block: SketchBlock;
  sketch: Sketch;
  family: string;
  contacts: Array<{ type: ContactType; text: string }>;
}) {
  const fontSize = block.fontSize ?? 26;
  const weight = block.weight ?? 500;
  const slot = (block.lineHeight ?? 1.35) * fontSize;
  const gap = measureLineWidth(CONTACT_SEPARATOR, family, weight, fontSize);
  const used = new Set<number>();
  const iconSize = fontSize * 0.95;

  return (
    <>
      {(block.lines ?? []).map((line, lineIndex) => {
        const pieces = line.split(CONTACT_SEPARATOR).filter(Boolean);
        const widths = pieces.map((piece) => measureLineWidth(piece, family, weight, fontSize));
        const total = widths.reduce((sum, width) => sum + width, 0) + gap * (pieces.length - 1);
        const scale = total > block.w ? block.w / total : 1;
        let cursor =
          block.align === 'center'
            ? (block.w - total * scale) / 2
            : block.align === 'right'
              ? block.w - total * scale
              : 0;
        const top = lineIndex * slot;

        return pieces.map((piece, pieceIndex) => {
          const width = widths[pieceIndex] * scale;
          const at = cursor;
          cursor += width + gap * scale;
          const match = contacts.findIndex(
            (entry, index) => !used.has(index) && entry.text === piece,
          );
          if (match >= 0) used.add(match);
          const Icon = match >= 0 ? ICONS[contacts[match].type] : null;
          const barStart = Icon ? iconSize * 1.35 : 0;
          return (
            <React.Fragment key={`${lineIndex}-${pieceIndex}`}>
              {Icon ? (
                <Icon
                  aria-hidden
                  className="absolute text-[#A2ADA4]"
                  strokeWidth={2.2}
                  style={{
                    left: pct(at, block.w),
                    top: pct(top + (slot - iconSize) / 2, block.h),
                    width: `${(iconSize / sketch.width) * 100}cqw`,
                    height: `${(iconSize / sketch.width) * 100}cqw`,
                  }}
                />
              ) : null}
              <span
                aria-hidden
                className="absolute rounded-[2px]"
                style={{
                  left: pct(at + barStart, block.w),
                  top: pct(top + (slot - fontSize * 0.42) / 2, block.h),
                  width: pct(Math.max(fontSize, width - barStart), block.w),
                  height: pct(fontSize * 0.42, block.h),
                  background: BAR,
                }}
              />
            </React.Fragment>
          );
        });
      })}
    </>
  );
}

/** O que a planta mostra, dito a quem não a vê. */
function describeForReader(sketch: Sketch | null, contacts: number): string {
  if (!sketch) return 'Planta da disposição, a preparar.';
  const has = (role: SketchRole) => sketch.blocks.some((block) => block.role === role);
  const parts = [
    has('imagem') ? 'imagem protagonista' : null,
    has('titulo') ? 'título' : null,
    has('apoio') ? 'texto de apoio' : null,
    has('preco') ? 'preço' : null,
    has('cta') ? 'botão' : null,
    has('logotipo') ? 'logótipo' : null,
    contacts > 0 ? `${contacts} ${contacts === 1 ? 'contacto' : 'contactos'}` : null,
  ].filter(Boolean);
  return `Planta da disposição da arte, com ${parts.join(', ')}.`;
}
