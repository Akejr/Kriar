import * as React from 'react';
import type { LogoPlacement } from '@/lib/domain/types';
import { cn } from '@/lib/utils/cn';

/**
 * Esboço técnico de uma publicação, na linguagem de planta.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * É a mesma linguagem para onde está a ir o esboço da revisão da aplicação:
 * campo escuro com quadrícula fina, guias de margem tracejadas, a zona da
 * imagem com tracejado diagonal (o preenchimento de corte dos desenhos de
 * arquitectura), os textos como barras finas, o botão e o logótipo como
 * contornos, e etiquetas técnicas minúsculas. O verde só marca a zona que
 * acabou de mudar.
 *
 * Duas regras, para o esboço nunca se confundir com uma arte:
 *  · nenhum texto verdadeiro lá dentro — só os nomes das zonas;
 *  · nenhuma cor da marca — só os cinzentos da interface.
 *
 * Serve três sítios: o lugar das artes que ainda não foram geradas (com o
 * carimbo "Arte por gerar" ou "Demonstração"), o esboço pequeno da proposta
 * na demonstração do topo, e a planta que reage aos controlos na secção
 * "A IA propõe. Tu decides.". Sem estado: quem o usa decide o que mostra.
 *
 * As medidas são fracções da moldura, pelo que o desenho escala com o
 * contentor; as etiquetas não — ficam com 9 px em qualquer tamanho, que é o
 * que as mantém legíveis. Em tamanhos pequenos desligam-se com
 * `annotations={false}`.
 * ──────────────────────────────────────────────────────────────────────────
 */

export type BlueprintZone = 'titulo' | 'imagem' | 'botao' | 'logotipo' | 'contactos';

export type BlueprintProps = {
  /** Largura a dividir pela altura. 4:5 por omissão, como o formato vertical. */
  ratio?: number;
  /** Linhas do título. `0` desenha o título em falta. */
  titleLines?: 0 | 1 | 2 | 3;
  /** Linhas do texto de apoio. */
  supportLines?: 0 | 1;
  /** Forma do protagonista: um frasco alto ou um objecto largo. */
  imageShape?: 'alto' | 'largo';
  logo?: { show: boolean; placement: LogoPlacement };
  /** Quantos contactos aparecem na última linha. */
  contacts?: number;
  /** Mostrar o botão da chamada para acção. */
  button?: boolean;
  /** Zona realçada a verde: a que acabou de mudar. */
  active?: BlueprintZone | null;
  /** Etiquetas, cotas e marcas de canto. Desligar em tamanhos pequenos. */
  annotations?: boolean;
  /** Carimbo ao centro da zona da imagem. */
  stamp?: { title: string; detail?: string } | null;
  /** Etiqueta do formato, no canto inferior. */
  formatLabel?: string | null;
  className?: string;
  style?: React.CSSProperties;
  /** Sem rótulo, o esboço é decorativo e fica escondido dos leitores de ecrã. */
  label?: string;
};

type Box = { x: number; y: number; w: number; h: number };

const MARGIN = 0.08;

/** Barras do título: larguras alternadas, como linhas de texto reais. */
const TITLE_WIDTHS = [0.88, 0.64, 0.76];

const LOGO_X: Record<'esquerdo' | 'centro' | 'direito', number> = {
  esquerdo: 0,
  centro: 0.37,
  direito: 0.74,
};

function placementParts(placement: LogoPlacement): {
  row: 'superior' | 'inferior';
  col: 'esquerdo' | 'centro' | 'direito';
} {
  const [row, col] = placement.split('-') as ['superior' | 'inferior', 'esquerdo' | 'centro' | 'direito'];
  return { row, col };
}

/**
 * A geometria, em fracções da moldura.
 *
 * Calculada no "espaço de conteúdo" (dentro das margens) e convertida no
 * fim. A margem é 8% da LARGURA nos quatro lados — numa arte 4:5 isso dá
 * 6,4% da altura em cima e em baixo, que é o que a cota "8%" quer dizer.
 */
