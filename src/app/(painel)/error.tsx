'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/primitives';

/**
 * Um erro numa página do painel fica nessa página.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Não havia nenhuma fronteira de erro na aplicação. Um único erro ao
 * desenhar — o do botão "Acrescentar opção", que gravava o clique como nome
 * do produto — desmontava a árvore inteira, e o cliente ficava com um ecrã
 * em branco a dizer "Application error". Com este ficheiro, a barra lateral
 * e o topo continuam lá, e o cliente pode tentar de novo ou sair da página.
 *
 * O que estava gravado não se perde: a gravação automática corre fora do
 * desenho, e "Tentar de novo" volta a desenhar a mesma página.
 * ──────────────────────────────────────────────────────────────────────────
 */
export default function PainelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  React.useEffect(() => {
    // Na consola, para quem diagnostica. O cliente vê só a frase de baixo.
    console.error('[painel]', error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div role="alert" className="max-w-sm text-center">
        <span className="mx-auto grid size-10 place-items-center rounded-full bg-ink-800 text-fg-muted ring-1 ring-line">
          <AlertTriangle className="size-5" aria-hidden />
        </span>
        <h2 className="mt-4 text-[15px] font-semibold text-fg">Esta página encontrou um erro</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
          O que já estava guardado continua guardado. Tenta de novo; se o erro voltar, abre os
          projectos e entra outra vez na publicação.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button variant="primary" onClick={reset}>
            <RotateCcw className="size-4" aria-hidden />
            Tentar de novo
          </Button>
          {/* Um botão e não uma ligação com um botão dentro: um controlo dentro de outro não é HTML válido. */}
          <Button variant="outline" onClick={() => router.push('/projectos')}>
            Abrir os projectos
          </Button>
        </div>
      </div>
    </div>
  );
}
