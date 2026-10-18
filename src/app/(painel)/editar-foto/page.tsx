'use client';

import { PhotoEditor } from '@/components/photo/PhotoEditor';
import { Spinner } from '@/components/ui/primitives';
import { WorkspaceBackdrop } from '@/components/ui/WorkspaceBackdrop';
import { useSession } from '@/store/session';
import { usePageHeader } from '@/store/shell';

/**
 * Editar fotografia.
 *
 * A casca do painel já garante conta e marca prontas, mas o estreitamento
 * de tipos não atravessa a fronteira do componente: daí a guarda.
 *
 * O campo de pontos fica aqui, e não dentro do `PhotoEditor`: é fundo da
 * área de trabalho, e o editor de fotografias precisa de ser montável noutro
 * sítio (uma tela sem painel, por exemplo) sem levar o fundo atrás.
 */
export default function EditarFotoPage() {
  const { account, brand } = useSession();
  usePageHeader(['Editar foto']);

  if (!account || !brand) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="A carregar…" />
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden">
      <WorkspaceBackdrop pingEvery={4.6} />
      <div className="relative h-full">
        <PhotoEditor brand={brand} accountId={account.id} />
      </div>
    </div>
  );
}
