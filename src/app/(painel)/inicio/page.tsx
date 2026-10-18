'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { EditorView } from '@/components/editor/EditorView';
import { Spinner } from '@/components/ui/primitives';
import { useEditor } from '@/store/editor';
import { useSession } from '@/store/session';

/**
 * Ecrã inicial: é o editor, já com a prévia à direita.
 *
 * Não há passo intermédio. Abre um rascunho em memória, o utilizador descreve
 * a publicação e vê a composição aparecer no mesmo ecrã.
 *
 * O rascunho só é gravado quando tiver conteúdo. Nesse momento o endereço
 * passa a `/editor/{id}`, por substituição e não por navegação — o histórico
 * do browser não fica com um passo morto, e o editor nem volta a montar
 * porque é o mesmo componente a desenhar.
 */
export default function InicioPage() {
  const router = useRouter();
  const { account, brand } = useSession();

  const project = useEditor((state) => state.project);
  const isDraft = useEditor((state) => state.isDraft);
  const startDraft = useEditor((state) => state.startDraft);

  const startedFor = React.useRef<string | null>(null);
  /*
    O rascunho que ESTA visita começou.

    Sem ele, o redireccionamento de baixo corria no mesmo instante que o
    `startDraft`, ainda com os valores do desenho anterior — o último
    projecto aberto, já gravado. "Criar" levava de volta a esse projecto; e,
    se ele tinha acabado de ser apagado, a um ecrã de erro ("Este projecto
    já não existe"), de onde cada novo "Criar" voltava a sair igual.
  */
  const [draftId, setDraftId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!account || !brand) return;
    // Clicar em "Criar" começa sempre um rascunho novo. Um rascunho com
    // conteúdo já foi gravado e já não está nesta rota. Mudar de empresa
    // também começa um: o rascunho de uma não pode ir parar à outra.
    const key = `${account.id}:${brand.id}`;
    if (startedFor.current === key) {
      // A mesma empresa, com a marca actualizada (uma arte aprovada para a
      // biblioteca, por exemplo): o editor fica com a versão nova.
      useEditor.getState().setBrand(brand);
      return;
    }
    startedFor.current = key;
    startDraft(account.id, brand);
    setDraftId(useEditor.getState().project?.id ?? null);
  }, [account, brand, startDraft]);

  // Assim que o rascunho DESTA visita é gravado, o endereço passa a ser o dele.
  React.useEffect(() => {
    if (draftId && !isDraft && project?.id === draftId) router.replace(`/editor/${draftId}`);
  }, [draftId, isDraft, project?.id, router]);

  // Enquanto o editor ainda tem o projecto anterior, não o mostramos aqui.
  if (!account || !brand || !project || project.id !== draftId) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="A preparar…" />
      </div>
    );
  }

  return <EditorView brand={brand} />;
}
