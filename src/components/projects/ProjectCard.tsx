'use client';

import * as React from 'react';
import Link from 'next/link';
import { Copy, Image as ImageIcon, Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { getFormat } from '@/lib/domain/catalog';
import type { Project } from '@/lib/domain/types';
import { cn } from '@/lib/utils/cn';
import { Badge, Button, IconButton } from '@/components/ui/primitives';

const STATUS_LABEL: Record<Project['status'], { label: string; tone: 'neutral' | 'info' | 'neon' }> =
  {
    rascunho: { label: 'Rascunho', tone: 'neutral' },
    composicao: { label: 'Composição pronta', tone: 'info' },
    'arte-final': { label: 'Arte final', tone: 'neon' },
  };

function relativeDate(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `há ${days} dia${days === 1 ? '' : 's'}`;
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Cartão de um projecto.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Renomear e eliminar acontecem AQUI, no próprio cartão.
 *
 * Abriam diálogos — e o diálogo aparecia colado ao canto do ecrã, longe do
 * cartão de onde a acção tinha partido. Mesmo centrado, um diálogo para
 * mudar uma palavra é desproporcionado: tapa a lista inteira para editar uma
 * linha dela.
 *
 *  · Renomear transforma o nome num campo, no mesmo sítio e com o mesmo
 *    tamanho de letra. Enter ou clicar fora guarda; Escape desfaz.
 *  · Eliminar cobre o cartão com a pergunta. Fica à vista o que se está a
 *    apagar, e a confirmação não se confunde com outro projecto.
 *
 * Houve também "duplo clique no nome renomeia". Saiu: o nome é a ligação
 * que abre o projecto, e o primeiro clique de um duplo clique abria-o — o
 * campo aparecia por um instante e a página mudava para o editor.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function ProjectCard({
  project,
  onRename,
  onDuplicate,
  onDelete,
}: {
  project: Project;
  onRename: (name: string) => Promise<void>;
  onDuplicate: () => void;
  onDelete: () => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  /** Para onde abre o menu, decidido no clique: para cima, salvo se faltar espaço. */
  const [menuUp, setMenuUp] = React.useState(true);
  const [mode, setMode] = React.useState<'idle' | 'renaming' | 'deleting'>('idle');
  const [busy, setBusy] = React.useState(false);
  const format = getFormat(project.composition.format);
  const status = STATUS_LABEL[project.status];
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  async function commitRename(name: string) {
    const next = name.replace(/\s+/g, ' ').trim();
    if (!next || next === project.name) {
      setMode('idle');
      return;
    }
    setBusy(true);
    try {
      await onRename(next);
      setMode('idle');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
      setMode('idle');
    }
  }

  return (
    /*
      Sem `overflow-hidden` no cartão: o menu de acções é posicionado a partir
      daqui e ficava recortado pela moldura. O arredondamento da miniatura vai
      no próprio elemento da miniatura, que é o único que precisa de recorte.

      Com o menu aberto o cartão sobe na pilha. Cartões irmãos declarados
      depois no DOM pintam por cima de um irmão só com `relative`, e o menu
      desaparecia atrás do cartão seguinte.
    */
    <article
      className={cn(
        'group relative flex flex-col rounded-[16px] border border-line bg-ink-900/90 transition-[border-color,transform,box-shadow] duration-200',
        'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_22px_50px_-28px_rgba(0,0,0,0.95)]',
        menuOpen && 'z-30',
        mode === 'deleting' && 'border-danger/40 hover:translate-y-0',
      )}
    >
      {/*
        Moldura IGUAL em todos os cartões, em 4:5 — o formato por omissão.

        A moldura seguia a proporção de cada publicação. Lado a lado, um
        cartão quadrado e um vertical tinham alturas diferentes, e a grelha
        esticava o mais baixo: ficava um vazio por baixo do estado, com ar de
        coisa por acabar. Agora a arte cabe inteira dentro da moldura
        (`object-contain`): uma 4:5 enche-a, as outras ganham faixas do mesmo
        tom — e todos os cartões acabam à mesma altura.
      */}
      <Link
        href={`/editor/${project.id}`}
        tabIndex={mode === 'idle' ? undefined : -1}
        className="relative block aspect-[4/5] overflow-hidden rounded-t-[15px] bg-ink-800"
      >
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={`Miniatura de ${project.name}`}
            className="absolute inset-0 size-full object-contain transition-transform duration-300 group-hover:scale-[1.015]"
            loading="lazy"
          />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-fg-faint">
            <ImageIcon className="size-5" aria-hidden />
            <span className="text-[12px]">Sem prévia ainda</span>
          </span>
        )}
      </Link>

      <div className="flex items-start gap-2 px-3.5 pb-3.5 pt-3">
        <div className="min-w-0 flex-1">
          {mode === 'renaming' ? (
            <RenameField
              initial={project.name}
              busy={busy}
              onCommit={(name) => void commitRename(name)}
              onCancel={() => setMode('idle')}
            />
          ) : (
            <Link
              href={`/editor/${project.id}`}
              // O nome completo, para quando o cartão o corta.
              title={project.name}
              // Altura fixa, igual à do campo de renomear: trocar um pelo
              // outro não pode fazer o cartão saltar.
              className="block h-5 truncate text-[14px] font-medium leading-5 text-fg transition-colors hover:text-neon"
            >
              {project.name}
            </Link>
          )}
          <p className="mt-1 truncate text-[12px] text-fg-muted">
            {format.platform} · {relativeDate(project.updatedAt)}
          </p>
          <div className="mt-2">
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <IconButton
            label={`Acções de ${project.name}`}
            size="sm"
            onClick={() => {
              /*
                Para cima, por cima da miniatura — salvo se o cartão estiver
                tão acima no ecrã que o menu (três linhas, cerca de 120 px)
                passaria por baixo da barra do topo. Medido no clique: a
                posição muda com a rolagem.
              */
              const top = menuRef.current?.getBoundingClientRect().top ?? Infinity;
              setMenuUp(top > 190);
              setMenuOpen((open) => !open);
            }}
            disabled={mode !== 'idle'}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </IconButton>

          {menuOpen ? (
            /*
              O menu abre PARA CIMA, por cima da miniatura.

              Abria para baixo, a partir do rodapé do cartão. Na última fila
              da grelha ficava fora do ecrã, e "Eliminar" — a última opção —
              só se alcançava a rolar. Por cima cabe sempre dentro do cartão:
              a miniatura tem pelo menos 270 px de altura, e o menu, três
              linhas. Só abre para baixo quando o cartão está quase no topo
              do ecrã (ver o clique).
            */
            <div
              role="menu"
              className={cn(
                'absolute right-0 z-20 w-44 overflow-hidden rounded-[12px] border border-line-strong bg-ink-800 p-1',
                menuUp ? 'bottom-full mb-1.5 origin-bottom-right' : 'top-8 origin-top-right',
                'shadow-[0_18px_44px_-14px_rgba(0,0,0,0.95)]',
                'animate-[kriar-rise_0.14s_var(--ease-out-soft)]',
              )}
            >
              <MenuItem
                icon={<Pencil className="size-3.5" aria-hidden />}
                label="Mudar o nome"
                onClick={() => {
                  setMenuOpen(false);
                  setMode('renaming');
                }}
              />
              <MenuItem
                icon={<Copy className="size-3.5" aria-hidden />}
                label="Duplicar"
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate();
                }}
              />
              <MenuItem
                icon={<Trash2 className="size-3.5" aria-hidden />}
                label="Eliminar"
                tone="danger"
                onClick={() => {
                  setMenuOpen(false);
                  setMode('deleting');
                }}
              />
            </div>
          ) : null}
        </div>
      </div>

      {mode === 'deleting' ? (
        <DeleteOverlay
          name={project.name}
          busy={busy}
          onCancel={() => setMode('idle')}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </article>
  );
}

/** O nome, transformado num campo no mesmo sítio. */
function RenameField({
  initial,
  busy,
  onCommit,
  onCancel,
}: {
  initial: string;
  busy: boolean;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = React.useState(initial);
  const ref = React.useRef<HTMLInputElement>(null);
  const settled = React.useRef(false);

  React.useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <div className="relative">
      <input
        ref={ref}
        value={draft}
        maxLength={80}
        disabled={busy}
        aria-label="Nome da publicação"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (settled.current) return;
          settled.current = true;
          onCommit(draft);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            settled.current = true;
            onCommit(draft);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            settled.current = true;
            onCancel();
          }
        }}
        // 28 px de caixa com 4 px negativos em cima e em baixo: ocupa os
        // mesmos 20 px do nome, e o fundo do campo respira à volta do texto.
        className="-mx-1.5 -my-1 block h-7 w-[calc(100%+0.75rem)] rounded-[8px] bg-ink-800 px-1.5 py-0 pr-7 text-[14px] font-medium leading-5 text-fg outline-none ring-1 ring-neon/50"
      />
      {busy ? (
        <Loader2
          className="pointer-events-none absolute right-0 top-1/2 size-3.5 -translate-y-1/2 animate-[kriar-spin_0.9s_linear_infinite] text-fg-faint"
          aria-hidden
        />
      ) : null}
    </div>
  );
}

