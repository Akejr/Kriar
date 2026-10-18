'use client';

import * as React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// --- Botão ------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-neon text-ink-950 font-semibold hover:bg-neon-700 active:scale-[0.985] disabled:bg-neon/25 disabled:text-ink-950/50',
  secondary:
    'bg-ink-800 text-fg border border-line hover:border-line-strong hover:bg-ink-700 disabled:text-fg-faint',
  outline:
    'bg-transparent text-fg border border-line-strong hover:border-neon/50 hover:bg-neon/6 hover:text-neon disabled:text-fg-faint disabled:hover:border-line',
  ghost:
    'bg-transparent text-fg-muted hover:text-fg hover:bg-ink-800 disabled:text-fg-faint disabled:hover:bg-transparent',
  danger:
    'bg-danger-900 text-danger border border-danger/30 hover:bg-danger/15 disabled:opacity-50',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-[8px]',
  md: 'h-10 px-4 text-sm gap-2 rounded-[10px]',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-[12px]',
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Ocupa toda a largura disponível. */
  block?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, block, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap transition-all duration-200',
        'disabled:cursor-not-allowed disabled:active:scale-100',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 shrink-0 animate-[kriar-spin_0.9s_linear_infinite]" aria-hidden /> : null}
      {children}
    </button>
  );
});

// --- Botão de ícone ---------------------------------------------------------

export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Obrigatório: é o nome lido por leitores de ecrã. */
  label: string;
  active?: boolean;
  size?: 'sm' | 'md';
  tone?: 'default' | 'danger';
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, active, size = 'md', tone = 'default', className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={rest.type ?? 'button'}
        title={label}
        aria-label={label}
        aria-pressed={active === undefined ? undefined : active}
        className={cn(
          'inline-flex items-center justify-center rounded-[9px] border transition-colors duration-150',
          size === 'sm' ? 'size-7' : 'size-9',
          active
            ? 'border-neon/60 bg-neon/15 text-neon'
            : tone === 'danger'
              ? 'border-transparent text-fg-muted hover:border-danger/40 hover:bg-danger-900 hover:text-danger'
              : 'border-transparent text-fg-muted hover:border-line-strong hover:bg-ink-800 hover:text-fg',
          'disabled:cursor-not-allowed disabled:text-fg-faint disabled:hover:border-transparent disabled:hover:bg-transparent',
          className,
        )}
        {...rest}
      />
    );
  },
);