function layout(props: Required<Pick<BlueprintProps, 'ratio' | 'titleLines' | 'supportLines' | 'imageShape' | 'contacts' | 'button'>> & {
  logo: NonNullable<BlueprintProps['logo']>;
}) {
  const { ratio, titleLines, supportLines, imageShape, contacts, button, logo } = props;
  const mx = MARGIN;
  const my = Math.min(0.2, MARGIN * ratio);
  const toFrame = (box: Box): Box => ({
    x: mx + box.x * (1 - 2 * mx),
    y: my + box.y * (1 - 2 * my),
    w: box.w * (1 - 2 * mx),
    h: box.h * (1 - 2 * my),
  });

  const landscape = ratio > 1.25;
  const { row, col } = placementParts(logo.placement);

  if (landscape) {
    const logoBox: Box = {
      x: col === 'esquerdo' ? 0 : col === 'centro' ? 0.42 : 0.84,
      y: row === 'superior' ? 0 : 0.88,
      w: 0.16,
      h: 0.12,
    };
    const lineH = 0.1;
    const gap = 0.045;
    const titleTop = 0.24;
    const lines = Math.max(1, titleLines);
    const title = Array.from({ length: lines }, (_, index) => ({
      x: 0,
      y: titleTop + index * (lineH + gap),
      w: [0.44, 0.34, 0.4][index] ?? 0.4,
      h: lineH,
    }));
    const titleBottom = titleTop + lines * lineH + (lines - 1) * gap;
    const support = { x: 0, y: titleBottom + 0.06, w: 0.32, h: 0.045 };
    const buttonBox = { x: 0, y: Math.min(0.7, support.y + 0.14), w: 0.2, h: 0.11 };
    const contactsBox = { x: 0, y: 0.86, w: 0.46, h: 0.05 };
    const image =
      imageShape === 'alto'
        ? { x: 0.62, y: 0.06, w: 0.3, h: 0.88 }
        : { x: 0.52, y: 0.16, w: 0.48, h: 0.68 };
    return {
      landscape,
      mx,
      my,
      logo: toFrame(logoBox),
      title: title.map(toFrame),
      titleMissing: titleLines === 0,
      support: supportLines ? toFrame(support) : null,
      image: toFrame(image),
      button: button ? toFrame(buttonBox) : null,
      contacts: contacts > 0 ? toFrame(contactsBox) : null,
      align: 'left' as const,
    };
  }

  const logoBox: Box = {
    x: LOGO_X[col],
    y: row === 'superior' ? 0 : 1 - 0.062,
    w: 0.26,
    h: 0.062,
  };

  const lineH = 0.056;
  const gap = 0.022;
  const titleTop = 0.118;
  const lines = Math.max(1, titleLines);
  const title = Array.from({ length: lines }, (_, index) => {
    const w = TITLE_WIDTHS[index] ?? 0.7;
    return { x: (1 - w) / 2, y: titleTop + index * (lineH + gap), w, h: lineH };
  });
  const titleBottom = titleTop + lines * lineH + (lines - 1) * gap;

  const support = { x: 0.22, y: titleBottom + 0.03, w: 0.56, h: 0.024 };
  const imageTop = (supportLines ? support.y + support.h : titleBottom) + 0.045;
  const imageBottom = 0.765;
  const image =
    imageShape === 'alto'
      ? { x: 0.25, y: imageTop, w: 0.5, h: imageBottom - imageTop }
      : (() => {
          const h = Math.min(imageBottom - imageTop, 0.26);
          return { x: 0.07, y: imageTop + (imageBottom - imageTop - h) / 2, w: 0.86, h };
        })();
  const buttonBox = { x: 0.32, y: 0.8, w: 0.36, h: 0.058 };
  // A linha dos contactos é a última do bloco de texto, por baixo do botão.
  const contactsBox = { x: 0.12, y: 0.885, w: 0.76, h: 0.03 };

  return {
    landscape,
    mx,
    my,
    logo: toFrame(logoBox),
    title: title.map(toFrame),
    titleMissing: titleLines === 0,
    support: supportLines ? toFrame(support) : null,
    image: toFrame(image),
    button: button ? toFrame(buttonBox) : null,
    contacts: contacts > 0 ? toFrame(contactsBox) : null,
    align: 'center' as const,
  };
}

const pct = (value: number) => `${(value * 100).toFixed(3)}%`;

