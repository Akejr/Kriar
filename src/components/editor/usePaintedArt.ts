'use client';

import * as React from 'react';
import {
  paintFinishedArtwork,
  type FinishedArtworkInput,
} from '@/lib/composition/finishArtwork';

/**
 * Pinta uma arte com o acabamento e devolve-a em data URL.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Vive num ficheiro próprio porque duas telas a mostram: a arte final do
 * editor e a arte instantânea. É sempre por aqui que uma arte gerada se
 * mostra ao cliente — nunca pelo ficheiro cru do gerador.
 *
 * A diferença não é cosmética. O gerador devolve outra proporção que a da
 * publicação (3:4 para um formato 4:5, por exemplo), e `paintFinishedArtwork`
 * é quem aplica o recorte da moldura. Mostrar o ficheiro cru mostrava faixas
 * que o ficheiro descarregado não tem — e foi assim que uma linha de
 * contactos cortada ao meio passou uma verificação.
 *
 * O resultado fica associado à entrada que o produziu: uma pintura antiga
 * nunca é mostrada como sendo da arte nova enquanto a nova se pinta.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function usePaintedArt(input: FinishedArtworkInput | null): {
  url: string | null;
  painting: boolean;
  problem: string | null;
} {
  const [state, setState] = React.useState<{
    input: FinishedArtworkInput;
    url: string | null;
    problem: string | null;
  } | null>(null);

  React.useEffect(() => {
    if (!input) return;
    let cancelled = false;
    paintFinishedArtwork(input)
      .then(({ canvas, missingImage, missingLogo }) => {
        if (cancelled) return;
        setState({
          input,
          url: canvas.toDataURL('image/jpeg', 0.92),
          problem: missingImage
            ? 'A arte gerada não carregou. Tenta gerar outra vez.'
            : missingLogo
              ? 'O ficheiro do logótipo não carregou e ficou de fora.'
              : null,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ input, url: null, problem: 'Não foi possível desenhar a arte.' });
      });
    return () => {
      cancelled = true;
    };
  }, [input]);

  const ready = Boolean(input && state && sameInput(state.input, input));
  return {
    url: ready ? (state?.url ?? null) : null,
    painting: Boolean(input) && !ready,
    problem: ready ? (state?.problem ?? null) : null,
  };
}

/** Duas entradas pintam a mesma imagem? */
function sameInput(a: FinishedArtworkInput, b: FinishedArtworkInput): boolean {
  return (
    a.src === b.src &&
    a.format === b.format &&
    (a.logo?.src ?? '') === (b.logo?.src ?? '') &&
    a.placement === b.placement &&
    a.size === b.size &&
    a.contactLine === b.contactLine &&
    a.fontFamily === b.fontFamily
  );
}