// --- Cartão -----------------------------------------------------------------

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-[16px] border border-line bg-ink-900', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
        {description ? (
          <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// --- Etiqueta ---------------------------------------------------------------

type BadgeTone = 'neutral' | 'neon' | 'warn' | 'danger' | 'info';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'border-line bg-ink-800 text-fg-muted',
  neon: 'border-neon/35 bg-neon/12 text-neon',
  warn: 'border-line-strong bg-ink-800 text-fg-muted',
  danger: 'border-line-strong bg-ink-800 text-fg-muted',
  info: 'border-line-strong bg-ink-800 text-fg-muted',
};

/**
 * Ponto de cor das etiquetas de estado.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Aviso, nota e erro eram pílulas pintadas por inteiro — fundo, borda e
 * texto no mesmo tom. Na barra do topo, "guardado só neste browser" em
 * âmbar era a coisa mais chamativa do ecrã, mais do que o botão de criar,
 * para dizer algo que não pede acção nenhuma.
 *
 * Ficaram neutras, como as outras, e o tom passou para um ponto de seis
 * píxeis com um halo discreto. O estado lê-se à primeira e a etiqueta deixa
 * de competir com o conteúdo. O texto fica em `fg-muted`, que sobre
 * `ink-800` passa largamente o contraste AA.
 *
 * A `neon` continua cheia de propósito: é a cor da Kriar e marca o que está
 * feito ("Design system", "integrado"). É a única que tem direito a brilhar.
 * ──────────────────────────────────────────────────────────────────────────
 */
const BADGE_DOT: Partial<Record<BadgeTone, string>> = {
  warn: 'bg-warn ring-2 ring-warn/15',
  danger: 'bg-danger ring-2 ring-danger/15',
  info: 'bg-info ring-2 ring-info/15',
};

/*
  Dois tamanhos, com as medidas todas aqui dentro.

  ────────────────────────────────────────────────────────────────────────────
  O `sm` existe para as etiquetas que vivem ao lado de um rótulo de 12 px —
  "fundo local" na nota de direcção visual, por exemplo. Com o tamanho normal
  a etiqueta ficava quase da altura do rótulo e disputava-lhe a leitura.

  Não se resolve com `className="text-[10px]"`: o `cn` desta casa só junta
  classes, não as funde, e duas utilidades de `font-size` na mesma lista
  ganham pela ordem do CSS gerado, não pela ordem em que foram escritas.
  ────────────────────────────────────────────────────────────────────────────
*/
const BADGE_SIZES = {
  md: {
    box: 'py-0.5 text-[11px]',
    dotted: 'gap-1.5 pl-1.5 pr-2',
    plain: 'gap-1 px-2',
    dot: 'size-1.5',
  },
  // No `sm` o ponto é pequeno de mais para pedir um lado mais curto.
  sm: {
    box: 'py-px text-[10px] leading-[14px]',
    dotted: 'gap-1 px-1.5',
    plain: 'gap-1 px-1.5',
    dot: 'size-[5px]',
  },
} as const;

export function Badge({
  children,
  tone = 'neutral',
  size = 'md',
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const dot = BADGE_DOT[tone];
  const measures = BADGE_SIZES[size];
  return (
    <span
      className={cn(
        // `whitespace-nowrap`: uma etiqueta é uma linha. Numa coluna estreita
        // partia em duas ("só nesta / publicação") e a pílula deformava-se;
        // assim quem cede é o texto ao lado, que pode quebrar sem estragar nada.
        'inline-flex items-center whitespace-nowrap rounded-full border font-medium tracking-wide',
        measures.box,
        // Com ponto, o lado esquerdo encolhe: o ponto já dá o respiro.
        dot ? measures.dotted : measures.plain,
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot ? (
        <span aria-hidden className={cn('shrink-0 rounded-full', measures.dot, dot)} />
      ) : null}
      {children}
    </span>
  );
}

// --- Indicador de carregamento ---------------------------------------------

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <Loader2
        aria-hidden
        className={cn('size-4 animate-[kriar-spin_0.9s_linear_infinite] text-fg-muted', className)}
      />
      {label ? <span className="text-[13px] text-fg-muted">{label}</span> : null}
    </span>
  );
}

// --- Campos -----------------------------------------------------------------

function useFieldId(provided?: string): string {
  const generated = React.useId();
  return provided ?? `campo-${generated.replace(/:/g, '')}`;
}

export function Field({
  label,
  hint,
  error,
  optional,
  children,
  htmlFor,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-[13px] font-medium text-fg">
        {label}
        {optional ? <span className="text-[11px] font-normal text-fg-faint">opcional</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12px] leading-relaxed text-fg-faint">{hint}</p>
      ) : null}
    </div>
  );
}

const CONTROL_BASE =
  'w-full rounded-[10px] border bg-ink-950/70 px-3 text-sm text-fg placeholder:text-fg-faint transition-colors duration-200 disabled:cursor-not-allowed disabled:text-fg-faint';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL_BASE,
        'h-10',
        invalid ? 'border-danger/60' : 'border-line hover:border-line-strong focus:border-neon/60',
        className,
      )}
      {...rest}
    />
  );
});

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL_BASE,
        'py-2.5 leading-relaxed resize-y min-h-20',
        invalid ? 'border-danger/60' : 'border-line hover:border-line-strong focus:border-neon/60',
        className,
      )}
      {...rest}
    />
  );
});

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          CONTROL_BASE,
          'h-10 appearance-none border-line pr-9 hover:border-line-strong focus:border-neon/60',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
});

