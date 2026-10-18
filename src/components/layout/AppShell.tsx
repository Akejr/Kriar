'use client';

import * as React from 'react';
import Link, { useLinkStatus } from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Check,
  ChevronDown,
  CloudOff,
  FolderOpen,
  Gem,
  Loader2,
  LogOut,
  Pencil,
  Settings,
  Wand2,
} from 'lucide-react';
import { APP } from '@/config/app';
import { isBrandReady } from '@/lib/domain/factories';
import { cn } from '@/lib/utils/cn';
import { Logo } from '@/components/ui/Logo';
import { Badge, Spinner } from '@/components/ui/primitives';
import { useSession } from '@/store/session';
import { ShellProvider, useShell, type ShellSaveState } from '@/store/shell';
import { CompanySwitcher } from './CompanySwitcher';

/**
 * `/inicio` é a tela de criação, por isso a etiqueta é "Criar". A rota
 * mantém-se para não quebrar ligações já existentes.
 *
 * Não há entrada para "Modelos": a biblioteca é interna. O cliente descreve
 * o que quer e o sistema escolhe o modelo — não há galeria para percorrer.
 *
 * `Definições` fica separada, no fundo da barra: é manutenção, não trabalho.
 */
const NAV = [
  { href: '/inicio', label: 'Criar', icon: Pencil },
  /*
    "Foto" e não "Editar foto": a etiqueta é desenhada a 10 px debaixo do
    ícone, e duas palavras partiam-se em duas linhas e desalinhavam este
    botão dos outros. O nome por extenso fica no caminho do topo.
  */
  { href: '/editar-foto', label: 'Foto', icon: Wand2 },
  { href: '/projectos', label: 'Projectos', icon: FolderOpen },
  { href: '/marca', label: 'Marca', icon: Gem },
] as const;

const FOOTER_NAV = [{ href: '/definicoes', label: 'Definições', icon: Settings }] as const;

