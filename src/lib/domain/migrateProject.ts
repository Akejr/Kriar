/**
 * Migração de projectos guardados.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * A mudança de arquitectura criativa não pode custar um projecto ao cliente.
 *
 * Um projecto gravado antes desta versão traz `style: 'promocional'`, nenhum
 * campo `direction` e um `templateId` que já não é autoridade criativa. Nada
 * disso é apagado: o estilo é traduzido, os campos novos são preenchidos
 * vazios, e o `templateId` fica como geometria para o motor local.
 *
 * O critério é o mesmo da identidade (`migrateIdentity.ts`): **dados
 * persistidos são entrada externa.** Um IndexedDB ou um `jsonb` escrito por
 * uma versão anterior do código é tão pouco de confiar como um corpo de
 * pedido HTTP.
 *
 * A diferença em relação à identidade é a política: ali uma especificação de
 * forma incompatível é DESCARTADA, porque uma identidade meio-formada
 * rebenta em sítios imprevisíveis. Aqui nada é descartado — um projecto é
 * trabalho do cliente, e perdê-lo não é uma opção. Preenchemos o que falta.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { migrateStyle } from './catalog';
import type { CreativeDirection } from './direction';
import type { ReferenceUsage } from './references';
import type { ArtworkVersion, Composition, Project } from './types';

/** A direcção guardada tem forma utilizável? */
function usableDirection(value: unknown): value is CreativeDirection {
  if (!value || typeof value !== 'object') return false;
  const direction = value as Partial<CreativeDirection>;
  // `idea` e `scene` são o mínimo: sem elas o prompt não tem o que dizer.
  return typeof direction.idea === 'string' && typeof direction.scene === 'string';
}

function usableUsage(value: unknown): value is ReferenceUsage {
  if (!value || typeof value !== 'object') return false;
  const usage = value as Partial<ReferenceUsage>;
  return typeof usage.referenceId === 'string';
}

export function migrateComposition(composition: Composition): Composition {
  return {
    ...composition,
    style: migrateStyle(composition.style),
    direction: usableDirection(composition.direction) ? composition.direction : null,
    alternatives: Array.isArray(composition.alternatives)
      ? composition.alternatives.filter(usableDirection)
      : [],
    references: Array.isArray(composition.references)
      ? composition.references.filter(usableUsage).map((usage) => ({
          referenceId: usage.referenceId,
          take: Array.isArray(usage.take) ? usage.take : [],
          doNotTransfer: Array.isArray(usage.doNotTransfer) ? usage.doNotTransfer : [],
          mode: usage.mode === 'imagem' ? 'imagem' : 'descricao',
          ...(typeof usage.why === 'string' ? { why: usage.why } : {}),
        }))
      : [],
    // Listas que versões anteriores podiam não ter gravado.
    /*
      O nome de cada produto, sempre texto. Um defeito do botão "Acrescentar
      opção" gravava o evento do clique no lugar do nome, e um projecto
      assim não abria — a revisão rebentava em `item.name.trim()`.
    */
    items: Array.isArray(composition.items)
      ? composition.items
          .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
          .map((item) => (typeof item.name === 'string' ? item : { ...item, name: '' }))
      : [],
    // A nota e o tipo de cada anexo são posteriores: projectos antigos vêm
    // sem eles. Um anexo antigo é material da empresa, como sempre foi.
    images: Array.isArray(composition.images)
      ? composition.images.map((image) => ({
          ...image,
          note: image.note ?? '',
          kind:
            image.kind === 'captura' || image.kind === 'recriar' ? image.kind : ('produto' as const),
        }))
      : [],
    brandRefs: Array.isArray(composition.brandRefs)
      ? composition.brandRefs.filter((id): id is string => typeof id === 'string')
      : [],
    seenIdeas: Array.isArray(composition.seenIdeas)
      ? composition.seenIdeas.filter((idea): idea is string => typeof idea === 'string')
      : [],
    contacts: Array.isArray(composition.contacts) ? composition.contacts : [],
    // Posteriores: publicações antigas punham sempre os contactos no texto
    // e eram desenhadas sobre a cor primária.
    contactsPlacement: composition.contactsPlacement === 'rodape' ? 'rodape' : 'texto',
    base: composition.base === 'secundaria' ? 'secundaria' : 'primaria',
    baseChosen: composition.baseChosen === true,
    overrides: composition.overrides ?? {},
    artwork: migrateArtwork(composition.artwork),
    finish: migrateFinish(composition),
  };
}

/**
 * A arte e o histórico de versões.
 *
 * O histórico é posterior: projectos antigos chegam sem ele e sem a origem
 * da versão actual. Uma arte antiga foi sempre uma geração — as edições por
 * zonas não existiam.
 */
function migrateArtwork(artwork: Composition['artwork'] | undefined): Composition['artwork'] {
  const base: Composition['artwork'] = {
    assetId: null,
    prompt: '',
    producedBy: null,
    generatedAt: null,
    width: null,
    height: null,
    origin: null,
    summary: '',
    history: [],
  };
  if (!artwork || typeof artwork !== 'object') return base;

  const history = Array.isArray(artwork.history)
    ? artwork.history
        .filter(
          (version): version is ArtworkVersion =>
            Boolean(version) && typeof version.assetId === 'string' && version.assetId.length > 0,
        )
        .map((version) => ({
          assetId: version.assetId,
          origin: version.origin === 'edicao' ? ('edicao' as const) : ('geracao' as const),
          createdAt: typeof version.createdAt === 'string' ? version.createdAt : '',
          width: typeof version.width === 'number' ? version.width : null,
          height: typeof version.height === 'number' ? version.height : null,
          summary: typeof version.summary === 'string' ? version.summary : '',
        }))
    : [];

  return {
    ...base,
    ...artwork,
    origin: artwork.origin ?? (artwork.assetId ? 'geracao' : null),
    summary: typeof artwork.summary === 'string' ? artwork.summary : '',
    history,
  };
}

/**
 * Os acabamentos colados por cima saíram do ecrã.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Um projecto sem arte gerada fica com os dois desligados: a próxima
 * geração leva o logótipo e os contactos dentro da arte, como todos os
 * outros, e não há interruptor para o cliente os voltar a desligar.
 *
 * Um projecto COM arte gerada mantém o que tinha. Essa arte foi gerada sem
 * logótipo, à espera da camada por cima — desligá-la deixava a arte sem
 * marca. Quando o cliente gerar outra, `generateArtwork` desliga-os.
 * ──────────────────────────────────────────────────────────────────────────
 */
function migrateFinish(composition: Composition): Composition['finish'] {
  const off = { overlayLogo: false, overlayContacts: false };
  if (!composition.artwork?.assetId) return off;
  return composition.finish ?? off;
}

export function migrateProject(project: Project): Project {
  return { ...project, composition: migrateComposition(project.composition) };
}
