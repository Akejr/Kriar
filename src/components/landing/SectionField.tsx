import { SonarGrid } from '@/components/ui/SonarGrid';

/**
 * O fundo da primeira dobra — o campo de pontos verdes com pulsos —, para
 * as secções que o levam (secção sim, secção não).
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O mesmo desenho e a mesma contenção do topo: pontos a 13%, pulsos lentos,
 * sem resposta ao toque (por cima há texto e controlos, e um anel a cada
 * clique num campo de texto distraía). O véu escurece o centro, onde está o
 * texto, e funde o campo com o preto da página em cima e em baixo, para as
 * secções sem campo não começarem numa aresta.
 *
 * O `SonarGrid` adormece sem anéis vivos e pára fora do ecrã: com várias
 * secções assim, só a que está à vista desenha.
 *
 * A secção que o usa precisa de `relative isolate`: o campo fica em
 * `-z-10`, por trás do conteúdo dela e à frente do fundo da página.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function SectionField({
  pingArea,
}: {
  /** Onde nascem os pulsos, em fracções da secção: longe do texto mais denso. */
  pingArea: [number, number, number, number];
}) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <SonarGrid
        className="size-full"
        interactive={false}
        baseOpacity={0.13}
        dotRadius={1.3}
        spacing={28}
        amplitude={1.5}
        pingEvery={4.6}
        pingArea={pingArea}
      />
      <span className="lp-section-wash absolute inset-0" />
    </div>
  );
}
