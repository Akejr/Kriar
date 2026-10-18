'use client';

import * as React from 'react';
import { getFont, primaryFamilyToken, resolveFontFamily, type FontId } from '@/lib/fontCatalog';
import { resetTextMeasurement } from '@/lib/composition/textLayout';

/**
 * Espera que as fontes da marca estejam realmente carregadas.
 *
 * Isto é indispensável: se medíssemos o texto com a fonte de reserva, as
 * quebras de linha seriam calculadas com larguras erradas e o resultado
 * mudaria quando a fonte certa chegasse. Ao limpar as caches de medição
 * depois do carregamento, garantimos que prévia e exportação usam as mesmas
 * medidas.
 */
export function useArtFonts(fontIds: FontId[]): boolean {
  const key = [...new Set(fontIds)].sort().join('|');
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setReady(false);

    async function run() {
      if (typeof document === 'undefined' || !document.fonts) {
        if (!cancelled) setReady(true);
        return;
      }

      const ids = key.split('|').filter(Boolean) as FontId[];
      const specs: string[] = [];
      for (const id of ids) {
        const family = primaryFamilyToken(resolveFontFamily(id));
        for (const weight of getFont(id).weights) {
          specs.push(`${weight} 64px ${family}`);
        }
      }

      await Promise.all(specs.map((spec) => document.fonts.load(spec).catch(() => undefined)));
      await document.fonts.ready;

      if (cancelled) return;
      resetTextMeasurement();
      setReady(true);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return ready;
}
