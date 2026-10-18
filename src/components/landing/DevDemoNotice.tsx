import Link from 'next/link';
import { expectedFile, type DemoEntry } from '@/lib/landing/demos';

/**
 * Aviso de desenvolvimento: as artes de demonstração que faltam.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Só existe com `NODE_ENV` diferente de `production` (quem o decide é a
 * página). Fica num canto, fechado, e abre a lista dos ficheiros que o
 * manifesto (`src/lib/landing/demos.ts`) ainda tem a `null`, com a ligação
 * para ver a página como um visitante a veria em produção.
 *
 * É um `<details>`: abre e fecha com o teclado sem uma linha de JavaScript.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function DevDemoNotice({ missing, preview }: { missing: DemoEntry[]; preview: boolean }) {
  if (missing.length === 0 && !preview) return null;

  return (
    // À direita: o canto inferior esquerdo é do indicador de desenvolvimento do Next.
    <details className="group fixed bottom-4 right-4 z-[70] max-w-[min(26rem,calc(100vw-2rem))] rounded-[14px] bg-ink-900/95 text-[12px] text-fg-muted shadow-[0_24px_60px_-20px_rgba(0,0,0,0.95)] ring-1 ring-line-strong backdrop-blur-md">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[14px] px-3.5 py-2.5 font-medium text-fg [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="size-1.5 rounded-full bg-neon" />
        {preview
          ? 'Pré-visualização de produção'
          : `Desenvolvimento · ${missing.length} ${missing.length === 1 ? 'arte de demonstração em falta' : 'artes de demonstração em falta'}`}
        <span aria-hidden className="ml-auto text-fg-faint transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="max-h-[60vh] overflow-y-auto border-t border-line px-3.5 pb-3.5 pt-3">
        {preview ? (
          <p className="leading-relaxed">
            Estás a ver as regras de produção. Desde a arrumação das secções finais, a página só usa
            uma arte de demonstração (a miniatura da terceira vinheta de «Como funciona»), que fica
            como esboço até existir.{' '}
            <Link href="/" className="font-medium text-neon underline-offset-4 hover:underline">
              Voltar à vista de desenvolvimento
            </Link>
          </p>
        ) : (
          <>
            <p className="leading-relaxed">
              Gera cada arte na Kriar com o pedido indicado, descarrega o PNG, converte para WebP e
              actualiza a entrada em <code className="font-mono text-fg">src/lib/landing/demos.ts</code>
              . Os passos estão no topo desse ficheiro.
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {missing.map((entry) => (
                <li key={entry.id} className="rounded-[10px] bg-ink-950/70 px-2.5 py-2 ring-1 ring-line">
                  <code className="block break-all font-mono text-[11px] text-fg">{expectedFile(entry)}</code>
                  <span className="mt-1 block text-[11px] leading-snug text-fg-faint">«{entry.request}»</span>
                </li>
              ))}
            </ul>
            <p className="mt-3">
              <Link href="/?vista=producao" className="font-medium text-neon underline-offset-4 hover:underline">
                Ver como um visitante vê em produção
              </Link>
            </p>
          </>
        )}
      </div>
    </details>
  );
}
