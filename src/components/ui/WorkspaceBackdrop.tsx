'use client';

import * as React from 'react';
import { SonarGrid } from './SonarGrid';

/**
 * Fundo das áreas de trabalho.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O campo de pontos verdes é a identidade da plataforma, e o sítio dele é a
 * área de TRABALHO: a lista de projectos, a marca, as definições, a revisão
 * e o estado vazio do editor.
 *
 * Não é o painel de controlo nem a barra de ícones. Esteve no `AppShell`, a
 * cobrir a área de conteúdo inteira, e ficava atrás da coluna de comandos do
 * editor — pontos animados por trás do pedido, das cores e do formato. Ruído
 * por trás de ferramentas.
 *
 * Este componente existe para a regra não depender de quem se lembra dela.
 * Quem acrescentar uma página de trabalho usa isto; quem acrescentar um
 * painel de comandos não.
 *
 * COMO FUNCIONA, porque não é óbvio: um filho com índice `z` negativo é
 * pintado depois do fundo do contexto de empilhamento a que pertence e antes
 * do conteúdo em fluxo. Sem o `isolate`, o contexto mais próximo seria a raiz
 * do documento e o fundo opaco da página pintava por cima — o campo
 * desaparecia por completo. Ver a secção 40 do DECISOES.
 *
 * O elemento que recebe este componente precisa de `relative`.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function WorkspaceBackdrop({
  /** Segundos entre pulsos. Variado entre ecrãs para não parecer sincronizado. */
  pingEvery = 4.4,
}: {
  pingEvery?: number;
}) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 isolate">
      <span className="absolute inset-0 -z-10">
        <SonarGrid
          className="size-full"
          // Há formulários e listas por cima: os eventos de ponteiro ficam
          // desligados e os pulsos são automáticos.
          interactive={false}
          pingArea={[0.06, 0.08, 0.94, 0.92]}
          // Discreto de propósito. Nestes ecrãs há texto a ler por cima.
          baseOpacity={0.12}
          dotRadius={1.4}
          pingEvery={pingEvery}
        />
        <span className="sonar-wash absolute inset-0" />
      </span>
    </span>
  );
}
