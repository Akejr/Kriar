import { DEFAULT_BODY_FONT, DEFAULT_DISPLAY_FONT } from '@/lib/fontCatalog';
import { DEFAULT_TEMPLATE_ID } from '@/lib/templates';
import { newId } from '@/lib/utils/id';
import { DEFAULT_FORMAT, DEFAULT_STYLE } from './catalog';
import type {
  Brand,
  BrandContact,
  Composition,
  CompositionItem,
  FormatId,
  Project,
  StyleId,
} from './types';

/**
 * Cores de arranque.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * São um VALOR DE RESERVA para o motor de artes ter sempre hexadecimais
 * válidos, não uma escolha da empresa. `colorsConfirmed: false` é o que
 * distingue as duas coisas.
 *
 * A distinção não é teórica: enquanto estes valores eram enviados à IA como
 * "cores declaradas pelo cliente", a proposta saía com um azul, um creme e
 * um laranja que ninguém escolheu — e o azul-marinho do logótipo real nunca
 * entrava, porque o prompt manda respeitar o que o cliente declarou.
 *
 * A terceira cor começa `null`: uma marca com duas cores é o caso comum, e
 * mostrar um laranja inventado como "terceira cor da marca" é afirmar algo
 * falso sobre a empresa.
 * ──────────────────────────────────────────────────────────────────────────
 */
const STARTER_COLORS = {
  primary: '#1F3A5F',
  secondary: '#E9E3D7',
  accent: null,
};

