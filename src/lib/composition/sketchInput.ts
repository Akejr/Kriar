/**
 * A entrada do esboço a partir da composição.
 *
 * Num só sítio porque dois leitores têm de ver o MESMO esboço: a revisão,
 * que o mostra ao cliente, e a geração, que o envia ao gerador. Duas contas
 * diferentes davam um esboço aprovado e outro enviado.
 */
import { pickLogo } from '@/lib/brand/logoVariant';
import { formatContactForArt } from '@/lib/domain/catalog';
import type { Brand, Composition } from '@/lib/domain/types';
import { resolveFontFamily } from '@/lib/fontCatalog';
import { defaultLayoutFor, isLogoSize } from './layouts';
import type { ResolvedAsset } from './resolve';
import type { SketchInput } from './sketch';

export function sketchInputFor(
  composition: Composition,
  brand: Brand,
  assets: Record<string, ResolvedAsset | undefined>,
): SketchInput | null {
  const direction = composition.direction;
  if (!direction) return null;

  const choice = composition.logo.show
    ? pickLogo(brand, composition.colors, composition.base ?? 'primaria')
    : null;
  const asset = choice ? assets[choice.assetId] : undefined;
  const ratio = asset?.width && asset?.height ? asset.width / asset.height : 3;
  const text = (role: keyof Composition['texts']) => composition.texts[role]?.value.trim() ?? '';

  return {
    format: composition.format,
    layout: direction.layout ?? defaultLayoutFor(direction.approach),
    logo: choice
      ? {
          placement: composition.logo.placement,
          ratio,
          size: isLogoSize(composition.logo.size) ? composition.logo.size : 'pequeno',
        }
      : null,
    texts: {
      badge: text('badge'),
      headline: text('headline'),
      subheadline: text('subheadline'),
      price: text('price'),
      cta: text('cta'),
    },
    contacts: composition.contacts
      .filter((contact) => contact.value.trim())
      .map((contact) => formatContactForArt(contact.type, contact.value))
      .filter(Boolean),
    contactsPlacement: composition.contactsPlacement === 'rodape' ? 'rodape' : 'texto',
    fonts: {
      display: resolveFontFamily(composition.fontDisplay),
      body: resolveFontFamily(composition.fontBody),
    },
  };
}