// --- Interruptor ------------------------------------------------------------

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
  labelHidden = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  id?: string;
  /**
   * Esconde o rótulo do ecrã, mantendo-o para leitores de ecrã.
   *
   * Existe para quando o contexto já diz o que o interruptor faz — numa
   * linha que começa com "WhatsApp", repetir "Mostrar WhatsApp na arte" ao
   * lado do interruptor é redundante. E era pior do que redundante: em
   * colunas estreitas o texto transbordava para fora do cartão e
   * sobrepunha-se ao conteúdo vizinho.
   *
   * O rótulo NÃO é removido, é escondido. Um interruptor sem nome acessível
   * é um interruptor que ninguém com leitor de ecrã consegue usar.
   */
  labelHidden?: boolean;
}) {
  const controlId = useFieldId(id);
  return (
    <div className="flex min-w-0 items-start gap-3">
      <button
        id={controlId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors duration-150',
          checked ? 'border-neon/60 bg-neon/30' : 'border-line bg-ink-800',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute top-0.5 size-3.5 rounded-full transition-all duration-150',
            checked ? 'left-[18px] bg-neon' : 'left-0.5 bg-fg-faint',
          )}
        />
      </button>
      <label
        htmlFor={controlId}
        className={cn('min-w-0 select-none', labelHidden ? 'sr-only' : 'cursor-pointer')}
      >
        <span className="block text-[13px] font-medium text-fg">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[12px] leading-relaxed text-fg-muted">
            {description}
          </span>
        ) : null}
      </label>
    </div>
  );
}

// --- Selecção segmentada ----------------------------------------------------

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  columns = 2,
  className,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string; hint?: string; disabled?: boolean }>;
  label: string;
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  const gridClass = columns === 1 ? 'grid-cols-1' : columns === 3 ? 'grid-cols-3' : 'grid-cols-2';
  return (
    <div role="radiogroup" aria-label={label} className={cn('grid gap-2', gridClass, className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex flex-col items-start gap-0.5 rounded-[11px] border px-3 py-2.5 text-left transition-colors duration-150',
              selected
                ? 'border-neon/60 bg-neon/10'
                : 'border-line bg-ink-950 hover:border-line-strong hover:bg-ink-800',
              option.disabled && 'cursor-not-allowed opacity-45',
            )}
          >
            <span className={cn('text-[13px] font-medium', selected ? 'text-neon' : 'text-fg')}>
              {option.label}
            </span>
            {option.hint ? (
              <span className="text-[11px] leading-snug text-fg-muted">{option.hint}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// --- Estados ----------------------------------------------------------------

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-[16px] border border-dashed border-line px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? <div className="text-fg-faint">{icon}</div> : null}
      <div className="max-w-sm">
        <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
        {description ? (
          <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

// --- Avisos -----------------------------------------------------------------

export type NoticeTone = 'info' | 'warn' | 'danger' | 'neon';

/**
 * O tom de um aviso vive em dois sítios só: o chip do ícone e um traço de
 * 2 px na borda esquerda.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Os avisos eram blocos pintados — fundo âmbar escuro, borda âmbar e texto
 * âmbar. Num painel quase preto, um rectângulo amarelo inteiro grita mais do
 * que a acção principal do ecrã, e texto âmbar sobre âmbar escuro cansa a
 * leitura. A queixa do cliente foi literal: "amarelo todo feio sem nada a
 * condizer com o sistema".
 *
 * Agora a superfície é a dos painéis (`ink-800`, borda `line`, a linha de
 * luz `edge-top`) e o texto é o do resto da interface: título em `fg`,
 * corpo em `fg-muted`. A cor fica reduzida ao que chega para distinguir uma
 * nota de um aviso ou de um erro ao primeiro olhar — um ícone num chip
 * tingido e um traço fino. Âmbar e vermelho entram abafados, a 10 % no
 * chip e a meio no traço; só o ícone leva o tom quase inteiro, porque é
 * pequeno e é ele que se procura.
 * ──────────────────────────────────────────────────────────────────────────
 */
const NOTICE_TONES: Record<NoticeTone, { icon: LucideIcon; mark: string; bar: string }> = {
  info: { icon: Info, mark: 'bg-info/10 text-info/90 ring-info/20', bar: 'bg-info/40' },
  warn: { icon: AlertTriangle, mark: 'bg-warn/10 text-warn/90 ring-warn/20', bar: 'bg-warn/45' },
  danger: {
    icon: AlertCircle,
    mark: 'bg-danger/10 text-danger/90 ring-danger/25',
    bar: 'bg-danger/50',
  },
  neon: { icon: CheckCircle2, mark: 'bg-neon/10 text-neon ring-neon/25', bar: 'bg-neon/50' },
};

/**
 * O chip do ícone de um aviso.
 *
 * Exportado para as notificações (`Toast`) usarem exactamente o mesmo: um
 * aviso no painel e uma notificação no canto têm de parecer da mesma
 * família, não duas linguagens.
 */
export function NoticeMark({
  tone,
  icon,
  size = 'md',
  className,
}: {
  tone: NoticeTone;
  /** Substitui o ícone do tom. */
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const Icon = NOTICE_TONES[tone].icon;
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-[7px] ring-1 ring-inset',
        size === 'sm' ? 'size-5' : 'size-[22px]',
        NOTICE_TONES[tone].mark,
        className,
      )}
    >
      {icon ?? <Icon className={size === 'sm' ? 'size-[11px]' : 'size-3'} />}
    </span>
  );
}

/**
 * O traço de tom, encostado à borda esquerda.
 *
 * Afastado dos cantos (o recuo vertical vem em `className`) em vez de os
 * acompanhar: um traço curvo a seguir o raio lia-se como borda mal pintada.
 * O contentor tem de ser `relative`.
 */
export function NoticeBar({ tone, className }: { tone: NoticeTone; className: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute -left-px w-[2px] rounded-full',
        NOTICE_TONES[tone].bar,
        className,
      )}
    />
  );
}

