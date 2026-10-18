'use client';

import * as React from 'react';

/**
 * Cabeçalho da aplicação.
 *
 * As páginas anunciam aqui o caminho de navegação e o estado de gravação, e a
 * casca desenha-os na barra do topo. Só passam valores simples — nunca nós de
 * React — para não acoplar a casca ao ciclo de render das páginas.
 *
 * A única excepção é a função de renomear, e é tratada à parte: vive numa
 * referência, registada uma vez, para uma função nova em cada render da
 * página não obrigar a casca a desenhar-se outra vez.
 */

export type ShellSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'erro';

/** O último elemento do caminho, quando é o nome editável da página. */
export type ShellEditable = {
  /** Valor com que o campo abre. Pode ser vazio. */
  value: string;
  placeholder: string;
};

type ShellValue = {
  crumbs: string[];
  saveState: ShellSaveState;
  editable: ShellEditable | null;
  renameLast: (name: string) => void;
  announce: (crumbs: string[], saveState: ShellSaveState, editable: ShellEditable | null) => void;
  registerRename: (handler: ((name: string) => void) | null) => void;
};

const ShellContext = React.createContext<ShellValue | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [crumbs, setCrumbs] = React.useState<string[]>([]);
  const [saveState, setSaveState] = React.useState<ShellSaveState>('idle');
  const [editable, setEditable] = React.useState<ShellEditable | null>(null);
  const renameRef = React.useRef<((name: string) => void) | null>(null);

  const announce = React.useCallback(
    (next: string[], state: ShellSaveState, nextEditable: ShellEditable | null) => {
      setCrumbs((current) =>
        current.length === next.length && current.every((value, index) => value === next[index])
          ? current
          : next,
      );
      setSaveState((current) => (current === state ? current : state));
      setEditable((current) =>
        current?.value === nextEditable?.value &&
        current?.placeholder === nextEditable?.placeholder &&
        Boolean(current) === Boolean(nextEditable)
          ? current
          : nextEditable,
      );
    },
    [],
  );

  const registerRename = React.useCallback((handler: ((name: string) => void) | null) => {
    renameRef.current = handler;
  }, []);

  const renameLast = React.useCallback((name: string) => {
    renameRef.current?.(name);
  }, []);

  const value = React.useMemo(
    () => ({ crumbs, saveState, editable, renameLast, announce, registerRename }),
    [crumbs, saveState, editable, renameLast, announce, registerRename],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellValue {
  const context = React.useContext(ShellContext);
  if (!context) throw new Error('useShell tem de ser usado dentro de <ShellProvider>.');
  return context;
}

/**
 * Declara o cabeçalho desta página.
 *
 * `crumbs` é comparado por conteúdo, por isso passar um array novo em cada
 * render não causa ciclos. Com `rename`, o último elemento do caminho passa
 * a ser um campo que edita o nome da página.
 */
export function usePageHeader(
  crumbs: string[],
  saveState: ShellSaveState = 'idle',
  options?: {
    rename?: { value: string; placeholder?: string; onCommit: (name: string) => void };
  },
): void {
  const { announce, registerRename } = useShell();
  const key = crumbs.join('\u0000');

  const rename = options?.rename;
  const enabled = Boolean(rename);
  const editValue = rename?.value ?? '';
  const editPlaceholder = rename?.placeholder ?? '';

  // A função mais recente, sem a pôr nas dependências: cada render da página
  // cria uma nova, e isso não deve redesenhar a casca.
  const handlerRef = React.useRef(rename?.onCommit);
  React.useEffect(() => {
    handlerRef.current = rename?.onCommit;
  });

  React.useEffect(() => {
    if (!enabled) return;
    registerRename((name) => handlerRef.current?.(name));
    return () => registerRename(null);
  }, [enabled, registerRename]);

  React.useEffect(() => {
    announce(
      key ? key.split('\u0000') : [],
      saveState,
      enabled ? { value: editValue, placeholder: editPlaceholder } : null,
    );
  }, [announce, key, saveState, enabled, editValue, editPlaceholder]);
}
