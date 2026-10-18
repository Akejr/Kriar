import { baseTone } from '@/lib/composition/base';
import type { ArtBase, Brand, BrandColors } from '@/lib/domain/types';

/**
 * Qual ficheiro do logótipo vai para a arte.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * A marca pode ter três ficheiros: o principal, uma versão para fundos
 * claros e uma versão para fundos escuros. Ia sempre o principal.
 *
 * Isso punha o gerador numa contradição sem saída. A DOT tem o logótipo em
 * azul-marinho e a cor dominante também é azul-marinho, por isso as artes
 * saem com fundo escuro — e o prompt dizia "não mudes a cor do logótipo".
 * Logótipo escuro, fundo escuro, cor proibida de mudar: o gerador resolvia
 * como podia, recolorindo-o e, pelo caminho, redesenhando-o.
 *
 * A cor de base da publicação é o melhor indicador que temos do fundo, e
 * é a que o prompt manda usar no fundo. Fundo provavelmente escuro → versão
 * para fundos escuros, se o cliente a carregou. Fundo claro → versão para
 * fundos claros. Sem a versão certa, vai o principal, e o prompt manda
 * assentá-lo numa zona que contraste com ele em vez de lhe mudar a cor.
 *
 * Usado na revisão (para mostrar qual vai) e na geração (para o enviar). Um
 * só sítio, para o que o cliente vê ser o que segue.
 * ──────────────────────────────────────────────────────────────────────────
 */

export type LogoChoice = {
  assetId: string;
  /** Qual dos ficheiros foi escolhido. */
  variant: 'principal' | 'fundo-claro' | 'fundo-escuro';
  /** Tom previsto do fundo da arte. */
  background: 'claro' | 'escuro';
};

/**
 * Tom previsto do fundo.
 *
 * Desde que cada publicação escolhe a sua cor de base (`base.ts`), é essa
 * cor que pinta o fundo — já não é sempre a principal. Uma publicação
 * "branca" de uma marca azul-marinho leva o logótipo para fundos claros.
 */
export function expectedBackground(
  colors: BrandColors,
  base: ArtBase = 'primaria',
): 'claro' | 'escuro' {
  return baseTone(colors, base);
}

export function pickLogo(
  brand: Brand,
  colors: BrandColors,
  base: ArtBase = 'primaria',
): LogoChoice | null {
  const identity = brand.identity;
  const background = expectedBackground(colors, base);

  if (background === 'escuro' && identity.logoForDarkBgAssetId) {
    return { assetId: identity.logoForDarkBgAssetId, variant: 'fundo-escuro', background };
  }
  if (background === 'claro' && identity.logoForLightBgAssetId) {
    return { assetId: identity.logoForLightBgAssetId, variant: 'fundo-claro', background };
  }
  if (identity.logoAssetId) {
    return { assetId: identity.logoAssetId, variant: 'principal', background };
  }
  return null;
}