/**
 * Aviso dentro de um painel.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O chip e o traço são posicionados em absoluto, com o espaço deles
 * reservado no recuo esquerdo. Não é preguiça de grelha: os filhos
 * continuam a ser filhos DIRECTOS do contentor, como antes. Há quem passe
 * `className="flex justify-between"` com um texto e um botão "Fechar" lá
 * dentro (a nota do editor) — embrulhar os filhos numa coluna própria
 * partia essas composições sem aviso.
 *
 * Só os erros são anunciados por omissão (`role="alert"`): aparecem depois
 * de uma acção falhar e quem usa leitor de ecrã tem de saber logo. Uma nota
 * ou um aviso estáticos a interromper a leitura seria ruído.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function Callout({
  tone = 'info',
  title,
  children,
  action,
  icon,
  size = 'md',
  role,
  className,
}: {
  tone?: NoticeTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** Botão ou ligação, por baixo do texto. */
  action?: React.ReactNode;
  /** Substitui o ícone do tom. */
  icon?: React.ReactNode;
  /** `sm` para colunas estreitas e diálogos: texto de 11,5 px. */
  size?: 'sm' | 'md';
  role?: React.AriaRole;
  className?: string;
}) {
  const compact = size === 'sm';
  return (
    <div
      role={role ?? (tone === 'danger' ? 'alert' : undefined)}
      className={cn(
        'edge-top relative border border-line bg-ink-800/80 leading-relaxed text-fg-muted',
        compact
          ? 'rounded-[10px] py-2.5 pl-10 pr-3 text-[11.5px]'
          : 'rounded-[12px] py-3 pl-11 pr-3.5 text-[12.5px]',
        className,
      )}
    >
      <NoticeBar tone={tone} className={compact ? 'inset-y-2.5' : 'inset-y-3'} />
      {/* Centrado na primeira linha de texto, seja ela o título ou o corpo. */}
      <NoticeMark
        tone={tone}
        icon={icon}
        size={compact ? 'sm' : 'md'}
        className={cn('absolute', compact ? 'left-2.5 top-[9px]' : 'left-3 top-[11px]')}
      />
      {title ? <p className="mb-0.5 font-semibold text-fg">{title}</p> : null}
      {children}
      {action ? <div className="mt-2.5">{action}</div> : null}
    </div>
  );
}

/** Separador com título, para agrupar secções no painel do editor. */
export function PanelSection({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('border-b border-line px-4 py-4 last:border-b-0', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}