function place(box: Box): React.CSSProperties {
  return { left: pct(box.x), top: pct(box.y), width: pct(box.w), height: pct(box.h) };
}

/** A caixa que envolve várias caixas, com folga. */
function union(boxes: Box[], pad = 0.012): Box {
  const x0 = Math.min(...boxes.map((box) => box.x)) - pad;
  const y0 = Math.min(...boxes.map((box) => box.y)) - pad;
  const x1 = Math.max(...boxes.map((box) => box.x + box.w)) + pad;
  const y1 = Math.max(...boxes.map((box) => box.y + box.h)) + pad;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Etiqueta técnica: maiúsculas, espaçadas, em letra de máquina.
 *
 * `inline` para as que vivem dentro de uma zona (o botão, o logótipo, a
 * linha dos contactos) e seguem o fluxo dela; as outras são posicionadas.
 */
function Tag({
  children,
  className,
  style,
  inline = false,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  inline?: boolean;
}) {
  return (
    <span
      className={cn(
        'bp-tag pointer-events-none whitespace-nowrap font-mono text-[9px] uppercase leading-none tracking-[0.14em]',
        !inline && 'absolute',
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}

/** Contorno verde da zona activa, com as quatro marcas de canto. */
function ActiveFrame({ box, round }: { box: Box; round?: boolean }) {
  return (
    <span aria-hidden className={cn('bp-active absolute', round && 'rounded-full')} style={place(box)}>
      <span className="bp-mark left-[-2px] top-[-2px]" />
      <span className="bp-mark right-[-2px] top-[-2px]" />
      <span className="bp-mark bottom-[-2px] left-[-2px]" />
      <span className="bp-mark bottom-[-2px] right-[-2px]" />
    </span>
  );
}

export function Blueprint({
  ratio = 4 / 5,
  titleLines = 2,
  supportLines = 1,
  imageShape = 'alto',
  logo = { show: true, placement: 'superior-esquerdo' },
  contacts = 1,
  button = true,
  active = null,
  annotations = true,
  stamp = null,
  formatLabel = null,
  className,
  style,
  label,
}: BlueprintProps) {
  const geo = layout({ ratio, titleLines, supportLines, imageShape, contacts, button, logo });
  const titleBox = union(geo.title, 0.014);
  const rows = Math.max(6, Math.round(12 / ratio));
  const contactCount = Math.max(0, Math.min(3, contacts));

  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('bp-field relative isolate w-full overflow-hidden', className)}
      style={{ aspectRatio: `${ratio}`, ['--bp-rows' as string]: rows, ...style }}
    >
      {/* Guias de margem */}
      <span
        aria-hidden
        className="bp-guide absolute"
        style={{ left: pct(geo.mx), top: pct(geo.my), right: pct(geo.mx), bottom: pct(geo.my) }}
      />

      {/* Marcas de canto */}
      {annotations ? (
        <>
          <span aria-hidden className="bp-corner left-1.5 top-1.5 border-l border-t" />
          <span aria-hidden className="bp-corner right-1.5 top-1.5 border-r border-t" />
          <span aria-hidden className="bp-corner bottom-1.5 left-1.5 border-b border-l" />
          <span aria-hidden className="bp-corner bottom-1.5 right-1.5 border-b border-r" />
        </>
      ) : null}

      {/* Cota da margem: 8% da largura, na margem esquerda */}
      {annotations ? (
        <span aria-hidden className="absolute" style={{ left: 0, width: pct(geo.mx), top: geo.landscape ? '50%' : '52%' }}>
          <span className="bp-dim absolute inset-x-[2px] top-0" />
          <Tag className="bp-tag-faint left-1/2 -translate-x-1/2 -translate-y-[calc(100%+3px)]">8%</Tag>
        </span>
      ) : null}

      {/* Imagem protagonista */}
      <span
        aria-hidden
        className={cn('bp-hatch bp-move absolute rounded-[3px]', active === 'imagem' && 'bp-hatch-active')}
        style={place(geo.image)}
      >
        {annotations ? <Tag className="left-1.5 top-1.5 bp-chip">Imagem</Tag> : null}
        {annotations && !stamp ? (
          <span className="bp-cross absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2" />
        ) : null}
      </span>
      {active === 'imagem' ? <ActiveFrame box={geo.image} /> : null}

      {/* Título */}
      {geo.title.map((box, index) => (
        <span
          key={`t-${index}`}
          aria-hidden
          className={cn('bp-bar bp-move absolute rounded-full', geo.titleMissing && 'bp-bar-missing')}
          style={place(box)}
        />
      ))}
      {annotations ? (
        <Tag
          className="bp-move"
          style={{
            left: geo.align === 'center' ? pct(geo.mx) : pct(titleBox.x),
            top: `calc(${pct(titleBox.y)} - 11px)`,
          }}
        >
          {geo.titleMissing
            ? 'Título · em falta'
            : `Título · ${titleLines} ${titleLines === 1 ? 'linha' : 'linhas'}`}
        </Tag>
      ) : null}
      {active === 'titulo' ? <ActiveFrame box={titleBox} /> : null}

      {/* Texto de apoio */}
      {geo.support ? (
        <span aria-hidden className="bp-bar bp-bar-thin bp-move absolute rounded-full" style={place(geo.support)} />
      ) : null}

      {/* Botão */}
      {geo.button ? (
        <span aria-hidden className="bp-outline bp-move absolute grid place-items-center rounded-full" style={place(geo.button)}>
          {annotations ? <Tag inline>Botão</Tag> : null}
        </span>
      ) : null}
      {active === 'botao' && geo.button ? <ActiveFrame box={geo.button} round /> : null}

      {/* Logótipo */}
      <span
        aria-hidden
        className={cn(
          'bp-outline bp-move absolute grid place-items-center rounded-[3px]',
          !logo.show && 'bp-gone',
        )}
        style={place(geo.logo)}
      >
        {annotations ? <Tag inline className="text-[8px]">Logótipo</Tag> : null}
      </span>
      {active === 'logotipo' && logo.show ? <ActiveFrame box={geo.logo} /> : null}

      {/* Contactos: a linha aparece e desaparece com os interruptores */}
      <span
        aria-hidden
        className={cn(
          'bp-move absolute flex items-center gap-[6%]',
          geo.align === 'center' ? 'justify-center' : 'justify-start',
          !geo.contacts && 'bp-gone',
        )}
        style={place(
          geo.contacts ??
            // Sem contactos, a linha fica no sítio, invisível, para entrar e
            // sair com transição em vez de saltar.
            (geo.landscape
              ? { x: geo.mx, y: 0.86, w: 0.4, h: 0.04 }
              : { x: geo.mx + 0.12 * (1 - 2 * geo.mx), y: 0.86, w: 0.6, h: 0.026 }),
        )}
      >
        {annotations ? <Tag inline className="bp-tag-faint">Contactos</Tag> : null}
        {Array.from({ length: Math.max(1, contactCount) }, (_, index) => (
          <span key={`c-${index}`} className="flex h-full min-w-0 flex-1 items-center gap-[5%]" style={{ maxWidth: '30%' }}>
            <span className="bp-outline aspect-square h-full shrink-0 rounded-full" />
            <span className="bp-bar h-[55%] flex-1 rounded-full" />
          </span>
        ))}
      </span>
      {active === 'contactos' && geo.contacts ? <ActiveFrame box={union([geo.contacts], 0.01)} /> : null}

      {formatLabel && annotations ? (
        <Tag className="bp-tag-faint" style={{ right: pct(geo.mx), bottom: `calc(${pct(geo.my / 2)} - 4px)` }}>
          {formatLabel}
        </Tag>
      ) : null}

      {stamp ? (
        <span
          className="absolute grid place-items-center"
          style={{ ...place(geo.image), pointerEvents: 'none' }}
        >
          <span className="bp-stamp flex max-w-[90%] flex-col items-center gap-1 rounded-[8px] px-3 py-2 text-center">
            <span className="text-[11px] font-medium leading-tight text-fg">{stamp.title}</span>
            {/* O identificador inteiro, mesmo que parta: é o nome do ficheiro que falta. */}
            {stamp.detail ? (
              <span className="max-w-full break-all font-mono text-[9px] leading-tight tracking-[0.06em] text-fg-muted">
                {stamp.detail}
              </span>
            ) : null}
          </span>
        </span>
      ) : null}
    </div>
  );
}
