'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { EditorView } from '@/components/editor/EditorView';
import { Spinner } from '@/components/ui/primitives';
import { getBackend } from '@/lib/data';
import { useEditor } from '@/store/editor';
import { useSession } from '@/store/session';

export default function EditorPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId;
  const { brand, brands, selectBrand } = useSession();
  const setBrand = useEditor((state) => state.setBrand);

  React.useEffect(() => {
    if (!projectId || !brand) return;

    // Vindo do ecrã de criação, o projecto já está na memória do editor e
    // acabou de ser gravado. Voltar a lê-lo do armazenamento provocaria um
    // piscar e podia apagar edições ainda não gravadas.
    const current = useEditor.getState();
    if (current.project?.id === projectId) {
      setBrand(brand);
      return;
    }

    /*
      A publicação pode ser de OUTRA empresa da conta.

      Uma ligação guardada, ou o histórico do browser, abre uma publicação
      da perfumaria com a loja de subscrições activa. Abri-la com a marca
      errada punha o logótipo e as cores de uma na arte da outra. A empresa
      dela passa a ser a activa, e o efeito volta a correr com a marca
      certa.
    */
    let cancelled = false;
    void (async () => {
      const stored = await getBackend()
        .getProject(projectId)
        .catch(() => null);
      if (cancelled) return;
      if (
        stored &&
        stored.brandId !== brand.id &&
        brands.some((entry) => entry.id === stored.brandId)
      ) {
        selectBrand(stored.brandId);
        return;
      }
      void useEditor.getState().load(projectId, brand);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, brand, brands, selectBrand, setBrand]);

  // Sem desmontagem do estado de propósito: ao navegar entre `/inicio` e
  // `/editor/{id}` o projecto tem de sobreviver, e uma gravação pendente
  // deve concluir-se mesmo depois de sair do ecrã.

  if (!brand || !projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="A carregar…" />
      </div>
    );
  }

  return <EditorView brand={brand} />;
}