/** A pergunta de eliminar, por cima do próprio cartão. */
function DeleteOverlay({
  name,
  busy,
  onCancel,
  onConfirm,
}: {
  name: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  // Foco em "Cancelar": num gesto que não se desfaz, o Enter distraído tem de
  // ser a resposta segura.
  React.useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div
      role="alertdialog"
      aria-label={`Eliminar ${name}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) onCancel();
      }}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-[16px] bg-ink-950/88 p-4 text-center backdrop-blur-sm animate-[kriar-rise_0.16s_var(--ease-out-soft)]"
    >
      <span className="grid size-10 place-items-center rounded-full bg-danger-900 text-danger ring-1 ring-danger/30">
        <Trash2 className="size-4" aria-hidden />
      </span>
      <div>
        <p className="text-[13.5px] font-semibold text-fg">Eliminar esta publicação?</p>
        <p className="mx-auto mt-1 max-w-[14rem] text-[12px] leading-relaxed text-fg-muted">
          <span className="text-fg">{name}</span> desaparece da lista. Não dá para desfazer.
        </p>
      </div>
      <div className="flex gap-2">
        <Button ref={cancelRef} variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="danger" size="sm" loading={busy} onClick={onConfirm}>
          Eliminar
        </Button>
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[12.5px] transition-colors',
        tone === 'danger'
          ? 'text-danger hover:bg-danger-900'
          : 'text-fg-muted hover:bg-ink-700 hover:text-fg',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
