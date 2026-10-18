'use client';

import * as React from 'react';
import { ShieldCheck } from 'lucide-react';
import { analyseLogoColors } from '@/lib/brand/extractColors';
import { pickLogo } from '@/lib/brand/logoVariant';
import type { ResolvedAsset } from '@/lib/composition/resolve';
import type { ArtBase, Brand, Composition } from '@/lib/domain/types';
import { Switch } from '@/components/ui/primitives';
import { cn } from '@/lib/utils/cn';

// Com o artigo: "Usamos o ficheiro principal", "Usamos a versão…".
const VARIANT_LABEL = {
  principal: 'o ficheiro principal',
  'fundo-claro': 'a versão para fundos claros',
  'fundo-escuro': 'a versão para fundos escuros',
} as const;

/**
 * Tom dos píxeis do logótipo, lido no browser.
 *
 * `null` enquanto lê ou quando não consegue. A leitura é a mesma do cadastro
 * (`analyseLogoColors`), feita uma vez por ficheiro.
 */
function useLogoTone(url: string | undefined): 'claro' | 'escuro' | null {
  // Guardamos o URL com o resultado: um tom de outro ficheiro nunca é
  // mostrado como sendo deste, sem precisar de o limpar à mão.
  const [reading, setReading] = React.useState<{ url: string; tone: 'claro' | 'escuro' | null }>();

  React.useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then((response) => response.blob())
      .then(analyseLogoColors)
      .then((analysis) => {
        if (!cancelled) setReading({ url, tone: analysis.unreadable ? null : analysis.tone });
      })
      .catch(() => {
        if (!cancelled) setReading({ url, tone: null });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return reading && reading.url === url ? reading.tone : null;
}

/**
 * Logótipo na arte.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Um interruptor, e qual ficheiro vai.
 *
 * A posição e o tamanho voltaram, mas para a PLANTA (`ReviewDisposition`):
 * aqui eram listas soltas que o cliente escolhia às cegas; ao lado da
 * planta vê-se o efeito na hora. O "colar o meu ficheiro por cima" não
 * voltou — produzia um logótipo visivelmente colado sobre a arte.
 *
 * O que ficou é o que ele precisa de saber: QUAL ficheiro vai para a arte
 * (escolhido pelo tom da cor de base, ver `pickLogo`) e que o resultado é
 * verificado antes de lhe ser mostrado.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function ReviewLogo({
  logo,
  colors,
  base,
  brand,
  assets,
  onVisible,
}: {
  logo: Composition['logo'];
  colors: Composition['colors'];
  /** A cor de base da arte: decide o tom do fundo e, com ele, o ficheiro. */
  base: ArtBase;
  brand: Brand;
  assets: Record<string, ResolvedAsset | undefined>;
  onVisible: (visible: boolean) => void;
}) {
  const choice = pickLogo(brand, colors, base);
  const asset = choice ? assets[choice.assetId] : undefined;
  const tone = useLogoTone(asset?.url);

  /*
    A miniatura mostra o logótipo sobre a superfície onde ele vai assentar.

    Com uma versão própria para o fundo previsto, é esse fundo. Com o
    ficheiro principal, é a superfície que CONTRASTA com ele — porque é isso
    que o gerador recebe: "logótipo escuro, assenta numa zona clara". Antes
    mostrava sempre o fundo previsto, e um logótipo azul-marinho numa marca
    azul-marinho aparecia aqui como um quadrado preto vazio — exactamente o
    que a arte já não faz.
  */
  const surface: 'claro' | 'escuro' =
    choice && choice.variant !== 'principal'
      ? choice.background
      : tone === 'escuro'
        ? 'claro'
        : tone === 'claro'
          ? 'escuro'
          : (choice?.background ?? 'escuro');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <Switch
          checked={logo.show}
          onChange={onVisible}
          label="Mostrar logótipo"
          description={
            choice
              ? `Usamos ${VARIANT_LABEL[choice.variant]}.`
              : 'Ainda não há logótipo guardado na área Marca.'
          }
        />
        <span
          className={cn(
            // Mais largo do que alto: a maioria dos logótipos é horizontal, e
            // num quadrado de 56 px um logótipo de 3:1 ficava com 13 px.
            'grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded-[10px] ring-1 ring-line transition-colors',
            surface === 'claro' ? 'bg-[#F4F2EE]' : 'bg-[#101312]',
            !logo.show && 'opacity-35',
          )}
        >
          {asset?.url ? (
            <img src={asset.url} alt="" className="max-h-full max-w-full object-contain p-2" />
          ) : (
            <span className="text-[10px] text-fg-faint">sem logo</span>
          )}
        </span>
      </div>

      {/*
        Uma linha, e não um parágrafo: a revisão tinha texto a mais. A
        posição e o tamanho estão na planta, ao lado.
      */}
      {logo.show && choice ? (
        <p className="flex items-center gap-1.5 text-[10.5px] leading-snug text-fg-faint">
          <ShieldCheck className="size-3 shrink-0 text-neon/80" aria-hidden />
          Verificado depois de gerar: fiel e inteiro.
        </p>
      ) : null}
    </div>
  );
}