/** Os elementos do caminho que levam a uma página. */
const CRUMB_ROUTES: Record<string, string> = {
  Projectos: '/projectos',
  Marca: '/marca',
  'Editar foto': '/editar-foto',
  Definições: '/definicoes',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ShellProvider>
      <ShellFrame>{children}</ShellFrame>
    </ShellProvider>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, account, brand, storage, integrations, signOut } = useSession();
  const { crumbs, saveState, editable, renameLast } = useShell();

  React.useEffect(() => {
    if (status === 'loading') return;
    if (status === 'anon') {
      router.replace('/entrar');
      return;
    }
    if (!isBrandReady(brand)) router.replace('/onboarding');
  }, [status, brand, router]);

  if (status !== 'authed' || !account || !isBrandReady(brand)) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label="A carregar…" />
      </div>
    );
  }

  /*
    O que falta configurar, dito pelo que significa.

    ────────────────────────────────────────────────────────────────────────
    Dizia "dados locais", e foi lido como "o teu cadastro não ficou
    guardado" — a pergunta foi exactamente essa: "porque ainda aparece
    'dados locais' se já fiz o cadastro?".

    O aviso estava certo: sem as variáveis do Supabase definidas, a conta, a
    marca e os projectos vivem no IndexedDB deste browser. Mas "dados
    locais" descreve a arquitectura, não a consequência, e a consequência é
    a única coisa que interessa a quem lê: isto não acompanha o cliente para
    outro computador.

    O cadastro ficou guardado. Só não ficou guardado num servidor.
    ────────────────────────────────────────────────────────────────────────
  */
  const demoParts = [
    storage === 'local' ? 'guardado só neste browser' : null,
    integrations && !integrations.text.configured ? 'textos sem IA' : null,
    integrations && !integrations.image.configured ? 'imagens sem IA' : null,
  ].filter(Boolean);

  return (
    <div className="flex h-dvh overflow-hidden bg-ink-950">
      {/* Barra de ícones */}
      <nav
        aria-label="Navegação principal"
        className="relative z-20 flex w-[4.25rem] shrink-0 flex-col items-center bg-ink-900/70 py-2.5"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-line-strong to-transparent"
        />

        <div className="flex flex-1 flex-col items-center gap-1">
          {NAV.map((item) => (
            <RailLink key={item.href} {...item} active={pathname === item.href} />
          ))}
        </div>

        <div className="flex flex-col items-center gap-1">
          {FOOTER_NAV.map((item) => (
            <RailLink key={item.href} {...item} active={pathname === item.href} />
          ))}
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra do topo */}
        <header className="relative z-10 flex h-10 shrink-0 items-center gap-3 px-3.5">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-line to-transparent"
          />

          <Link
            href="/inicio"
            aria-label={`${APP.name} — ir para o início`}
            className="flex shrink-0 items-center rounded-md px-0.5 py-1"
          >
            <Logo variant="wordmark" height={17} />
          </Link>

          {/* A empresa activa: o ambiente de trabalho de tudo o que está abaixo. */}
          <span aria-hidden className="text-fg-faint">
            /
          </span>
          <CompanySwitcher />

          {crumbs.length > 0 ? (
            <nav aria-label="Caminho" className="flex min-w-0 items-center gap-1.5">
              <span aria-hidden className="text-fg-faint">
                /
              </span>
              {crumbs.map((crumb, index) => {
                const last = index === crumbs.length - 1;
                const href = CRUMB_ROUTES[crumb];

                return (
                  <React.Fragment key={`${crumb}-${index}`}>
                    {index > 0 ? (
                      <span aria-hidden className="shrink-0 text-fg-faint">
                        /
                      </span>
                    ) : null}

                    {last && editable ? (
                      <EditableCrumb
                        label={crumb}
                        value={editable.value}
                        placeholder={editable.placeholder}
                        onCommit={renameLast}
                      />
                    ) : !last && href ? (
                      // Um caminho onde só o último elemento não é clicável
                      // é o que toda a gente espera de um caminho.
                      <Link
                        href={href}
                        className="truncate rounded-[6px] text-[12.5px] text-fg-muted transition-colors hover:text-fg"
                      >
                        {crumb}
                      </Link>
                    ) : (
                      <span
                        className={cn(
                          'truncate text-[12.5px]',
                          last ? 'text-fg' : 'text-fg-muted',
                        )}
                      >
                        {crumb}
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-3">
            {demoParts.length > 0 ? (
              /*
                Pílula neutra com um ponto âmbar, não uma pílula âmbar.

                Era a peça mais chamativa da barra — fundo, borda e texto
                amarelos — para dar uma informação que não pede acção
                imediata. O ponto chega para dizer "há aqui uma ressalva";
                o pormenor está no `title` e nas Definições.
              */
              <Link
                href="/definicoes"
                className="group hidden rounded-full xl:block"
                // O rótulo é curto por força; a explicação vive aqui.
                title={
                  storage === 'local'
                    ? 'A tua conta, a marca e os projectos estão guardados neste browser, não num servidor. Não se perdem, mas também não te acompanham para outro computador. Abre as Definições para ligar a base de dados.'
                    : 'Falta configurar uma chave de IA. Abre as Definições.'
                }
              >
                <Badge
                  tone="warn"
                  className="transition-colors group-hover:bg-ink-700 group-hover:text-fg"
                >
                  {demoParts.join(' · ')}
                </Badge>
              </Link>
            ) : null}

            <SaveBadge state={saveState} />

            <AccountMenu
              name={account.name}
              email={account.email}
              onSignOut={async () => {
                await signOut();
                router.replace('/entrar');
              }}
            />
          </div>
        </header>

        {/*
          O campo de pontos NÃO vive aqui.

          ────────────────────────────────────────────────────────────────────
          Esteve: um `SonarGrid` nesta área de conteúdo cobria todas as
          páginas do painel de uma vez, o que parecia a solução económica.

          Ficou mau. A área de conteúdo inclui o painel de controlo do editor
          — o pedido, as cores, o formato, o estilo — e um campo de pontos
          animado atrás de uma coluna de comandos é ruído por trás de
          ferramentas. Um fundo decorativo pertence à ÁREA DE TRABALHO, onde
          não compete com nada.

          Cada superfície de trabalho põe o seu: a revisão, o estado vazio do
          editor, os projectos, a marca e as definições. O painel de controlo
          e a barra de ícones ficam limpos.
          ────────────────────────────────────────────────────────────────────
        */}
        <main id="conteudo" className="min-h-0 flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * O nome da página, editável no próprio caminho.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Parece texto até o rato chegar: aí ganha um fundo discreto e um lápis. Um
 * clique transforma-o num campo do mesmo tamanho de letra, no mesmo sítio —
 * sem diálogo, sem página nova.
 *
 * Enter ou clicar fora guarda; Escape desfaz. O campo cresce com o que se
 * escreve, porque um campo de largura fixa ou corta o nome ou deixa um vazio
 * à direita.
 * ──────────────────────────────────────────────────────────────────────────
 */
function EditableCrumb({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder: string;
  onCommit: (name: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cancelled = React.useRef(false);

  React.useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  function start() {
    setDraft(value);
    cancelled.current = false;
    setEditing(true);
  }

  function finish() {
    setEditing(false);
    if (cancelled.current) return;
    const next = draft.replace(/\s+/g, ' ').trim();
    // Vazio não apaga o nome: desistir de escrever é igual a cancelar.
    if (next && next !== value) onCommit(next);
  }

  if (editing) {
    return (
      <span className="relative inline-grid min-w-[7rem] max-w-[min(26rem,45vw)] items-center">
        {/* Espelho invisível: dá ao campo a largura exacta do texto. */}
        <span
          aria-hidden
          className="invisible col-start-1 row-start-1 overflow-hidden whitespace-pre px-2 text-[12.5px] font-medium"
        >
          {draft || placeholder || ' '}
        </span>
        <input
          ref={inputRef}
          value={draft}
          maxLength={80}
          aria-label="Nome da publicação"
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={finish}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              cancelled.current = true;
              event.currentTarget.blur();
            }
          }}
          className="col-start-1 row-start-1 w-full min-w-0 rounded-[7px] bg-ink-800 px-2 py-0.5 text-[12.5px] font-medium text-fg outline-none ring-1 ring-neon/50 placeholder:font-normal placeholder:text-fg-faint"
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      title="Clica para mudar o nome"
      aria-label={`${label}. Clica para mudar o nome`}
      className="group/crumb -mx-2 inline-flex min-w-0 max-w-[min(26rem,45vw)] items-center gap-1.5 rounded-[7px] px-2 py-0.5 text-[12.5px] font-medium text-fg transition-colors hover:bg-ink-800 focus-visible:bg-ink-800 focus-visible:outline-none"
    >
      <span className="truncate">{label}</span>
      <Pencil
        className="size-3 shrink-0 text-fg-faint opacity-0 transition-opacity group-hover/crumb:opacity-100 group-focus-visible/crumb:opacity-100"
        aria-hidden
      />
    </button>
  );
}

function RailLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  // O corpo vive num componente próprio porque `useLinkStatus` só funciona
  // dentro da árvore de um `Link`.
  return (
    <Link href={href} aria-current={active ? 'page' : undefined} className="block rounded-[11px]">
      <RailLinkBody icon={Icon} label={label} active={active} />
    </Link>
  );
}

/**
 * Corpo do botão da barra de navegação.
 *
 * `useLinkStatus` dá o estado de carregamento da rota seguinte. Usamo-lo para
 * destacar o botão no instante do clique, em vez de esperar que a página nova
 * renderize: o destaque vem de `usePathname()`, que só muda no fim.
 */
function RailLinkBody({
  label,
  icon: Icon,
  active,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  const { pending } = useLinkStatus();
  const highlighted = active || pending;

  return (
    <span
      aria-busy={pending || undefined}
      className={cn(
        'group relative flex w-[3.4rem] flex-col items-center gap-1 overflow-hidden rounded-[11px] py-2 transition-colors duration-150',
        highlighted ? 'bg-neon/10 text-neon' : 'text-fg-faint hover:bg-ink-800 hover:text-fg',
      )}
    >
      <Icon className="size-[1.05rem]" />
      <span className="text-[10px] font-medium leading-none">{label}</span>

      {pending ? (
        <span
          aria-hidden
          className="absolute inset-x-1.5 bottom-[3px] h-[2px] overflow-hidden rounded-full bg-neon/20"
        >
          <span className="kriar-progress block h-full w-1/3 rounded-full bg-neon animate-[kriar-slide_0.75s_ease-in-out_infinite]" />
        </span>
      ) : null}
    </span>
  );
}

function SaveBadge({ state }: { state: ShellSaveState }) {
  if (state === 'idle') return null;

  const map: Record<Exclude<ShellSaveState, 'idle'>, { label: string; node: React.ReactNode }> = {
    saving: {
      label: 'A guardar…',
      node: <Loader2 className="size-3 animate-[kriar-spin_0.9s_linear_infinite]" aria-hidden />,
    },
    saved: { label: 'Guardado', node: <Check className="size-3 text-neon" aria-hidden /> },
    dirty: { label: 'Não guardado', node: null },
    erro: {
      label: 'Falha ao guardar',
      node: <CloudOff className="size-3 text-danger" aria-hidden />,
    },
  };

  const entry = map[state];
  return (
    <span
      aria-live="polite"
      className={cn(
        'flex items-center gap-1.5 whitespace-nowrap text-[11.5px]',
        state === 'erro' ? 'text-danger' : 'text-fg-muted',
      )}
    >
      {entry.node}
      <span className="hidden sm:inline">{entry.label}</span>
    </span>
  );
}

function AccountMenu({
  name,
  email,
  onSignOut,
}: {
  name: string;
  email: string;
  onSignOut: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('pt-PT') ?? '')
    .join('');

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-1 transition-colors hover:bg-ink-800"
      >
        <span className="grid size-6 place-items-center rounded-full bg-ink-700 text-[10px] font-semibold text-fg">
          {initials || '•'}
        </span>
        <span className="hidden max-w-[8rem] truncate text-[12px] text-fg-muted lg:inline">
          {name}
        </span>
        <ChevronDown className="size-3 text-fg-faint" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-8 z-40 w-56 overflow-hidden rounded-[12px] bg-ink-800 py-1 shadow-[0_20px_50px_-18px_rgba(0,0,0,0.95)] ring-1 ring-line-strong animate-[kriar-rise_0.14s_var(--ease-out-soft)]"
        >
          <div className="px-3 py-2">
            <p className="truncate text-[12.5px] font-medium text-fg">{name}</p>
            <p className="truncate text-[11px] text-fg-faint">{email}</p>
          </div>
          <span aria-hidden className="block h-px bg-line" />
          <Link
            href="/definicoes"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-fg-muted transition-colors hover:bg-ink-700 hover:text-fg"
          >
            <Settings className="size-3.5" aria-hidden />
            Definições
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={onSignOut}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-fg-muted transition-colors hover:bg-ink-700 hover:text-fg"
          >
            <LogOut className="size-3.5" aria-hidden />
            Terminar sessão
          </button>
        </div>
      ) : null}
    </div>
  );
}