export function createBrand(accountId: string, companyName = ''): Brand {
  const now = new Date().toISOString();
  return {
    id: newId('brd'),
    accountId,
    company: {
      name: companyName,
      segment: 'outro',
      description: '',
      website: '',
      address: '',
    },
    contacts: [],
    identity: {
      colors: { ...STARTER_COLORS },
      fontDisplay: DEFAULT_DISPLAY_FONT,
      fontBody: DEFAULT_BODY_FONT,
      logoAssetId: null,
      logoForLightBgAssetId: null,
      logoForDarkBgAssetId: null,
      setupMode: 'manual',
      importReport: null,
      // Nada foi escolhido ainda. Só depois de o cliente escrever uma cor —
      // ou de a confirmar a partir do logótipo — é que ela tem autoridade.
      colorsConfirmed: false,
    },
    onboardingComplete: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createItem(name = '', assetId: string | null = null): CompositionItem {
  return { id: newId('itm'), name, assetId, locked: false };
}

export function createContact(partial: Partial<BrandContact> = {}): BrandContact {
  return {
    id: newId('ctc'),
    type: partial.type ?? 'whatsapp',
    value: partial.value ?? '',
    showByDefault: partial.showByDefault ?? false,
  };
}

/**
 * O website da marca, venha de onde vier.
 *
 * Vive em dois sítios: no campo "Website" dos dados da empresa e, às vezes,
 * também como contacto. O contacto ganha — foi escrito para as artes.
 */
export function brandWebsite(brand: Brand): string | null {
  const contact = brand.contacts.find((entry) => entry.type === 'website')?.value.trim();
  if (contact) return contact;
  return brand.company.website?.trim() || null;
}

/** Contactos marcados para as artes, além do website. */
export const DEFAULT_CONTACT_LIMIT = 3;

/**
 * Contactos que entram numa publicação nova.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O WEBSITE ENTRA SEMPRE, em primeiro lugar.
 *
 * Só entravam os contactos com "Mostrar nas artes por padrão" — e o website
 * nem é, na maior parte das marcas, um contacto: é o campo dos dados da
 * empresa. O resultado foi uma arte de subscrições da DOT, que se compram no
 * site, sem o site. Para uma empresa que vende online, o website é onde a
 * publicação leva o cliente.
 *
 * Os outros continuam a ser escolha do cliente, no máximo três. Em cada
 * publicação pode tirar-se qualquer um, website incluído.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function defaultContactsForComposition(brand: Brand): Composition['contacts'] {
  const website = brandWebsite(brand);
  const others = brand.contacts
    .filter(
      (contact) => contact.type !== 'website' && contact.showByDefault && contact.value.trim(),
    )
    .slice(0, DEFAULT_CONTACT_LIMIT)
    .map((contact) => ({ type: contact.type, value: contact.value.trim() }));
  return [...(website ? [{ type: 'website' as const, value: website }] : []), ...others];
}

export function createComposition(
  brand: Brand,
  options: { format?: FormatId; style?: StyleId; templateId?: string } = {},
): Composition {
  /*
    A identidade aprovada fornece os padrões iniciais.

    É o ponto onde o cadastro deixa de ser burocracia: a posição habitual do
    logótipo e a direcção de imagem já vêm decididas, e o cliente só as
    ajusta quando esta publicação precisar de algo diferente — sem alterar a
    identidade global.
  */
  const spec = brand.identity.spec;
  const approved = spec?.status === 'aprovada' ? spec : null;

  return {
    templateId: options.templateId ?? DEFAULT_TEMPLATE_ID,
    variantId: null,
    templateLocked: Boolean(options.templateId),
    /*
      Sem direcção à partida.

      É criada quando o pedido é interpretado — não há ideia possível antes
      de existir um pedido. Uma composição nova com uma direcção por omissão
      seria uma ideia que ninguém propôs.
    */
    direction: null,
    alternatives: [],
    references: [],
    format: options.format ?? DEFAULT_FORMAT,
    style: options.style ?? DEFAULT_STYLE,
    colors: { ...brand.identity.colors },
    colorsFromBrand: true,
    fontDisplay: brand.identity.fontDisplay,
    fontBody: brand.identity.fontBody,
    texts: {},
    images: [],
    mainImageIndex: 0,
    items: [],
    highlightedItemIndex: 0,
    logo: {
      show: true,
      variant: 'auto',
      /*
        Posição da identidade aprovada, quando existe.

        Sem identidade, canto inferior direito: as composições geradas põem o
        bloco de texto em cima — é a leitura natural de uma publicação — e o
        canto superior esquerdo fica ocupado pelo título.
      */
      placement: approved?.composition.logoPlacement ?? 'inferior-direito',
      size: 'pequeno',
    },
    contacts: defaultContactsForComposition(brand),
    /*
      Contactos debaixo do botão, por omissão — a única posição que três
      testes reais mostraram que o gerador respeita. O rodapé fica como
      escolha do cliente.
    */
    contactsPlacement: 'texto',
    /*
      Base primária até alguém decidir. Quem cria o rascunho (o store)
      substitui por a oposta da última publicação da marca, para o feed
      alternar sozinho; `baseChosen` só fica verdadeiro quando é o cliente.
    */
    base: 'primaria',
    baseChosen: false,
    overrides: {},
    background: { mode: 'modelo', assetId: null, prompt: '', producedBy: null },
    artwork: {
      assetId: null,
      prompt: '',
      producedBy: null,
      generatedAt: null,
      width: null,
      height: null,
      origin: null,
      summary: '',
      history: [],
    },
    /*
      O logótipo passa a fazer PARTE da arte.

      ──────────────────────────────────────────────────────────────────────
      `overlayLogo` era `true`: a aplicação desenhava o ficheiro original por
      cima da arte acabada, no canto que o cliente escolhia. Em troca da
      exactidão, o logótipo caía em cima do texto gerado — duas camadas a
      disputar o mesmo canto, porque o gerador não sabia que aquele espaço
      estava reservado.

      Com o logótipo gerado, quem compõe a imagem decide onde a marca
      assenta, e o prompt insiste três vezes que tem de ser o ficheiro
      anexado sem alterações. O custo está declarado: um gerador redesenha
      logótipos, e por isso o interruptor continua no ecrã de revisão para
      quem precisar da exactidão acima da integração.

      Os contactos seguem o mesmo caminho, e isto foi uma correcção.

      Ficaram com o acabamento ligado numa primeira versão, com o argumento
      de que um dígito errado é um dano real. O resultado na arte desmentiu
      o argumento: o endereço aparecia numa ETIQUETA cinzenta colada sobre o
      botão de acção, visivelmente aplicada por cima e não composta. Uma
      linha exacta mas estranha à arte é pior do que uma linha integrada que
      se confere antes de publicar — e o cliente pediu explicitamente que os
      contactos fossem para a IA.

      O interruptor continua no ecrã de revisão para quem preferir a
      exactidão, com o custo visual declarado.
      ──────────────────────────────────────────────────────────────────────
    */
    finish: { overlayLogo: false, overlayContacts: false },
    // Direcção de imagem da identidade, como ponto de partida. Não fica
    // `locked`: o planeador pode afiná-la para o pedido concreto.
    visualDirection: approved
      ? `${approved.direction.lighting} ${approved.direction.framing}`.trim()
      : '',
    visualDirectionLocked: false,
    // O website já foi proposto, em `contacts`. Se o cliente o tirar, fica tirado.
    websiteDefaulted: true,
    brandRefs: [],
  };
}

/**
 * Nome de uma publicação a que ninguém deu nome.
 *
 * Num só sítio porque três sítios dependem de o reconhecer: o caminho do
 * topo mostra "Nova publicação" em vez dele, o campo de renomear abre vazio,
 * e um rascunho com outro nome passa a valer a pena guardar.
 */
export const DEFAULT_PROJECT_NAME = 'Publicação sem nome';

export function createProject(
  accountId: string,
  brand: Brand,
  options: { name?: string; format?: FormatId; style?: StyleId; templateId?: string } = {},
): Project {
  const now = new Date().toISOString();
  return {
    id: newId('prj'),
    accountId,
    brandId: brand.id,
    name: options.name?.trim() || DEFAULT_PROJECT_NAME,
    status: 'rascunho',
    brief: '',
    composition: createComposition(brand, options),
    missingFields: [],
    planSource: null,
    thumbnail: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Cópia independente de um projecto, para a acção "Duplicar". */
export function duplicateProject(project: Project): Project {
  const now = new Date().toISOString();
  return {
    ...project,
    id: newId('prj'),
    name: `${project.name} (cópia)`,
    composition: structuredClone(project.composition),
    missingFields: structuredClone(project.missingFields),
    createdAt: now,
    updatedAt: now,
  };
}

/** Marca está pronta para criar publicações? */
export function isBrandReady(brand: Brand | null): boolean {
  if (!brand) return false;
  return Boolean(brand.onboardingComplete && brand.company.name.trim());
}

/**
 * Nome inicial do projecto, a partir do pedido.
 *
 * Usa as primeiras palavras do que o utilizador escreveu, para a lista de
 * projectos ficar legível sem obrigar a nomear nada. É sempre editável.
 */
export function deriveProjectName(brief: string): string {
  const clean = brief.replace(/\s+/g, ' ').trim();
  if (!clean) return DEFAULT_PROJECT_NAME;

  const words = clean.split(' ').slice(0, 7);
  let name = words.join(' ').replace(/[.,;:!?]+$/, '');
  if (name.length > 52) name = `${name.slice(0, 52).trimEnd()}…`;
  else if (words.length < clean.split(' ').length) name = `${name}…`;

  return name.charAt(0).toLocaleUpperCase('pt-PT') + name.slice(1);
}
